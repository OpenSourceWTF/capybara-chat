/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the component tree
 * and displays a fallback UI instead of crashing.
 */

import { Component, type ReactNode } from 'react';
import { createLogger } from '../../lib/logger';

const log = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error('Uncaught error', { error: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="text-center max-w-md">
            <h2 className="text-xl font-semibold text-foreground mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
