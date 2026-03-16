import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public componentDidMount() {
    window.addEventListener('firestore-error-event', this.handleFirestoreError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('firestore-error-event', this.handleFirestoreError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleFirestoreError = (event: Event) => {
    const customEvent = event as CustomEvent<any>;
    const detail = customEvent.detail;
    
    // Only show full-screen error for non-recoverable errors (like permission denied)
    if (!detail.isRecoverable) {
      this.setState({
        hasError: true,
        error: new Error(JSON.stringify(detail)),
        errorInfo: null
      });
    }
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (event.defaultPrevented) return;

    if (event.reason instanceof Error && event.reason.message.includes('operationType')) {
      try {
        const detail = JSON.parse(event.reason.message);
        // Only show full-screen error for non-recoverable errors
        if (detail.isRecoverable === false) {
          this.setState({
            hasError: true,
            error: event.reason,
            errorInfo: null
          });
        }
      } catch (e) {
        // Not JSON, but still a Firestore error
        this.setState({
          hasError: true,
          error: event.reason,
          errorInfo: null
        });
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      let parsedError = null;
      try {
        if (this.state.error?.message) {
          parsedError = JSON.parse(this.state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-red-100 p-8">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 text-red-500">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            
            <div className="mb-6">
              {parsedError ? (
                <div className="space-y-2">
                  <p className="text-slate-600">
                    A permission error occurred while accessing the database.
                  </p>
                  <div className="bg-slate-50 p-4 rounded-xl text-sm font-mono text-slate-700 overflow-auto max-h-48">
                    <p><strong>Operation:</strong> {parsedError.operationType}</p>
                    <p><strong>Path:</strong> {parsedError.path}</p>
                    <p><strong>Error:</strong> {parsedError.error}</p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600">
                  {this.state.error?.message || 'An unexpected error occurred.'}
                </p>
              )}
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
            >
              <RefreshCw size={18} />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
