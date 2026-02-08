import React from 'react'

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const fallback = this.props.fallback
      const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL || '/'
      if (typeof fallback === 'function') {
        const content = fallback(err)
        if (content) return content
      }
      return fallback || (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <p>Something went wrong. {err?.message || ''}</p>
          <a href={base}>Go to home</a>
        </div>
      )
    }
    return this.props.children
  }
}
