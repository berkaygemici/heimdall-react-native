import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  increment,
  Firestore,
} from 'firebase/firestore';
import { CrashEvent, ApiKeyDocument, IssueDocument, FirebaseConfig } from './types';
import { safeExecAsync } from './safeExec';

const HEIMDALL_APP_NAME = '__heimdall__';
const QUEUE_KEY = '@heimdall_event_queue';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

let AsyncStorage: any = null;
try {
  AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
} catch (_) {
  // AsyncStorage not available, offline queue disabled
}

export function initFirebase(firebaseConfig: FirebaseConfig): void {
  if (db) return;

  const existing = getApps().find((a: FirebaseApp) => a.name === HEIMDALL_APP_NAME);
  app = existing ?? initializeApp(firebaseConfig, HEIMDALL_APP_NAME);
  db = getFirestore(app);
}

async function resolveAppId(apiKey: string): Promise<string | null> {
  if (!db) return null;

  const keyDoc = await getDoc(doc(db, 'apiKeys', apiKey));
  if (!keyDoc.exists()) return null;

  const data = keyDoc.data() as ApiKeyDocument;
  if (!data.active) return null;

  return data.appId;
}

const appIdCache = new Map<string, string>();

async function getAppId(apiKey: string): Promise<string | null> {
  if (appIdCache.has(apiKey)) return appIdCache.get(apiKey)!;
  const appId = await resolveAppId(apiKey);
  if (appId) appIdCache.set(apiKey, appId);
  return appId;
}

export async function sendEvent(event: CrashEvent): Promise<void> {
  if (!db || !event.apiKey) {
    await queueEvent(event);
    return;
  }

  const appId = await getAppId(event.apiKey);
  if (!appId) {
    await queueEvent(event);
    return;
  }

  event.appId = appId;

  try {
    // Write the event
    await setDoc(doc(db, 'apps', appId, 'events', event.id), event);

    // Upsert the issue
    await upsertIssue(appId, event);

    // Update app-level metadata
    await safeExecAsync(async () => {
      const appRef = doc(db!, 'apps', appId);
      const appDoc = await getDoc(appRef);
      if (appDoc.exists()) {
        await updateDoc(appRef, {
          lastSeen: Date.now(),
          eventCount: increment(1),
        });
      }
    });
  } catch (_) {
    await queueEvent(event);
  }
}

async function upsertIssue(appId: string, event: CrashEvent): Promise<void> {
  if (!db) return;

  const issueRef = doc(db, 'apps', appId, 'issues', event.fingerprint);
  const issueSnap = await getDoc(issueRef);

  const lastEventSubset = {
    id: event.id,
    timestamp: event.timestamp,
    device: event.device,
    exceptionValue: event.exception.value,
  };

  if (issueSnap.exists()) {
    await updateDoc(issueRef, {
      lastSeen: event.timestamp,
      count: increment(1),
      level: event.level,
      lastEvent: lastEventSubset,
    });
  } else {
    const issue: IssueDocument = {
      fingerprint: event.fingerprint,
      title: `${event.exception.type}: ${event.exception.value}`,
      lastSeen: event.timestamp,
      firstSeen: event.timestamp,
      count: 1,
      level: event.level,
      status: 'unresolved',
      mechanism: event.exception.mechanism,
      appId,
      appName: '',
      lastEvent: lastEventSubset,
    };
    await setDoc(issueRef, issue);
  }
}

async function queueEvent(event: CrashEvent): Promise<void> {
  if (!AsyncStorage) return;

  await safeExecAsync(async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: CrashEvent[] = raw ? JSON.parse(raw) : [];
    queue.push(event);
    // Cap the queue at 50 to avoid storage bloat
    const trimmed = queue.slice(-50);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  });
}

export async function sendPendingEvents(): Promise<void> {
  if (!AsyncStorage || !db) return;

  await safeExecAsync(async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;

    const queue: CrashEvent[] = JSON.parse(raw);
    await AsyncStorage.removeItem(QUEUE_KEY);

    for (const event of queue) {
      await safeExecAsync(() => sendEvent(event));
    }
  });
}
