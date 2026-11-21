import { Component } from 'react'

const blockStyle = {
  border: '1px solid rgba(255, 85, 85, 0.4)',
  boxShadow: '0 0 20px rgba(255, 85, 85, 0.15)',
  padding: 20,
  marginBottom: 24,
  background: 'rgba(255, 85, 85, 0.04)',
}

const preStyle = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  color: '#ff9a9a',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
}

const labelStyle = {
  fontSize: 12,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: '#8899aa',
  marginBottom: 10,
}

const buttonStyle = {
  background: 'transparent',
  border: '1px solid #00ffff',
  color: '#00ffff',
  padding: '10px 24px',
  fontFamily: 'inherit',
  fontSize: 13,
  letterSpacing: 2,
  textTransform: 'uppercase',
  cursor: 'pointer',
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, componentStack: null, hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { error, hasError: true }
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || null })
    console.error('Unhandled render error:', error, info?.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null, componentStack: null, hasError: false })
  }

  render() {
    const { error, componentStack, hasError } = this.state

    if (!hasError) return this.props.children

    const message = (error && error.message) || String(error)
    const stack = (error && error.stack) || '(no stack)'

    return (
      <div
        role="alert"
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
          Render failure — the interface was terminated
        </div>

        <div style={blockStyle}>
          <div style={{ fontSize: 15, marginBottom: 10 }}>{message}</div>
          <pre style={preStyle}>{stack}</pre>
        </div>

        {componentStack && (
          <div style={blockStyle}>
            <div style={labelStyle}>Component stack</div>
            <pre style={preStyle}>{componentStack}</pre>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={this.handleReset} style={buttonStyle}>
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ ...buttonStyle, borderColor: 'rgba(255, 85, 85, 0.6)', color: '#ff5555' }}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
