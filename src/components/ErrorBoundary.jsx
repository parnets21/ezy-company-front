import { Component } from 'react'

/**
 * Temporary diagnostic error boundary.
 * Instead of a blank white screen when a render throws, it shows the actual
 * error + stack so we can see what's failing.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Also log to console for good measure.
    console.error('[ErrorBoundary] Caught render error:', error, info)
    this.setState({ info })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, fontFamily: 'monospace', color: '#b91c1c', background: '#fff', minHeight: '100vh' }}>
        <h2 style={{ color: '#b91c1c' }}>App crashed while rendering</h2>
        <p style={{ color: '#111' }}>{String(this.state.error?.message || this.state.error)}</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#374151', background: '#f9fafb', padding: 12, borderRadius: 8, overflow: 'auto' }}>
          {this.state.error?.stack}
        </pre>
        {this.state.info?.componentStack && (
          <>
            <h4 style={{ color: '#111' }}>Component stack</h4>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#6b7280', background: '#f9fafb', padding: 12, borderRadius: 8, overflow: 'auto' }}>
              {this.state.info.componentStack}
            </pre>
          </>
        )}
      </div>
    )
  }
}
