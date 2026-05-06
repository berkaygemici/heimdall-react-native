import { safeExec } from '../safeExec';

type ErrorHandler = (error: Error, isFatal: boolean) => void;

let originalHandler: ErrorHandler | null = null;
let installed = false;

declare const global: {
  ErrorUtils?: {
    getGlobalHandler: () => ErrorHandler;
    setGlobalHandler: (handler: ErrorHandler) => void;
  };
};

export function installJsErrorHandler(
  callback: (error: Error, isFatal: boolean) => void,
): void {
  if (installed) return;

  safeExec(() => {
    if (!global.ErrorUtils) return;

    originalHandler = global.ErrorUtils.getGlobalHandler();

    global.ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      // Capture the error for Heimdall first
      safeExec(() => callback(error, isFatal));

      // Always chain to the original handler so the app's default behavior is preserved
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });

    installed = true;
  });
}

export function uninstallJsErrorHandler(): void {
  safeExec(() => {
    if (!installed || !global.ErrorUtils || !originalHandler) return;
    global.ErrorUtils.setGlobalHandler(originalHandler);
    originalHandler = null;
    installed = false;
  });
}
