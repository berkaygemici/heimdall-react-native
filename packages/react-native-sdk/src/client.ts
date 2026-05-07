import { NativeModules } from 'react-native';
import {
  HeimdallConfig,
  CrashEvent,
  StackFrame,
  EventType,
  EventLevel,
  Mechanism,
  UserContext,
  Breadcrumb,
} from './types';
import { safeExec, safeExecAsync, setDebugMode } from './safeExec';
import { BreadcrumbTracker } from './breadcrumbs';
import { getDeviceContext, setNativeModule, clearContextCache } from './context';
import { generateFingerprint } from './fingerprint';
import { initFirebase, sendEvent, sendPendingEvents } from './transport';
import { installJsErrorHandler, uninstallJsErrorHandler } from './handlers/jsErrorHandler';
import { installPromiseHandler, uninstallPromiseHandler } from './handlers/promiseHandler';

function generateId(): string {
  return 'hm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function parseStackTrace(stack: string | undefined): StackFrame[] {
  if (!stack) return [];

  const frames: StackFrame[] = [];
  const lines = stack.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // RN format: "at functionName (filename:line:col)" or "functionName@filename:line:col"
    const atMatch = trimmed.match(/^at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)$/);
    const atAnonMatch = trimmed.match(/^at\s+(.+?):(\d+):(\d+)$/);
    const hermeMatch = trimmed.match(/^(.+?)@(.+?):(\d+):(\d+)$/);

    if (atMatch) {
      frames.push({
        function: atMatch[1],
        filename: atMatch[2],
        lineno: parseInt(atMatch[3], 10),
        colno: parseInt(atMatch[4], 10),
        in_app: !atMatch[2].includes('node_modules'),
      });
    } else if (hermeMatch) {
      frames.push({
        function: hermeMatch[1],
        filename: hermeMatch[2],
        lineno: parseInt(hermeMatch[3], 10),
        colno: parseInt(hermeMatch[4], 10),
        in_app: !hermeMatch[2].includes('node_modules'),
      });
    } else if (atAnonMatch) {
      frames.push({
        function: '<anonymous>',
        filename: atAnonMatch[1],
        lineno: parseInt(atAnonMatch[2], 10),
        colno: parseInt(atAnonMatch[3], 10),
        in_app: !atAnonMatch[1].includes('node_modules'),
      });
    }
  }

  return frames;
}

class HeimdallClient {
  private config: HeimdallConfig | null = null;
  private breadcrumbs: BreadcrumbTracker = new BreadcrumbTracker();
  private user: UserContext | undefined;
  private tags: Record<string, string> = {};
  private initialized = false;
  private appId: string = '';

  init(config: HeimdallConfig): void {
    safeExec(() => {
      if (this.initialized) return;

      this.config = {
        enableNativeCrashHandling: true,
        enableJsErrorHandler: true,
        enablePromiseRejectionHandler: true,
        maxBreadcrumbs: 100,
        debug: false,
        ...config,
      };

      if (this.config.debug) {
        setDebugMode(true);
      }

      this.breadcrumbs = new BreadcrumbTracker(this.config.maxBreadcrumbs);

      // Defer all setup so it never blocks app startup
      setTimeout(() => {
        safeExec(() => this.setupHandlers());
        safeExecAsync(() => this.setupFirebase());
      }, 0);

      this.initialized = true;
    });
  }

  private setupHandlers(): void {
    if (!this.config) return;

    if (this.config.enableJsErrorHandler) {
      installJsErrorHandler((error, isFatal) => {
        this.captureError(error, isFatal ? 'fatal' : 'error', 'jsHandler');
      });
    }

    if (this.config.enablePromiseRejectionHandler) {
      installPromiseHandler((reason) => {
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        this.captureError(error, 'error', 'promiseRejection');
      });
    }

    if (this.config.enableNativeCrashHandling) {
      safeExec(() => {
        const HeimdallNative = NativeModules.HeimdallNative;
        if (HeimdallNative) {
          setNativeModule(HeimdallNative);
          HeimdallNative.startNativeHandler?.();
          safeExecAsync(() => this.checkPendingNativeCrashes());
        }
      });
    }
  }

  private async setupFirebase(): Promise<void> {
    await safeExecAsync(async () => {
      if (!this.config?.firebaseConfig) return;
      initFirebase(this.config.firebaseConfig);
      await sendPendingEvents();
    });
  }

  private async checkPendingNativeCrashes(): Promise<void> {
    const HeimdallNative = NativeModules.HeimdallNative;
    if (!HeimdallNative?.getPendingCrashReports) return;

    const reports = await HeimdallNative.getPendingCrashReports();
    if (!reports || !Array.isArray(reports)) return;

    for (const report of reports) {
      await safeExecAsync(async () => {
        const stacktrace: StackFrame[] = (report.stacktrace ?? []).map(
          (f: any) => ({
            filename: f.filename ?? '<unknown>',
            function: f.function ?? '<unknown>',
            lineno: f.lineno ?? 0,
            colno: f.colno ?? 0,
            in_app: f.in_app ?? false,
          }),
        );

        const event = await this.buildEvent(
          report.type ?? 'SIGABRT',
          report.value ?? 'Native crash',
          stacktrace,
          'nativeCrash',
          'fatal',
          'crash',
        );

        await this.dispatchEvent(event);
      });
    }
  }

  captureException(error: Error, level?: EventLevel): void {
    safeExec(() => {
      this.captureError(error, level ?? 'error', 'manual');
    });
  }

  captureMessage(message: string, level?: EventLevel): void {
    safeExecAsync(async () => {
      const event = await this.buildEvent(
        'Message',
        message,
        [],
        'manual',
        level ?? 'info',
        'message',
      );
      await this.dispatchEvent(event);
    });
  }

  addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>): void {
    safeExec(() => {
      this.breadcrumbs.add(crumb);
    });
  }

  setUser(user: UserContext): void {
    safeExec(() => {
      this.user = user;
    });
  }

  setTag(key: string, value: string): void {
    safeExec(() => {
      this.tags[key] = value;
    });
  }

  clearUser(): void {
    this.user = undefined;
  }

  private captureError(error: Error, level: EventLevel, mechanism: Mechanism): void {
    safeExecAsync(async () => {
      const stacktrace = parseStackTrace(error.stack);
      const event = await this.buildEvent(
        error.name || 'Error',
        error.message || 'Unknown error',
        stacktrace,
        mechanism,
        level,
        level === 'fatal' ? 'crash' : 'error',
      );
      await this.dispatchEvent(event);
    });
  }

  private async buildEvent(
    errorType: string,
    errorValue: string,
    stacktrace: StackFrame[],
    mechanism: Mechanism,
    level: EventLevel,
    type: EventType,
  ): Promise<CrashEvent> {
    const device = await getDeviceContext(
      this.config?.apiKey ? undefined : undefined,
    );
    const fingerprint = generateFingerprint(errorType, errorValue, stacktrace);

    const event: CrashEvent = {
      id: generateId(),
      apiKey: this.config?.apiKey ?? '',
      appId: this.appId,
      type,
      level,
      timestamp: Date.now(),
      fingerprint,
      exception: {
        type: errorType,
        value: errorValue,
        stacktrace,
        mechanism,
      },
      device,
      breadcrumbs: this.breadcrumbs.getAll(),
    };
    if (this.user)
      event.user = this.user;
    if (Object.keys(this.tags).length > 0)
      event.tags = { ...this.tags };
    return event;
  }

  private async dispatchEvent(event: CrashEvent): Promise<void> {
    if (!this.config) return;

    if (this.config.beforeSend) {
      const modified = this.config.beforeSend(event);
      if (!modified) return;
      event = modified;
    }

    await safeExecAsync(() => sendEvent(event));
  }

  destroy(): void {
    safeExec(() => {
      uninstallJsErrorHandler();
      uninstallPromiseHandler();
      clearContextCache();
      this.breadcrumbs.clear();
      this.initialized = false;
      this.config = null;
    });
  }
}

export const heimdallClient = new HeimdallClient();
