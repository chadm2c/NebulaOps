import { useState, useCallback, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const apiHost = API_URL.replace(/^https?:\/\//, '')
    const ws = new WebSocket(`${wsProtocol}//${apiHost}/ws/logs/${containerId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setLogs(prev => [...prev.slice(-500), data.line])
    }

    logStreamRef.current = ws
    return () => ws.close()
  }, [])

  const stopLogStream = useCallback(() => {
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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const apiHost = API_URL.replace(/^https?:\/\//, '')
    const ws = new WebSocket(`${wsProtocol}//${apiHost}/ws/stats/${containerId}`)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setStats(data)
    }

    statsStreamRef.current = ws
    return () => ws.close()
  }, [])

  const stopStatsStream = useCallback(() => {
    if (statsStreamRef.current) {
      statsStreamRef.current.close()
      statsStreamRef.current = null
    }
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
    const apiHost = API_URL.replace(/^https?:\/\//, '')
    const wsUrl = `${wsProtocol}//${apiHost}/ws/terminal/${containerId}`
    
    const ws = new WebSocket(wsUrl)
    
    if (callbacks.onOpen) ws.onopen = callbacks.onOpen
    if (callbacks.onError) ws.onerror = callbacks.onError
    if (callbacks.onClose) ws.onclose = callbacks.onClose
    
    ws.onmessage = (event) => {
      if (callbacks.onData) {
        if (event.data instanceof Blob) {
          const reader = new FileReader()
          reader.onload = () => callbacks.onData(reader.result)
          reader.readAsText(event.data)
        } else {
          callbacks.onData(event.data)
        }
      }
    }
    
    return {
      send: (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
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
