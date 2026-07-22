import React from 'react';

export const StartupFailure = ({ error, onRetry }) => (
  <div className="app-loading-screen app-error-screen" role="alert">
    <h1>Application failed to load.</h1>
    <p>Check the application configuration and try again.</p>
    {import.meta.env.DEV && <p className="app-error-detail">{error?.message || 'Unknown startup error'}</p>}
    <div className="app-error-actions">
      <button type="button" onClick={onRetry}>Retry</button>
      <button type="button" onClick={() => window.location.reload()}>Reload</button>
    </div>
  </div>
);

export class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Application runtime error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return <StartupFailure error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
