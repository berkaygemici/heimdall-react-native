import { heimdallClient } from './client';

export { HeimdallErrorBoundary } from './handlers/errorBoundary';
export type {
  HeimdallConfig,
  FirebaseConfig,
  CrashEvent,
  StackFrame,
  Breadcrumb,
  UserContext,
  DeviceContext,
  EventType,
  EventLevel,
  Mechanism,
} from './types';

const Heimdall = {
  init: heimdallClient.init.bind(heimdallClient),
  captureException: heimdallClient.captureException.bind(heimdallClient),
  captureMessage: heimdallClient.captureMessage.bind(heimdallClient),
  addBreadcrumb: heimdallClient.addBreadcrumb.bind(heimdallClient),
  setUser: heimdallClient.setUser.bind(heimdallClient),
  setTag: heimdallClient.setTag.bind(heimdallClient),
  clearUser: heimdallClient.clearUser.bind(heimdallClient),
  destroy: heimdallClient.destroy.bind(heimdallClient),
};

export default Heimdall;
