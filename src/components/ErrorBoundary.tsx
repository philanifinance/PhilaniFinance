import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any uncaught render error anywhere in the tree unmounts
// the whole app and React shows nothing — a silent blank white page with
// no indication of what broke, visible only in the browser console.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-14 h-14 mx-auto bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-red-600" />
          </div>
          <h1 className="font-bold text-gray-900 text-lg mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-500 mb-1">
            This page hit an unexpected error and couldn't load.
          </p>
          <p className="text-xs text-gray-400 font-mono bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mt-4 mb-6 text-left overflow-x-auto">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reload Page
          </button>
        </div>
      </div>
    );
  }
}
