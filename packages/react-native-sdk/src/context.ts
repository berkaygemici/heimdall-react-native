import { Platform, Dimensions } from 'react-native';
import { DeviceContext } from './types';
import { safeExec } from './safeExec';

let cachedContext: DeviceContext | null = null;
let nativeModule: any = null;

export function setNativeModule(mod: any): void {
  nativeModule = mod;
}

export async function getDeviceContext(
  appVersion?: string,
  buildNumber?: string,
): Promise<DeviceContext> {
  if (cachedContext) return cachedContext;

  const ctx: DeviceContext = {
    model: 'Unknown',
    osVersion: Platform.Version?.toString() ?? 'Unknown',
    appVersion: appVersion ?? '0.0.0',
    buildNumber: buildNumber ?? '0',
    freeMemory: 0,
    freeDisk: 0,
  };

  safeExec(() => {
    const { width, height } = Dimensions.get('window');
    (ctx as any).screenWidth = width;
    (ctx as any).screenHeight = height;
  });

  if (nativeModule?.getDeviceInfo) {
    try {
      const info = await nativeModule.getDeviceInfo();
      if (info) {
        ctx.model = info.model ?? ctx.model;
        ctx.freeMemory = info.freeMemory ?? 0;
        ctx.freeDisk = info.freeDisk ?? 0;
        if (info.osVersion) ctx.osVersion = info.osVersion;
      }
    } catch (_) {
      // native module not available, use defaults
    }
  }

  cachedContext = ctx;
  return ctx;
}

export function clearContextCache(): void {
  cachedContext = null;
}
