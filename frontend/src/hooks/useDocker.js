import { useState, useCallback, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { decodeBytes, logFrame } from '../utils/terminalDebugger'

const API_URL = import.meta.env.VITE_API_URL || ''

function getWsHost() {
  return API_URL ? API_URL.replace(/^https?:\/\//, '') : window.location.host
}

let socket = null

export function useDocker() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState(null)
  const [inspect, setInspect] = useState(null)
  const [volumes, setVolumes] = useState([])
  const logStreamRef = useRef(null)
  const statsStreamRef = useRef(null)
  const logReconnectRef = useRef({ id: null, attempts: 0, stopped: false })
  const statsReconnectRef = useRef({ id: null, attempts: 0, stopped: false })

  const getSocket = useCallback(() => {
    if (!socket) {
      socket = io(API_URL, {
        transports: ['websocket'],
        autoConnect: false
      })
    }
    return socket
  }, [])

  const executeAction = useCallback(async (containerId, action) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/${action}`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Action ${action} failed`)
      }
      return await response.json()
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
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
      setLogs(data.logs || [])
      return data.logs || []
    } catch (err) {
      setError(err.message)
      return []
    }
  }, [])

  const streamLogs = useCallback((containerId) => {
    logReconnectRef.current.stopped = false
    logReconnectRef.current.attempts = 0

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${wsProtocol}//${getWsHost()}/ws/logs/${containerId}`)

      ws.onopen = () => {
        logReconnectRef.current.attempts = 0
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
          setLogs(prev => [...prev.slice(-500), data.line])
        }
      }

      ws.onclose = () => {
        if (logStreamRef.current === ws) logStreamRef.current = null
        if (logReconnectRef.current.stopped) return
        logReconnectRef.current.attempts += 1
        const delay = Math.min(1000 * 2 ** logReconnectRef.current.attempts, 30000)
        logReconnectRef.current.id = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        try { ws.close() } catch (e) {}
      }

      logStreamRef.current = ws
    }

    connect()
    return () => {
      logReconnectRef.current.stopped = true
      if (logReconnectRef.current.id) {
        clearTimeout(logReconnectRef.current.id)
        logReconnectRef.current.id = null
      }
      if (logStreamRef.current) {
        try { logStreamRef.current.close() } catch (e) {}
        logStreamRef.current = null
      }
    }
  }, [])

  const stopLogStream = useCallback(() => {
    logReconnectRef.current.stopped = true
    if (logReconnectRef.current.id) {
      clearTimeout(logReconnectRef.current.id)
      logReconnectRef.current.id = null
    }
    if (logStreamRef.current) {
      logStreamRef.current.close()
      logStreamRef.current = null
    }
  }, [])

  const fetchStats = useCallback(async (containerId) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/stats`)
      const data = await response.json()
      setStats(data)
      return data
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [])

  const streamStats = useCallback((containerId) => {
    statsReconnectRef.current.stopped = false
    statsReconnectRef.current.attempts = 0

    const connect = () => {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${wsProtocol}//${getWsHost()}/ws/stats/${containerId}`)

      ws.onopen = () => {
        statsReconnectRef.current.attempts = 0
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
          setStats(data)
        }
      }

      ws.onclose = () => {
        if (statsStreamRef.current === ws) statsStreamRef.current = null
        if (statsReconnectRef.current.stopped) return
        statsReconnectRef.current.attempts += 1
        const delay = Math.min(1000 * 2 ** statsReconnectRef.current.attempts, 30000)
        statsReconnectRef.current.id = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        try { ws.close() } catch (e) {}
      }

      statsStreamRef.current = ws
    }

    connect()
    return () => {
      statsReconnectRef.current.stopped = true
      if (statsReconnectRef.current.id) {
        clearTimeout(statsReconnectRef.current.id)
        statsReconnectRef.current.id = null
      }
      if (statsStreamRef.current) {
        try { statsStreamRef.current.close() } catch (e) {}
        statsStreamRef.current = null
      }
    }
  }, [])

  const stopStatsStream = useCallback(() => {
    statsReconnectRef.current.stopped = true
    if (statsReconnectRef.current.id) {
      clearTimeout(statsReconnectRef.current.id)
      statsReconnectRef.current.id = null
    }
    if (statsStreamRef.current) {
      statsStreamRef.current.close()
      statsStreamRef.current = null
    }
    logReconnectRef.current.stopped = true
    statsReconnectRef.current.stopped = true
    if (logReconnectRef.current.id) clearTimeout(logReconnectRef.current.id)
    if (statsReconnectRef.current.id) clearTimeout(statsReconnectRef.current.id)
  }, [])

  const fetchInspect = useCallback(async (containerId) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/inspect`)
      const data = await response.json()
      setInspect(data)
      return data
    } catch (err) {
      setError(err.message)
      return null
    }
  }, [])

  const fetchVolumes = useCallback(async (containerId) => {
    try {
      const response = await fetch(`${API_URL}/api/containers/${containerId}/volumes`)
      const data = await response.json()
      setVolumes(data.volumes || [])
      return data.volumes || []
    } catch (err) {
      setError(err.message)
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
      setError(err.message)
      return { error: err.message }
    }
  }, [])

  useEffect(() => {
    return () => {
      if (logStreamRef.current) logStreamRef.current.close()
      if (statsStreamRef.current) statsStreamRef.current.close()
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

      if (typeof event.data === 'string') {
        logFrame('text', event.data.length)
        callbacks.onData(event.data)
      } else if (event.data instanceof Blob) {
        // Sync decode via shared TextDecoder — avoids per-frame Promise/alloc
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

  return {
    loading,
    error,
    logs,
    stats,
    inspect,
    volumes,
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
