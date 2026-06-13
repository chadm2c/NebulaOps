import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, RefreshCw, PowerOff, Pause, Activity, FileText, Database, Info, Terminal, GitBranch, X } from 'lucide-react'
import { useDocker } from '../hooks/useDocker'
import './HolographicHUD.css'

const HolographicHUD = ({ container, onClose, onOpenBridge }) => {
  const [activeTab, setActiveTab] = useState('stats')
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState([])
  const [terminalInput, setTerminalInput] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  
  const docker = useDocker()
  const logsEndRef = useRef(null)
  const terminalEndRef = useRef(null)

  const isRunning = container?.status === 'running'
  const isPaused = container?.status === 'paused'
  
  useEffect(() => {
    if (activeTab === 'logs') {
      docker.fetchLogs(container.id).then(() => {
        docker.streamLogs(container.id)
      })
    } else {
      docker.stopLogStream()
    }
    
    if (activeTab === 'stats') {
      docker.fetchStats(container.id).then(() => {
        docker.streamStats(container.id)
      })
    } else {
      docker.stopStatsStream()
    }
    
    if (activeTab === 'inspect') {
      docker.fetchInspect(container.id)
    }
    
    if (activeTab === 'volumes') {
      docker.fetchVolumes(container.id)
    }

    if (activeTab === 'ai') {
      setIsSummarizing(true)
      fetch(`/api/containers/${container.id}/ai-logs`)
        .then(res => res.json())
        .then(data => {
          setAiSummary(data.summary)
          setIsSummarizing(false)
        })
    }

    return () => {
      docker.stopLogStream()
      docker.stopStatsStream()
    }
  }, [container.id, activeTab])

  useEffect(() => {
    if (terminalEndRef.current && showTerminal) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [terminalOutput, showTerminal])

  const handleTerminalSubmit = async (e) => {
    if (e.key === 'Enter' && terminalInput.trim()) {
      const cmd = terminalInput.trim()
      setTerminalOutput(prev => [...prev, `> ${cmd}`])
      setTerminalInput('')
      
      try {
        const result = await docker.execCommand(container.id, cmd)
        if (result.error) {
          setTerminalOutput(prev => [...prev, `Error: ${result.error}`])
        } else {
          setTerminalOutput(prev => [...prev, result.output || '(No output)'])
        }
      } catch (err) {
        setTerminalOutput(prev => [...prev, `Execution failed: ${err.message}`])
      }
    }
  }

  const handleAction = async (action) => {
    try {
      switch(action) {
        case 'start': await docker.startContainer(container.id); break;
        case 'stop': await docker.stopContainer(container.id); break;
        case 'restart': await docker.restartContainer(container.id); break;
        case 'kill': await docker.killContainer(container.id); break;
        case 'pause': await docker.pauseContainer(container.id); break;
        case 'unpause': await docker.unpauseContainer(container.id); break;
        default: break;
      }
    } catch (e) {
      console.error(e)
    }
  }

  const renderTabContent = () => {
    if (docker.loading && activeTab !== 'logs' && activeTab !== 'stats') {
      return <div style={{ textAlign: 'center', marginTop: '40px', color: '#00f2ff' }}>Gathering Telemetry...</div>
    }

    switch (activeTab) {
      case 'logs':
        return (
          <>
            {docker.logs.map((log, i) => {
              const parseType = (l) => {
                if (l.toLowerCase().includes('error')) return 'error'
                if (l.toLowerCase().includes('warn')) return 'warn'
                return 'info'
              }
              return <div key={i} className={`log-line ${parseType(log)}`}>{log}</div>
            })}
            <div ref={logsEndRef} />
          </>
        )
      case 'stats': {
        const cpu = docker.stats?.cpu_percent || container.cpu_percent || 0
        const memMode = docker.stats?.memory_percent || container.memory_percent || 0
        const rx = ((docker.stats?.network_rx || container.network_rx || 0) / 1024 / 1024).toFixed(2)
        const tx = ((docker.stats?.network_tx || container.network_tx || 0) / 1024 / 1024).toFixed(2)
        
        return (
          <div style={{ padding: '10px' }}>
            <div className="stat-row">
              <span className="stat-label">CPU</span>
              <div className="stat-bar-container">
                <div className={`stat-bar ${cpu > 80 ? 'critical' : cpu > 50 ? 'high' : ''}`} style={{ width: `${Math.min(100, cpu)}%` }}></div>
              </div>
              <span className="stat-value">{cpu.toFixed(1)}%</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">MEM</span>
              <div className="stat-bar-container">
                <div className={`stat-bar ${memMode > 80 ? 'critical' : memMode > 50 ? 'high' : ''}`} style={{ width: `${Math.min(100, memMode)}%` }}></div>
              </div>
              <span className="stat-value">{memMode.toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
              <div style={{ color: '#8a2be2', marginBottom: '10px', fontSize: '12px' }}>Network Interface</div>
              <div className="inspect-item"><span className="inspect-key">RX Data</span><span className="inspect-val">{rx} MB</span></div>
              <div className="inspect-item"><span className="inspect-key">TX Data</span><span className="inspect-val">{tx} MB</span></div>
            </div>
          </div>
         )
      }
      case 'inspect':
        if (!docker.inspect) return <div>No data</div>
        return (
            <div>
              <div className="inspect-item"><span className="inspect-key">ID</span><span className="inspect-val">{String(docker.inspect.Id).substring(0, 12)}</span></div>
              <div className="inspect-item"><span className="inspect-key">Image</span><span className="inspect-val">{docker.inspect.Config?.Image}</span></div>
              <div className="inspect-item"><span className="inspect-key">Created</span><span className="inspect-val">{new Date(docker.inspect.Created).toLocaleString()}</span></div>
              <div className="inspect-item"><span className="inspect-key">State</span><span className="inspect-val">{docker.inspect.State?.Status}</span></div>
              <div className="inspect-item"><span className="inspect-key">IP Addr</span><span className="inspect-val">{
                 Object.values(docker.inspect.NetworkSettings?.Networks || {})[0]?.IPAddress || 'None'
              }</span></div>
            </div>
        )
      case 'volumes':
        if (!docker.volumes || docker.volumes.length === 0) return <div style={{ textAlign: 'center', marginTop: '40px', color: 'rgba(255,255,255,0.5)' }}>No active mounts detected</div>
        return (
          <div>
            {docker.volumes.map((v, i) => (
               <div key={i} className="volume-item">
                 <div className="volume-path">{v.Destination}</div>
                 <div className="volume-mode">{v.Source} ({v.Mode}) [{v.Type}]</div>
               </div>
            ))}
          </div>
        )
      case 'ai':
        return (
          <div style={{ padding: '10px' }}>
            <div style={{ 
              color: '#00f2ff', 
              fontSize: '12px', 
              fontWeight: 'bold', 
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Terminal size={14} /> AI SITUATION REPORT
            </div>
            {isSummarizing ? (
              <div className="summarizing-loader">
                <RefreshCw className="spin" size={20} />
                <span>Aggregating log streams...</span>
              </div>
            ) : (
              <div style={{ 
                color: '#fff', 
                fontSize: '11px', 
                lineHeight: '1.6',
                fontFamily: 'monospace',
                background: 'rgba(0, 242, 255, 0.05)',
                padding: '12px',
                borderLeft: '2px solid #00f2ff',
                whiteSpace: 'pre-wrap'
              }}>
                {aiSummary}
              </div>
            )}
            
            <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
               <div style={{ color: '#ff851b', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px' }}>ANOMALY SCAN</div>
               <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px' }}>
                 {container.cpu_percent > 80 ? 
                  "CRITICAL: CPU jitter detected. Thread starvation likely." : 
                  "Nominal: Periodic resource sweep complete. No jitter detected."}
               </div>
            </div>
          </div>
        )
      default: return null
    }
  }

  const handleRemote = (e) => {
    e.stopPropagation()
    onOpenBridge(container)
  }

  const handleOrigin = (e) => {
    e.stopPropagation()
    if(container.image) {
      window.open(`https://hub.docker.com/search?q=${container.image.split(':')[0]}`, '_blank')
    }
  }

  return (
    <motion.div 
      className="holographic-hud"
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={{ pointerEvents: 'none' }}
    >
      <div className="tactical-ring">
         {/* Action: Start / Stop */}
         <div 
           className="tactical-ring-btn"
           style={{ left: '50%', top: '-20px', transform: 'translateX(-50%)' }}
           title={isRunning ? "Stop" : "Start"}
           onClick={(e) => { e.stopPropagation(); handleAction(isRunning ? 'stop' : 'start') }}
         >
           {isRunning ? <Square size={16} /> : <Play size={16} />}
         </div>
         
         {/* Action: Restart */}
         <div 
           className="tactical-ring-btn"
           style={{ right: '-20px', top: '50%', transform: 'translateY(-50%)' }}
           title="Restart"
           onClick={(e) => { e.stopPropagation(); handleAction('restart') }}
         >
           <RefreshCw size={16} />
         </div>

         {/* Action: Kill */}
         <div 
           className="tactical-ring-btn danger"
           style={{ left: '50%', bottom: '-20px', transform: 'translateX(-50%)' }}
           title="Force Kill"
           onClick={(e) => { e.stopPropagation(); handleAction('kill') }}
         >
           <PowerOff size={16} />
         </div>

         {/* Action: Pause / Unpause */}
         <div 
           className="tactical-ring-btn warning"
           style={{ left: '-20px', top: '50%', transform: 'translateY(-50%)' }}
           title={isPaused ? "Unpause" : "Pause"}
           onClick={(e) => { e.stopPropagation(); handleAction(isPaused ? 'unpause' : 'pause') }}
         >
           {isPaused ? <Play size={16} /> : <Pause size={16} />}
         </div>

         {/* Action: Close */}
         <div 
           className="tactical-ring-btn close-btn"
           style={{ right: '15px', top: '15px', transform: 'translate(50%, -50%)', scale: 0.8 }}
           title="Close Dashboard"
           onClick={(e) => { e.stopPropagation(); onClose() }}
         >
           <X size={14} />
         </div>
      </div>

      <div className="sensor-suite" onClick={(e) => e.stopPropagation()}>
         <div className="sensor-tabs">
            <button className={`sensor-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}><Terminal size={12} style={{marginRight: '4px', verticalAlign: 'middle'}}/>Logs</button>
            <button className={`sensor-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}><Activity size={12} style={{marginRight: '4px', verticalAlign: 'middle'}}/>Stats</button>
             <button className={`sensor-tab ${activeTab === 'inspect' ? 'active' : ''}`} onClick={() => setActiveTab('inspect')}><FileText size={12} style={{marginRight: '4px', verticalAlign: 'middle'}}/>Inspect</button>
             <button className={`sensor-tab ${activeTab === 'volumes' ? 'active' : ''}`} onClick={() => setActiveTab('volumes')}><Database size={12} style={{marginRight: '4px', verticalAlign: 'middle'}}/>Vols</button>
             <button className={`sensor-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}><Info size={12} style={{marginRight: '4px', verticalAlign: 'middle'}}/>AI</button>
         </div>
         <div className="sensor-content">
            {showTerminal ? (
              <div className="remote-terminal">
                <div className="terminal-header">
                  <Terminal size={14} style={{marginRight: '8px'}}/>
                  <span>BRIDGE SESSION: {container.name}</span>
                </div>
                <div className="terminal-body">
                  {terminalOutput.map((line, i) => (
                    <div key={i} className="terminal-line">{line}</div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
                <div className="terminal-input-wrapper">
                  <span className="terminal-prompt">$</span>
                  <input 
                    type="text" 
                    className="terminal-input"
                    value={terminalInput}
                    onChange={(e) => setTerminalInput(e.target.value)}
                    onKeyDown={handleTerminalSubmit}
                    placeholder="Enter command..."
                    autoFocus
                  />
                </div>
              </div>
            ) : renderTabContent()}
         </div>
      </div>

      <div className="nav-actions" onClick={(e) => e.stopPropagation()}>
         <div className={`nav-btn ${showTerminal ? 'active' : ''}`} onClick={handleRemote}>
            <Terminal size={14} /> Remote Bridge
          </div>
          <div className="nav-btn" onClick={handleOrigin}>
           <GitBranch size={14} /> Origin Trace
         </div>
      </div>
    </motion.div>
  )
}

export default HolographicHUD
