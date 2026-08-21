/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route render error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <div>
            <p className="text-lg font-semibold text-gray-900">Something went wrong loading this page.</p>
            <p className="mt-1 text-sm text-gray-500">
              This can happen after an app update. Reloading usually fixes it.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
