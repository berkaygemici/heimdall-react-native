<p align="center">
  <h1 align="center">heimdall-react-native</h1>
</p>

<p align="center">
  <a href="https://github.com/berkaygemici/heimdall-react-native/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License"></a>
  <a href="https://www.npmjs.com/package/heimdall-react-native"><img src="https://img.shields.io/npm/v/heimdall-react-native.svg" alt="npm version"></a>
  <img src="https://img.shields.io/badge/platform-iOS-lightgrey.svg" alt="Platform">
  <img src="https://img.shields.io/badge/react--native-%3E%3D0.72-blue.svg" alt="React Native">
</p>

<p align="center">
  Lightweight, fault-tolerant crash tracking for React Native iOS apps.<br/>
  Catches JS errors, unhandled promise rejections, and native iOS crashes (via KSCrash).<br/>
  Reports everything to Firebase Firestore.
</p>

---

## Features

- **Zero-config crash capture** -- a single `init()` call hooks into all error paths
- **JS error handling** via `ErrorUtils.setGlobalHandler()`
- **Promise rejection tracking** with Hermes & JSC support
- **Native iOS crash reporting** via KSCrash (SIGSEGV, SIGABRT, OOM, Mach exceptions)
- **Breadcrumbs** for navigation, API calls, and custom events
- **User context** to associate crashes with users
- **Offline queue** -- failed sends are stored in AsyncStorage and retried on next launch
- **Fault-tolerant** -- all operations are wrapped; SDK failures never affect your app

## Installation

```bash
npm install heimdall-react-native
# or
yarn add heimdall-react-native
```

### iOS Setup

```bash
cd ios && pod install
```

The KSCrash dependency is automatically linked via the podspec.

### Peer Dependencies

```bash
npm install @react-native-async-storage/async-storage
```

## Quick Start

```typescript
// App.tsx -- add this at the very top, before anything else
import Heimdall from 'heimdall-react-native';

Heimdall.init({
  apiKey: 'hm_live_your-key-here',
  firebaseConfig: {
    apiKey: '...',
    authDomain: '...',
    projectId: '...',
    storageBucket: '...',
    messagingSenderId: '...',
    appId: '...',
  },
});

export default function App() {
  return <YourApp />;
}
```

That's it. Every JS crash, unhandled promise rejection, and native iOS crash is now automatically captured.

## Configuration

```typescript
Heimdall.init({
  apiKey: 'hm_live_...',
  firebaseConfig: { ... },
  enableNativeCrashHandling: true,     // default: true
  enableJsErrorHandler: true,          // default: true
  enablePromiseRejectionHandler: true, // default: true
  maxBreadcrumbs: 100,                 // default: 100
  debug: false,                        // default: false
  beforeSend: (event) => {
    // Modify or filter events before sending
    // Return null to drop the event
    return event;
  },
});
```

## API

### Manual Error Capture

```typescript
try {
  riskyOperation();
} catch (error) {
  Heimdall.captureException(error);
}

Heimdall.captureMessage('User did something unexpected', 'warning');
```

### Breadcrumbs

```typescript
Heimdall.addBreadcrumb({
  category: 'navigation',
  message: 'Navigated to Settings',
});

Heimdall.addBreadcrumb({
  category: 'api',
  message: 'POST /api/checkout failed',
  level: 'error',
  data: { statusCode: 500 },
});
```

### User Context

```typescript
Heimdall.setUser({
  id: 'user-123',
  email: 'user@example.com',
});

// Clear on logout
Heimdall.clearUser();
```

### Error Boundary (optional)

The global JS handler catches component crashes automatically. The error boundary adds a custom fallback UI instead of a white/red screen.

```tsx
import { HeimdallErrorBoundary } from 'heimdall-react-native';

function App() {
  return (
    <HeimdallErrorBoundary fallback={<Text>Something went wrong</Text>}>
      <MyApp />
    </HeimdallErrorBoundary>
  );
}
```

## How It Works

| What's caught | How | Wrapping needed? |
|---|---|---|
| JS errors | `ErrorUtils.setGlobalHandler()` | No |
| Promise rejections | Hermes `enablePromiseRejectionTracker` / JSC fallback | No |
| Native iOS crashes | KSCrash signal handlers (written to disk, sent on next launch) | No |
| React render errors | Optional `<HeimdallErrorBoundary>` | Optional |

## Architecture

- **JS Layer**: Catches unhandled JS errors, promise rejections, and React component errors
- **Native Layer**: KSCrash catches native iOS crashes (signals, Mach exceptions, ObjC exceptions). Reports are written to disk and sent on next launch
- **Transport**: Events go to Firebase Firestore. Failed sends are queued to AsyncStorage and retried

## Fault Tolerance

Heimdall is designed to **never** affect your app:

- All operations are wrapped in try-catch
- `init()` failure = silent no-op
- Network failures queue events for retry on next launch
- Original error handlers are always chained (red screen still works in dev)
- All Firestore writes are async and non-blocking
- Init is deferred via `setTimeout(0)` to never block app startup

## License

[MIT](LICENSE)
