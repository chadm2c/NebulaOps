import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state

    if (!error) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#020208',
          color: '#ff5555',
          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
          padding: '30px 40px',
          overflow: 'auto',
          zIndex: 1000,
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: 8,
            color: '#fff',
            textTransform: 'uppercase',
            textShadow: '0 0 20px rgba(255, 85, 85, 0.5)',
            marginBottom: 6,
          }}
        >
          NebulaOps
        </h1>

        <div style={{ color: '#8899aa', fontSize: 14, marginBottom: 24 }}>
          Render failure — the 3D scene was terminated
        </div>

        <div
          style={{
            border: '1px solid rgba(255, 85, 85, 0.4)',
            boxShadow: '0 0 20px rgba(255, 85, 85, 0.15)',
            padding: 20,
            marginBottom: 24,
            background: 'rgba(255, 85, 85, 0.04)',
          }}
        >
          <div style={{ fontSize: 15, marginBottom: 10 }}>{error.message || String(error)}</div>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.6,
              color: '#ff9a9a',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error.stack}
          </pre>
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'transparent',
            border: '1px solid #00ffff',
            color: '#00ffff',
            padding: '10px 24px',
            fontFamily: 'inherit',
            fontSize: 13,
            letterSpacing: 2,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}

export default ErrorBoundary
