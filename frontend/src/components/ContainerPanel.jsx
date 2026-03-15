import { useMemo } from 'react'
import './ContainerPanel.css'

function ContainerPanel({ container, onClose }) {
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const uptime = useMemo(() => {
    if (container.created) {
      const created = new Date(container.created * 1000)
      const now = new Date()
      const diff = Math.floor((now - created) / 1000)
      
      if (diff < 60) return `${diff}s`
      if (diff < 3600) return `${Math.floor(diff / 60)}m`
      if (diff < 86400) return `${Math.floor(diff / 3600)}h`
      return `${Math.floor(diff / 86400)}d`
    }
    return 'Unknown'
  }, [container.created])

  const cpuColor = useMemo(() => {
    if (container.cpu_percent > 70) return '#ff4444'
    if (container.cpu_percent > 40) return '#ffaa44'
    return '#44ff88'
  }, [container.cpu_percent])

  const memColor = useMemo(() => {
    if (container.memory_percent > 80) return '#ff4444'
    if (container.memory_percent > 50) return '#ffaa44'
    return '#44ff88'
  }, [container.memory_percent])

  return (
    <div className="panel-overlay">
      <div className="container-panel">
        <div className="panel-header">
          <h2>{container.name}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="panel-content">
          <div className="info-row">
            <span className="label">ID</span>
            <span className="value">{container.id}</span>
          </div>
          
          <div className="info-row">
            <span className="label">Image</span>
            <span className="value">{container.image}</span>
          </div>
          
          <div className="info-row">
            <span className="label">Status</span>
            <span className={`status-badge ${container.status}`}>
              {container.status}
            </span>
          </div>
          
          <div className="info-row">
            <span className="label">Uptime</span>
            <span className="value">{uptime}</span>
          </div>
          
          <div className="metrics-section">
            <h3>Metrics</h3>
            
            <div className="metric">
              <div className="metric-header">
                <span>CPU</span>
                <span style={{ color: cpuColor }}>{container.cpu_percent?.toFixed(1)}%</span>
              </div>
              <div className="metric-bar">
                <div 
                  className="metric-fill cpu" 
                  style={{ 
                    width: `${Math.min(container.cpu_percent || 0, 100)}%`,
                    backgroundColor: cpuColor
                  }}
                />
              </div>
            </div>
            
            <div className="metric">
              <div className="metric-header">
                <span>Memory</span>
                <span style={{ color: memColor }}>{container.memory_percent?.toFixed(1)}%</span>
              </div>
              <div className="metric-bar">
                <div 
                  className="metric-fill memory" 
                  style={{ 
                    width: `${Math.min(container.memory_percent || 0, 100)}%`,
                    backgroundColor: memColor
                  }}
                />
              </div>
              <div className="metric-detail">
                {formatBytes(container.memory_usage)}
              </div>
            </div>
            
            <div className="network-stats">
              <div className="network-item">
                <span className="arrow">↓</span>
                <span>{formatBytes(container.network_rx)}</span>
              </div>
              <div className="network-item">
                <span className="arrow">↑</span>
                <span>{formatBytes(container.network_tx)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContainerPanel
