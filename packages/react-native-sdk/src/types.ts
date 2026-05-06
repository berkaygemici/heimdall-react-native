export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface HeimdallConfig {
  apiKey: string;
  firebaseConfig: FirebaseConfig;
  enableNativeCrashHandling?: boolean;
  enableJsErrorHandler?: boolean;
  enablePromiseRejectionHandler?: boolean;
  maxBreadcrumbs?: number;
  debug?: boolean;
  beforeSend?: (event: CrashEvent) => CrashEvent | null;
}

export interface StackFrame {
  filename: string;
  function: string;
  lineno: number;
  colno: number;
  in_app: boolean;
}

export type EventType = 'error' | 'crash' | 'message';
export type EventLevel = 'fatal' | 'error' | 'warning' | 'info';
export type Mechanism =
  | 'jsHandler'
  | 'promiseRejection'
  | 'nativeCrash'
  | 'errorBoundary'
  | 'manual';
export type IssueStatus = 'unresolved' | 'resolved' | 'ignored';

export interface ExceptionPayload {
  type: string;
  value: string;
  stacktrace: StackFrame[];
  mechanism: Mechanism;
}

export interface DeviceContext {
  model: string;
  osVersion: string;
  appVersion: string;
  buildNumber: string;
  freeMemory: number;
  freeDisk: number;
}

export interface Breadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level?: EventLevel;
  data?: Record<string, unknown>;
}

export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  extra?: Record<string, unknown>;
}

export interface CrashEvent {
  id: string;
  apiKey: string;
  appId: string;
  type: EventType;
  level: EventLevel;
  timestamp: number;
  fingerprint: string;
  exception: ExceptionPayload;
  device: DeviceContext;
  breadcrumbs: Breadcrumb[];
  user?: UserContext;
  tags?: Record<string, string>;
}

export interface IssueDocument {
  fingerprint: string;
  title: string;
  lastSeen: number;
  firstSeen: number;
  count: number;
  level: EventLevel;
  status: IssueStatus;
  mechanism: Mechanism;
  appId: string;
  appName: string;
  lastEvent: {
    id: string;
    timestamp: number;
    device: DeviceContext;
    exceptionValue: string;
  };
}

export interface AppDocument {
  name: string;
  apiKey: string;
  createdAt: number;
  lastSeen: number;
  eventCount: number;
}

export interface ApiKeyDocument {
  appId: string;
  appName: string;
  createdAt: number;
  active: boolean;
}
