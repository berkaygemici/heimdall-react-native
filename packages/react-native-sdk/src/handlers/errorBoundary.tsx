import React, { Component, ErrorInfo, ReactNode } from 'react';
import { safeExec } from '../safeExec';
import { heimdallClient } from '../client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class HeimdallErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    safeExec(() => {
      if (errorInfo.componentStack) {
        heimdallClient.addBreadcrumb({
          category: 'react',
          message: `Component stack: ${errorInfo.componentStack}`,
        });
      }
      heimdallClient.captureException(error, 'error');
    });
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return (this.props.fallback as (error: Error) => ReactNode)(
          this.state.error,
        );
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return null;
    }

    return this.props.children;
  }
}
