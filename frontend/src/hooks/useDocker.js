import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { decodeBytes, logFrame } from '../utils/terminalDebugger'

const API_URL = import.meta.env.VITE_API_URL || ''

function getWsHost() {
  return API_URL ? API_URL.replace(/^https?:\/\//, '') : window.location.host
}

/**
 * Singleton Docker store shared by every useDocker() consumer.
 *
 * Previously each component called useDocker() and got its own stats/logs
 * state, which meant (a) TerminalVitals never saw the WS stats streamed by
 * the HUD or RemoteBridge and fell back to REST polling every 2s, and
 * (b) stream start/stop on one tab silently tore down the other tab's
 * stream because stopStatsStream used to also stop the log stream.
 *
 * This store centralises state and WS lifecycle: the first consumer to ask
 * for a stream starts it, the last consumer to unsubscribe stops it, and all
 * consumers see the same stats/logs/inspect/volumes.
 */
const store = {
  state: {
    loading: false,
    error: null,
    logs: [],
    stats: null,
    inspect: null,
    volumes: [],
  },
  listeners: new Set(),

  _statsSubs: new Set(),
  _logsSubs: new Set(),
  statsStreamRef: null,
  logStreamRef: null,
  statsReconnect: { id: null, attempts: 0, stopped: false },
  logReconnect: { id: null, attempts: 0, stopped: false },

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  },

  emit() {
    this.listeners.forEach((l) => l())
  },

  getSnapshot() {
    return this.state
  },

  patch(partial) {
    this.state = { ...this.state, ...partial }
    this.emit()
  },

  setLoading(v) { this.patch({ loading: v }) },
  setError(v) { this.patch({ error: v }) },
  setStats(v) { this.patch({ stats: v }) },
  setLogs(updater) {
    const next = typeof updater === 'function' ? updater(this.state.logs) : updater
    this.patch({ logs: next })
  },
  setInspect(v) { this.patch({ inspect: v }) },
  setVolumes(v) { this.patch({ volumes: v }) },
}

const _terminalDebug = () => false

function streamFileFrame(data) {
  if (!data) return
  if (data && data.type === 'ping') return
  if (data && typeof data.line !== 'undefined') {
    store.setLogs((prev) => [...prev.slice(-500), data.line])
  } else if (data && typeof data.cpu_percent !== 'undefined') {
    store.setStats(data)
  }
}

function startStatsStream(containerId) {
  store.statsReconnect.stopped = false
  store.statsReconnect.attempts = 0

  const connect = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//${getWsHost()}/ws/stats/${containerId}`)

    ws.onopen = () => {
      store.statsReconnect.attempts = 0
    }

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch (e) {
        return
      }
      if (data && data.type === 'ping') return
      if (data && typeof data.cpu_percent !== 'undefined') {
        store.setStats(data)
      }
    }

    ws.onclose = () => {
      if (store.statsStreamRef === ws) store.statsStreamRef = null
      if (store.statsReconnect.stopped) return
      store.statsReconnect.attempts += 1
      const delay = Math.min(1000 * 2 ** store.statsReconnect.attempts, 30000)
      store.statsReconnect.id = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      try { ws.close() } catch (e) {}
    }

    store.statsStreamRef = ws
  }

  connect()
}

function stopStatsStream() {
  store.statsReconnect.stopped = true
  if (store.statsReconnect.id) {
    clearTimeout(store.statsReconnect.id)
    store.statsReconnect.id = null
  }
  if (store.statsStreamRef) {
    try { store.statsStreamRef.close() } catch (e) {}
    store.statsStreamRef = null
  }
}

function startLogsStream(containerId) {
  store.logReconnect.stopped = false
  store.logReconnect.attempts = 0

  const connect = () => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//${getWsHost()}/ws/logs/${containerId}`)

    ws.onopen = () => {
      store.logReconnect.attempts = 0
    }

    ws.onmessage = (event) => {
      let data
      try {
        data = JSON.parse(event.data)
      } catch (e) {
        return
      }
      if (data && data.type === 'ping') return
      if (data && typeof data.line !== 'undefined') {
        store.setLogs((prev) => [...prev.slice(-500), data.line])
      }
    }

    ws.onclose = () => {
      if (store.logStreamRef === ws) store.logStreamRef = null
      if (store.logReconnect.stopped) return
      store.logReconnect.attempts += 1
      const delay = Math.min(1000 * 2 ** store.logReconnect.attempts, 30000)
      store.logReconnect.id = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      try { ws.close() } catch (e) {}
    }

    store.logStreamRef = ws
  }

  connect()
}

function stopLogsStream() {
  store.logReconnect.stopped = true
  if (store.logReconnect.id) {
    clearTimeout(store.logReconnect.id)
    store.logReconnect.id = null
  }
  if (store.logStreamRef) {
    try { store.logStreamRef.close() } catch (e) {}
    store.logStreamRef = null
  }
}

function _stopStatsStream() {
  store.statsReconnect.stopped = true
  if (store.statsReconnect.id) {
    clearTimeout(store.statsReconnect.id)
    store.statsReconnect.id = null
  }
  if (store.statsStreamRef) {
    try { store.statsStreamRef.close() } catch (e) {}
    store.statsStreamRef = null
  }
}

export function useDocker() {
  const snapshot = useSyncExternalStore(
    store.subscribe.bind(store),
    store.getSnapshot.bind(store)
  )

  const statsKeyRef = useRef(null)
  const logsKeyRef = useRef(null)

  const executeAction = useCallback(async (containerId, action) => {
    store.setLoading(true)
    store.setError(null)
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/${action}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Action ${action} failed`)
      }
      return await response.json()
    } catch (err) {
      store.setError(err.message)
      throw err
    } finally {
      store.setLoading(false)
    }
  }, [])

  const startContainer = useCallback((containerId) =>
    executeAction(containerId, 'start'), [executeAction])
  const stopContainer = useCallback((containerId) =>
    executeAction(containerId, 'stop'), [executeAction])
  const killContainer = useCallback((containerId) =>
    executeAction(containerId, 'kill'), [executeAction])
  const restartContainer = useCallback((containerId) =>
    executeAction(containerId, 'restart'), [executeAction])
  const pauseContainer = useCallback((containerId) =>
    executeAction(containerId, 'pause'), [executeAction])
  const unpauseContainer = useCallback((containerId) =>
    executeAction(containerId, 'unpause'), [executeAction])

  const fetchLogs = useCallback(async (containerId, tail = 100) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/logs?tail=${tail}`)
      const data = await response.json()
      store.setLogs(data.logs || [])
      return data.logs || []
    } catch (err) {
      store.setError(err.message)
      return []
    }
  }, [])

  const streamLogs = useCallback((containerId) => {
    if (logsKeyRef.current === containerId) return () => {}
    logsKeyRef.current = containerId
    startLogsStream(containerId)
    store._logsSubs.add(containerId)
    return () => {
      store._logsSubs.delete(containerId)
      if (logsKeyRef.current === containerId) logsKeyRef.current = null
      if (!store._logsSubs.has(containerId)) {
        stopLogsStream()
      }
    }
  }, [])

  const stopLogStream = useCallback(() => {
    logsKeyRef.current = null
    store._logsSubs.clear()
    stopLogsStream()
  }, [])

  const fetchStats = useCallback(async (containerId) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/stats`)
      const data = await response.json()
      store.setStats(data)
      return data
    } catch (err) {
      store.setError(err.message)
      return null
    }
  }, [])

  const streamStats = useCallback((containerId) => {
    if (statsKeyRef.current === containerId) return () => {}
    statsKeyRef.current = containerId
    startStatsStream(containerId)
    store._statsSubs.add(containerId)
    return () => {
      store._statsSubs.delete(containerId)
      if (statsKeyRef.current === containerId) statsKeyRef.current = null
      if (!store._statsSubs.has(containerId)) {
        _stopStatsStream()
      }
    }
  }, [])

  const stopStatsStream = useCallback(() => {
    statsKeyRef.current = null
    store._statsSubs.clear()
    _stopStatsStream()
  }, [])

  const fetchInspect = useCallback(async (containerId) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/inspect`)
      const data = await response.json()
      store.setInspect(data)
      return data
    } catch (err) {
      store.setError(err.message)
      return null
    }
  }, [])

  const fetchVolumes = useCallback(async (containerId) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/volumes`)
      const data = await response.json()
      store.setVolumes(data.volumes || [])
      return data.volumes || []
    } catch (err) {
      store.setError(err.message)
      return []
    }
  }, [])

  const execCommand = useCallback(async (containerId, command) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: command })
      })
      return await response.json()
    } catch (err) {
      store.setError(err.message)
      return { error: err.message }
    }
  }, [])

  const openTerminal = useCallback((containerId, callbacks = {}) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${getWsHost()}/ws/terminal/${containerId}`

    const ws = new WebSocket(wsUrl)

    if (callbacks.onOpen) ws.onopen = callbacks.onOpen
    if (callbacks.onError) ws.onerror = callbacks.onError
    if (callbacks.onClose) ws.onclose = callbacks.onClose

    ws.onmessage = (event) => {
      if (!callbacks.onData) return

      // Filter backend {"type":"ping"} heartbeat frames so they don't render
      // as literal text in the xterm terminal.
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data)
          if (parsed && parsed.type === 'ping') return
        } catch (e) {
          // Not JSON — fall through and treat as terminal data.
        }
        logFrame('text', event.data.length)
        callbacks.onData(event.data)
      } else if (event.data instanceof Blob) {
        event.data.arrayBuffer().then((buf) => {
          logFrame('bin', buf.byteLength)
          callbacks.onData(decodeBytes(new Uint8Array(buf)))
        })
      } else if (event.data instanceof ArrayBuffer) {
        logFrame('bin', event.data.byteLength)
        callbacks.onData(decodeBytes(new Uint8Array(event.data)))
      }
    }

    return {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
          return true
        }
        return false
      },
      close: () => ws.close()
    }
  }, [])

  // Best-effort: stop any streams the local consumer was responsible for on
  // unmount. The shared store's ref-counting in streamStats/streamLogs handles
  // the case where another consumer still wants the stream, so this is safe.
  useEffect(() => {
    return () => {
      if (statsKeyRef.current) {
        store._statsSubs.delete(statsKeyRef.current)
        statsKeyRef.current = null
        if (store._statsSubs.size === 0) stopStatsStream()
      }
      if (logsKeyRef.current) {
        store._logsSubs.delete(logsKeyRef.current)
        logsKeyRef.current = null
        if (store._logsSubs.size === 0) stopLogsStream()
      }
    }
  }, [])

  return {
    loading: snapshot.loading,
    error: snapshot.error,
    logs: snapshot.logs,
    stats: snapshot.stats,
    inspect: snapshot.inspect,
    volumes: snapshot.volumes,
    startContainer,
    stopContainer,
    killContainer,
    restartContainer,
    pauseContainer,
    unpauseContainer,
    fetchLogs,
    streamLogs,
    stopLogStream,
    fetchStats,
    streamStats,
    stopStatsStream,
    fetchInspect,
    fetchVolumes,
    execCommand,
    openTerminal
  }
}
