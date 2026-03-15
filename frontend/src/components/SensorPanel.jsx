import { useMemo } from 'react'
import { motion } from 'framer-motion'
import './SensorPanel.css'

const tabs = [
  { id: 'logs', icon: '📜', label: 'Logs' },
  { id: 'stats', icon: '📊', label: 'Stats' },
  { id: 'inspect', icon: '🔍', label: 'Inspect' },
  { id: 'volumes', icon: '💾', label: 'Volumes' },
]

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds) {
  if (!seconds) return 'N/A'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function MicroChart({ value, max = 100, color = '#00f2ff', type = 'bar' }) {
  const percentage = Math.min((value / max) * 100, 100)
  
  if (type === 'bar') {
    return (
      <div className="micro-bar">
        <div 
          className="micro-bar-fill" 
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
        <span className="micro-bar-value">{value?.toFixed(1)}%</span>
      </div>
    )
  }
  
  return (
    <div className="micro-sparkline">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.8" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M 0 30 ${Array.from({ length: 20 }, (_, i) => {
            const x = (i / 19) * 100
            const y = 30 - (Math.random() * percentage * 0.3)
            return `L ${x} ${y}`
          }).join(' ')} L 100 30 Z`}
          fill={`url(#spark-${color})`}
        />
      </svg>
      <span className="micro-sparkline-value">{value?.toFixed(1)}%</span>
    </div>
  )
}

function LogsTab({ logs }) {
  return (
    <div className="logs-container">
      <div className="logs-terminal">
        {logs.length === 0 ? (
          <div className="logs-empty">No logs available</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="log-line">
              <span className="log-line-number">{i + 1}</span>
              <span className="log-line-content">{log}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatsTab({ stats }) {
  const cpuHistory = useMemo(() => {
    return Array.from({ length: 20 }, () => Math.random() * (stats?.cpu_percent || 0))
  }, [stats?.cpu_percent])
  
  const memHistory = useMemo(() => {
    return Array.from({ length: 20 }, () => Math.random() * (stats?.memory_percent || 0))
  }, [stats?.memory_percent])

  return (
    <div className="stats-container">
      <div className="stat-row">
        <div className="stat-label">
          <span className="stat-icon">⚡</span>
          CPU
        </div>
        <div className="stat-chart">
          <MicroChart 
            value={stats?.cpu_percent || 0} 
            color={stats?.cpu_percent > 70 ? '#ff4444' : '#00f2ff'} 
          />
        </div>
      </div>
      
      <div className="stat-row">
        <div className="stat-label">
          <span className="stat-icon">🧠</span>
          Memory
        </div>
        <div className="stat-chart">
          <MicroChart 
            value={stats?.memory_percent || 0} 
            color={stats?.memory_percent > 80 ? '#ff4444' : '#8a2be2'} 
          />
        </div>
      </div>
      
      <div className="stat-details">
        <div className="stat-detail">
          <span className="detail-label">Network RX</span>
          <span className="detail-value">{formatBytes(stats?.network_rx)}</span>
        </div>
        <div className="stat-detail">
          <span className="detail-label">Network TX</span>
          <span className="detail-value">{formatBytes(stats?.network_tx)}</span>
        </div>
        <div className="stat-detail">
          <span className="detail-label">Block Read</span>
          <span className="detail-value">{formatBytes(stats?.block_read)}</span>
        </div>
        <div className="stat-detail">
          <span className="detail-label">Block Write</span>
          <span className="detail-value">{formatBytes(stats?.block_write)}</span>
        </div>
      </div>
    </div>
  )
}

function InspectTab({ inspect }) {
  if (!inspect) {
    return <div className="inspect-loading">Loading...</div>
  }

  const infoSections = [
    { title: 'Container', items: [
      { label: 'ID', value: inspect.Id?.substring(0, 12) },
      { label: 'Name', value: inspect.Name?.replace('/', '') },
      { label: 'Created', value: new Date(inspect.Created).toLocaleString() },
      { label: 'Status', value: inspect.State?.Status },
    ]},
    { title: 'Image', items: [
      { label: 'Repository', value: inspect.Config?.Image },
      { label: 'Cmd', value: inspect.Config?.Cmd?.join(' ') },
      { label: 'Entrypoint', value: inspect.Config?.Entrypoint?.join(' ') },
    ]},
    { title: 'Network', items: [
      { label: 'IP Address', value: inspect.NetworkSettings?.IPAddress || 'N/A' },
      { label: 'Gateway', value: inspect.NetworkSettings?.Gateway || 'N/A' },
      { label: 'Ports', value: Object.entries(inspect.NetworkSettings?.Ports || {}).map(
        ([port, bindings]) => `${port} → ${bindings?.[0]?.HostPort || 'none'}`
      ).join(', ') || 'None' },
    ]},
  ]

  return (
    <div className="inspect-container">
      {infoSections.map((section) => (
        <div key={section.title} className="inspect-section">
          <div className="inspect-section-title">{section.title}</div>
          {section.items.map((item) => (
            <div key={item.label} className="inspect-item">
              <span className="inspect-key">{item.label}</span>
              <span className="inspect-value">{item.value || 'N/A'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function VolumesTab({ volumes }) {
  return (
    <div className="volumes-container">
      {volumes.length === 0 ? (
        <div className="volumes-empty">No volumes mounted</div>
      ) : (
        volumes.map((vol, i) => (
          <div key={i} className="volume-item">
            <span className="volume-icon">💿</span>
            <div className="volume-details">
              <span className="volume-source">{vol.Source}</span>
              <span className="volume-dest">{vol.Destination}</span>
            </div>
            <span className="volume-mode">{vol.Mode}</span>
          </div>
        ))
      )}
    </div>
  )
}

export default function SensorPanel({ activeTab, onTabChange, logs, stats, inspect, volumes, loading }) {
  return (
    <motion.div 
      className="sensor-panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="sensor-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`sensor-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      
      <div className="sensor-content">
        {loading && <div className="sensor-loading">Loading...</div>}
        {!loading && activeTab === 'logs' && <LogsTab logs={logs} />}
        {!loading && activeTab === 'stats' && <StatsTab stats={stats} />}
        {!loading && activeTab === 'inspect' && <InspectTab inspect={inspect} />}
        {!loading && activeTab === 'volumes' && <VolumesTab volumes={volumes} />}
      </div>
    </motion.div>
  )
}
