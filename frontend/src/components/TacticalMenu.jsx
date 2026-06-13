import { useState, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import { useDocker } from '../hooks/useDocker'
import SensorPanel from './SensorPanel'
import './TacticalMenu.css'

const quickRingActions = [
  { id: 'start', icon: '▶', label: 'Start', color: '#44ff88', key: 's' },
  { id: 'stop', icon: '■', label: 'Stop', color: '#ff4444', key: 'x' },
  { id: 'kill', icon: '✕', label: 'Kill', color: '#ff2222', key: 'k' },
  { id: 'restart', icon: '↻', label: 'Restart', color: '#ffaa44', key: 'r' },
  { id: 'pause', icon: '⏸', label: 'Pause', color: '#ffdd44', key: 'p' },
  { id: 'unpause', icon: '⏹', label: 'Unpause', color: '#44ddff', key: 'u' },
]

const navButtons = [
  { id: 'terminal', icon: '⌨', label: 'Remote Bridge', action: 'terminal' },
  { id: 'origin', icon: '📦', label: 'Origin Trace', action: 'origin' },
]

const tacticalVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  },
  exit: { 
    scale: 0, 
    opacity: 0,
    transition: { duration: 0.2 }
  }
}

const ringItemVariants = {
  hidden: { scale: 0, opacity: 0, x: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: { type: 'spring', stiffness: 400, damping: 15 }
  }
}

export default function TacticalMenu({ 
  container, 
  onClose
}) {
  const [activeTab, setActiveTab] = useState('stats')
  const [showSensorPanel, setShowSensorPanel] = useState(false)
  const {
    loading,
    error,
    startContainer,
    stopContainer,
    killContainer,
    restartContainer,
    pauseContainer,
    unpauseContainer,
    fetchLogs,
    fetchStats,
    fetchInspect,
    fetchVolumes,
    streamStats,
    stopStatsStream,
    logs,
    stats,
    inspect,
    volumes
  } = useDocker()

  useEffect(() => {
    if (container) {
      fetchInspect(container.id)
      fetchVolumes(container.id)
      const unsubStats = streamStats(container.id)
      
      return () => {
        stopStatsStream()
      }
    }
  }, [container?.id])

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(container?.id)
    } else if (activeTab === 'stats') {
      streamStats(container?.id)
    } else if (activeTab === 'inspect') {
      fetchInspect(container?.id)
    } else if (activeTab === 'volumes') {
      fetchVolumes(container?.id)
    }
  }, [activeTab, container?.id])

  const handleAction = async (action) => {
    try {
      switch (action) {
        case 'start':
          await startContainer(container.id)
          break
        case 'stop':
          await stopContainer(container.id)
          break
        case 'kill':
          await killContainer(container.id)
          break
        case 'restart':
          await restartContainer(container.id)
          break
        case 'pause':
          await pauseContainer(container.id)
          break
        case 'unpause':
          await unpauseContainer(container.id)
          break
      }
    } catch (err) {
      console.error('Action failed:', err)
    }
  }

  const handleNav = (action) => {
    switch (action) {
      case 'terminal':
        window.open(`/terminal/${container.id}`, '_blank')
        break
      case 'origin':
        const imageName = container.image
        window.open(`https://hub.docker.com/r/${imageName}`, '_blank')
        break
    }
  }

  const isRunning = container?.status === 'running'
  const isPaused = container?.status === 'paused'

  return (
    <Html
      position={[0, 2.5, 0]}
      center
      style={{ pointerEvents: 'auto' }}
    >
      <motion.div
        className="tactical-menu"
        variants={tacticalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="tactical-header">
          <div className="header-content">
            <span className="container-name">{container?.name}</span>
            <span className={`status-indicator ${container?.status}`}>
              {container?.status}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="quick-ring-container">
          <div className="quick-ring">
            {quickRingActions.map((action, index) => {
              const angle = (index / quickRingActions.length) * 2 * Math.PI - Math.PI / 2
              const radius = 70
              const x = Math.cos(angle) * radius
              const y = Math.sin(angle) * radius
              
              const isDisabled = (action.id === 'start' || action.id === 'unpause') && !isRunning &&
                               action.id !== 'stop' && action.id !== 'pause'
              const isActive = (action.id === 'start' || action.id === 'unpause') && isRunning ||
                              (action.id === 'stop' || action.id === 'pause') && !isRunning

              return (
                <motion.button
                  key={action.id}
                  className={`ring-btn ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                  style={{
                    '--ring-color': action.color,
                    transform: `translate(${x}px, ${y}px)`
                  }}
                  variants={ringItemVariants}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => !isDisabled && handleAction(action.id)}
                  title={`${action.label} (${action.key})`}
                >
                  <span className="ring-icon">{action.icon}</span>
                  <span className="ring-tooltip">{action.label}</span>
                </motion.button>
              )
            })}
            <div className="ring-center">
              <span className="ring-icon-center">⚡</span>
            </div>
          </div>
        </div>

        <motion.div 
          className="nav-buttons"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {navButtons.map((nav) => (
            <button
              key={nav.id}
              className="nav-btn"
              onClick={() => handleNav(nav.action)}
              title={nav.label}
            >
              <span className="nav-icon">{nav.icon}</span>
              <span className="nav-label">{nav.label}</span>
            </button>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ delay: 0.4 }}
        >
          <button 
            className="sensor-toggle"
            onClick={() => setShowSensorPanel(!showSensorPanel)}
          >
            <span>📡 Sensor Suite</span>
            <span className="toggle-icon">{showSensorPanel ? '▲' : '▼'}</span>
          </button>
          
          <AnimatePresence>
            {showSensorPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SensorPanel
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  logs={logs}
                  stats={stats}
                  inspect={inspect}
                  volumes={volumes}
                  loading={loading}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {error && (
          <div className="error-banner">
            ⚠ {error}
          </div>
        )}
      </motion.div>
    </Html>
  )
}
