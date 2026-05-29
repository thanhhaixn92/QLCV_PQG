import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-xl border border-red-100 shadow-sm max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-800 mb-2">Đã xảy ra lỗi không mong muốn</h1>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              Giao diện gặp sự cố khi hiển thị. Vui lòng tải lại trang hoặc liên hệ quản trị viên nếu lỗi vẫn tiếp diễn.
            </p>
            {this.state.error && (
              <div className="bg-slate-50 text-slate-600 text-[10px] sm:text-xs font-mono p-4 rounded-lg text-left overflow-x-auto mb-6 border border-slate-100">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-[#002D56] hover:bg-slate-900 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
            >
              <RefreshCcw className="w-4 h-4" />
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
