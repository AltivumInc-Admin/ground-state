import { Component } from 'react'

/*
 * Shared error boundary for the two R3F scene wrappers. If WebGL is
 * unavailable (or the scene throws for any reason) the fallback renders
 * instead — quiet failure, never a broken page. `onFailed` lets the host
 * gate sibling UI (the hero's caption and pause toggle) on the scene
 * actually running.
 */
export default class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFailed?.()
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
