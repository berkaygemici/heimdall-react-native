# heimdall-react-native

Lightweight, fault-tolerant crash tracking for React Native iOS apps. Catches JS errors, unhandled promise rejections, and native iOS crashes (via KSCrash). Reports everything to Firebase Firestore.

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

Make sure you have these installed:

```bash
npm install @react-native-async-storage/async-storage
```

## How It Works

Heimdall uses **global-level hooks** built into React Native and iOS. You do NOT need to wrap your components or modify your code beyond a single `init()` call.

| What's caught | How | Wrapping needed? |
|---|---|---|
| JS errors (crashes, thrown exceptions) | `ErrorUtils.setGlobalHandler()` -- RN routes ALL unhandled JS errors through this | No |
| Unhandled promise rejections | Hermes `enablePromiseRejectionTracker` / JSC fallback | No |
| Native iOS crashes (SIGSEGV, SIGABRT, OOM) | KSCrash signal handlers at OS level. Written to disk, sent on next launch | No |
| React component render errors | Optional `<HeimdallErrorBoundary>` for custom fallback UI | Optional |

## Usage

### Minimal Setup (this is all you need)

```typescript
// App.tsx -- add this at the very top, before anything else
import Heimdall from 'heimdall-react-native';

Heimdall.init({
  apiKey: 'hm_live_your-key-here',  // from the Heimdall dashboard
  firebaseConfig: {                  // your Firebase project config
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

That's it. Every JS crash, unhandled promise rejection, and native iOS crash is now automatically captured and sent to your dashboard.

### All Options

```typescript
Heimdall.init({
  apiKey: 'hm_live_...',
  firebaseConfig: { ... },          // required: your Firebase config
  enableNativeCrashHandling: true,  // default: true
  enableJsErrorHandler: true,       // default: true
  enablePromiseRejectionHandler: true, // default: true
  maxBreadcrumbs: 100,              // default: 100
  debug: false,                     // default: false
  beforeSend: (event) => {
    // Modify or filter events before sending
    // Return null to drop the event
    return event;
  },
});
```

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

This is **optional**. Without it, component crashes are still caught by the global JS handler above. The boundary only adds a custom fallback UI instead of a white/red screen.

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

## Fault Tolerance

Heimdall is designed to **never** affect your app:

- All operations are wrapped in try-catch
- `init()` failure = silent no-op
- Network failures queue events for retry on next launch
- Original error handlers are always chained (red screen still works in dev)
- All Firestore writes are async and non-blocking
- Init is deferred via `setTimeout(0)` to never block app startup

## Architecture

- **JS Layer**: Catches unhandled JS errors via `ErrorUtils.setGlobalHandler()`, promise rejections (Hermes & JSC aware), and React component errors via Error Boundary
- **Native Layer**: Uses KSCrash to catch native iOS crashes (signals, Mach exceptions, ObjC exceptions). Crash reports are written to disk and sent on next launch
- **Transport**: Events go to Firebase Firestore. Failed sends are queued to AsyncStorage and retried
