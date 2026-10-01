import { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorRegion } from '../../types/error';
import { useErrorStore } from '../../store/errorStore';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  region: ErrorRegion;
  screenId?: string | null;
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Render error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.region}] Caught error:`, error, errorInfo);
    useErrorStore
      .getState()
      .handleFailure(
        this.props.region,
        this.props.screenId ?? null,
        undefined,
        error
      );
  }

  handleRetry = () => {
    useErrorStore
      .getState()
      .retryRegion(this.props.region, this.props.screenId ?? null);
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="preview-error-overlay" style={{ position: 'relative', minHeight: '160px' }}>
          <AlertTriangle size={24} color="#ef4444" />
          <div className="preview-error-title">
            {this.props.fallbackTitle || `Error in ${this.props.region}`}
          </div>
          <div className="preview-error-desc">{this.state.errorMessage}</div>
          <button className="btn-retry" onClick={this.handleRetry}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
