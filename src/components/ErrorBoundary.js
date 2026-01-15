import React from 'react';

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the error, and displays a fallback UI instead of crashing
 * the whole app to a white screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fdf7f7 0%, #f5f1f1 50%, #f0ebeb 100%)',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            maxWidth: '500px',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>😵</div>
            <h1 style={{ 
              color: '#4a4a4a', 
              marginBottom: '16px',
              fontSize: '24px'
            }}>
              Oops! Something went wrong
            </h1>
            <p style={{ 
              color: '#8f93a0', 
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              The app encountered an unexpected error. Don't worry - your data is safe. 
              Try refreshing the page to fix the issue.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRefresh}
                style={{
                  background: '#b48f8f',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  background: '#f3f4f6',
                  color: '#4a4a4a',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🏠 Go Home
              </button>
            </div>
            {/* Show technical details for debugging (collapsed by default) */}
            {this.state.error && (
              <details style={{ 
                marginTop: '24px', 
                textAlign: 'left',
                background: '#f9fafb',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <summary style={{ 
                  cursor: 'pointer', 
                  color: '#8f93a0',
                  marginBottom: '8px'
                }}>
                  Technical Details (for support)
                </summary>
                <pre style={{ 
                  overflow: 'auto', 
                  color: '#ef4444',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error && this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
