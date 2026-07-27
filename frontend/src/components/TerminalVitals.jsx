import React, { memo, useEffect, useState } from 'react'
import { useDocker } from '../hooks/useDocker'

const TerminalVitals = memo(function TerminalVitals({ containerId, active, sessionAlive }) {
  const docker = useDocker()
  const [cpu, setCpu] = useState(0)
  const [mem, setMem] = useState(0)

  // Stats flow in through the shared useDocker store (RemoteBridge subscribes
  // to the /ws/stats/{id} stream when active). No local 2s polling needed.
  useEffect(() => {
    if (!active) return
    docker.fetchStats(containerId)
  }, [containerId, active])

  useEffect(() => {
    if (!docker.stats) return
    setCpu(docker.stats?.cpu_percent ?? 0)
    setMem(docker.stats?.memory_percent ?? 0)
  }, [docker.stats])

  return (
    <>
      <aside className="vital-strip">
        <div className="vital-item">
          <div className="vital-label">CPU LOAD</div>
          <div className="vital-bar-track">
            <div className="vital-bar-fill" style={{ height: `${cpu}%` }}></div>
          </div>
          <div className="vital-value">{cpu.toFixed(1)}%</div>
        </div>
        <div className="vital-item">
          <div className="vital-label">MEM LOAD</div>
          <div className="vital-bar-track">
            <div className="vital-bar-fill" style={{ height: `${mem}%` }}></div>
          </div>
          <div className="vital-value">{mem.toFixed(1)}%</div>
        </div>
      </aside>

      <section className="command-history">
        <div className="history-title">SESSION METRICS</div>
        <div className="history-list">
          <div className="history-item" style={{ borderLeftColor: sessionAlive ? '#00ff88' : '#ff4444' }}>
            STATUS: {sessionAlive ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
          <div className="history-item">PTY: {sessionAlive ? 'REALTIME' : 'OFFLINE'}</div>
          <div className="history-item">ID: {containerId}</div>
        </div>
      </section>
    </>
  )
})

export default TerminalVitals
