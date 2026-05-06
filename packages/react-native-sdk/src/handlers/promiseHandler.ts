import { safeExec } from '../safeExec';

type RejectionCallback = (reason: unknown) => void;

let installed = false;
let polyfillTracking: any = null;

declare const global: {
  HermesInternal?: {
    enablePromiseRejectionTracker?: (options: {
      allRejections: boolean;
      onUnhandled: (id: number, error: unknown) => void;
      onHandled?: (id: number) => void;
    }) => void;
  };
  Promise?: any;
};

export function installPromiseHandler(callback: RejectionCallback): void {
  if (installed) return;

  safeExec(() => {
    // Hermes engine
    if (global.HermesInternal?.enablePromiseRejectionTracker) {
      global.HermesInternal.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled: (_id: number, error: unknown) => {
          safeExec(() => callback(error));
        },
      });
      installed = true;
      return;
    }

    // JSC / fallback: use the global unhandledrejection event if available
    if (typeof globalThis !== 'undefined') {
      const handler = (event: any) => {
        safeExec(() => callback(event?.reason));
      };
      (globalThis as any).addEventListener?.('unhandledrejection', handler);
      polyfillTracking = handler;
      installed = true;
    }
  });
}

export function uninstallPromiseHandler(): void {
  safeExec(() => {
    if (!installed) return;

    if (polyfillTracking && typeof globalThis !== 'undefined') {
      (globalThis as any).removeEventListener?.(
        'unhandledrejection',
        polyfillTracking,
      );
      polyfillTracking = null;
    }

    installed = false;
  });
}
