import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, RefreshCw, PowerOff, Pause, Activity, FileText, Database, Info, Terminal, GitBranch, X } from 'lucide-react'
import { useDocker } from '../hooks/useDocker'
import {
  formatHealth,
  formatUptime,
  formatResources,
  extractCompose,
  extractNetworks,
  extractPorts,
  extractCommand,
  extractMountsSummary,
} from './inspect/formatInspect'
import './HolographicHUD.css'

const TONE_COLORS = {
  ok: '#00ff88',
  warn: '#ffaa00',
  critical: '#ff3300',
  neutral: '#88aacc',
}

const bytesToHuman = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const SectionHeader = ({ children }) => (
  <div style={{
    color: '#8a2be2',
    fontSize: '10px',
    fontWeight: 'bold',
    letterSpacing: '1px',
    marginTop: '14px',
    marginBottom: '6px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    paddingBottom: '4px',
  }}>{children}</div>
)

const InspectRow = ({ label, value, tone }) => (
  <div className="inspect-item">
    <span className="inspect-key">{label}</span>
    <span className="inspect-val" style={tone ? { color: TONE_COLORS[tone] } : undefined}>{value || 'N/A'}</span>
  </div>
)

const ResourceBar = ({ label, pct, value, limit, color }) => (
  <div className="stat-row">
    <span className="stat-label">{label}</span>
    <div className="stat-bar-container">
      <div className={`stat-bar ${pct !== null && pct > 80 ? 'critical' : pct !== null && pct > 50 ? 'high' : ''}`}
        style={{ width: `${Math.min(100, pct || 0)}%`, background: color }}></div>
    </div>
    <span className="stat-value">{pct !== null ? `${pct.toFixed(1)}%` : 'no limit'}</span>
  </div>
)

function InspectView({ inspect, stats }) {
  const health = formatHealth(inspect)
  const uptime = formatUptime(inspect)
  const resources = formatResources(inspect, stats)
  const compose = extractCompose(inspect)
  const networks = extractNetworks(inspect)
  const ports = extractPorts(inspect)
  const command = extractCommand(inspect)
  const mounts = extractMountsSummary(inspect)
  const state = inspect?.State || {}
  const cfg = inspect?.Config || {}

  const memLimitLabel = resources.memory.unlimited ? 'unlimited' : bytesToHuman(resources.memory.limitBytes)
  const memUsedLabel = resources.memory.usedBytes !== null ? bytesToHuman(resources.memory.usedBytes) : null

  return (
    <div style={{ padding: '10px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <span style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: TONE_COLORS[health.tone],
          boxShadow: `0 0 8px ${TONE_COLORS[health.tone]}`,
        }} />
        <span style={{ color: TONE_COLORS[health.tone], fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>
          {health.label}
        </span>
        {uptime && <span style={{ color: '#88aacc', fontSize: '10px' }}>up {uptime}</span>}
      </div>

      <SectionHeader>IDENTITY</SectionHeader>
      <InspectRow label="ID" value={String(inspect?.Id || '').substring(0, 12)} />
      <InspectRow label="Image" value={cfg.Image} />
      <InspectRow label="Created" value={inspect?.Created ? new Date(inspect.Created).toLocaleString() : null} />

      <SectionHeader>LIFECYCLE</SectionHeader>
      <InspectRow label="Status" value={state.Status} />
      <InspectRow label="Restarts" value={state.RestartCount !== undefined ? String(state.RestartCount) : null} />
      {state.ExitCode !== undefined && state.ExitCode !== 0 && (
        <InspectRow label="Exit Code" value={String(state.ExitCode)} tone="critical" />
      )}
      {state.OOMKilled && <InspectRow label="OOM Killed" value="yes" tone="critical" />}
      {state.Error && <InspectRow label="Error" value={state.Error} tone="critical" />}

      <SectionHeader>RESOURCES</SectionHeader>
      <ResourceBar label="MEM" pct={resources.memory.pct} value={memUsedLabel} limit={memLimitLabel} color="#8a2be2" />
      <InspectRow label="Mem Limit" value={memLimitLabel} />
      {memUsedLabel && <InspectRow label="Mem Used" value={memUsedLabel} />}
      <ResourceBar label="CPU" pct={resources.cpu.pct} value={null} limit={resources.cpu.cores ? `${resources.cpu.cores} core${resources.cpu.cores !== 1 ? 's' : ''}` : 'unlimited'} color="#00f2ff" />
      {resources.cpu.cores > 0 && <InspectRow label="CPU Limit" value={`${resources.cpu.cores} core${resources.cpu.cores !== 1 ? 's' : ''}`} />}

      {compose && (
        <>
          <SectionHeader>CONSTELLATION</SectionHeader>
          {compose.project && <InspectRow label="Project" value={compose.project} />}
          {compose.service && <InspectRow label="Service" value={compose.service} />}
          {compose.containerNumber !== null && <InspectRow label="Replica" value={compose.containerNumber} />}
        </>
      )}

      <SectionHeader>NETWORK</SectionHeader>
      {networks.length === 0 ? (
        <InspectRow label="Networks" value="none" />
      ) : (
        networks.map((n) => (
          <InspectRow key={n.name} label={n.name} value={n.ip || n.gateway || 'no IP'} />
        ))
      )}
      {ports.length > 0 && (
        <>
          {ports.map((p, i) => (
            <InspectRow
              key={`${p.container}-${p.host}-${i}`}
              label={p.host ? `:${p.host}` : 'exposed'}
              value={p.container ? `${p.container}/${p.protocol}${p.host ? ` → host ${p.ip || '0.0.0.0'}` : ''}` : 'N/A'}
            />
          ))}
        </>
      )}

      {command && (
        <>
          <SectionHeader>COMMAND</SectionHeader>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#66ccff',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>{command}</div>
        </>
      )}

      {mounts.length > 0 && (
        <>
          <SectionHeader>MOUNTS</SectionHeader>
          {mounts.map((m, i) => (
            <InspectRow key={i} label={m.type || 'mount'} value={`${m.source || '?'} → ${m.destination || '?'} (${m.rw ? 'rw' : 'ro'})`} />
          ))}
        </>
      )}
    </div>
  )
}

const TabLoading = ({ label = 'LOADING' }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '40px',
    color: '#00f2ff',
    fontFamily: 'monospace',
    fontSize: '12px',
    letterSpacing: '2px',
  }}>
    <span>{label}</span>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ repeat: Infinity, duration: 1, delay: i * 0.25 }}
      >.</motion.span>
    ))}
  </div>
)

const HolographicHUD = ({ container, onClose, onOpenBridge }) => {
  const [activeTab, setActiveTab] = useState('stats')
  const [showTerminal, setShowTerminal] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState([])
  const [terminalInput, setTerminalInput] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [tabLoading, setTabLoading] = useState(false)
  
  const docker = useDocker()
  const logsEndRef = useRef(null)
  const terminalEndRef = useRef(null)
  const loadedTabsRef = useRef({})

  const isRunning = container?.status === 'running'
  const isPaused = container?.status === 'paused'
  
  useEffect(() => {
    const loaded = loadedTabsRef.current[container.id] || new Set()
    const isFirst = !loaded.has(activeTab)
    const markLoaded = () => {
      loaded.add(activeTab)
      loadedTabsRef.current[container.id] = loaded
    }

    if (isFirst) setTabLoading(true)

    if (activeTab === 'logs') {
      docker.fetchLogs(container.id).then(() => {
        docker.streamLogs(container.id)
        if (isFirst) {
          setTabLoading(false)
          markLoaded()
        }
      })
    } else {
      docker.stopLogStream()
    }
    
    if (activeTab === 'stats') {
      docker.fetchStats(container.id).then(() => {
        docker.streamStats(container.id)
        if (isFirst) {
          setTabLoading(false)
          markLoaded()
        }
      })
    } else {
      docker.stopStatsStream()
    }
    
    if (activeTab === 'inspect') {
      docker.fetchInspect(container.id).then(() => {
        if (isFirst) {
          setTabLoading(false)
          markLoaded()
        }
      })
    }
    
    if (activeTab === 'volumes') {
      docker.fetchVolumes(container.id).then(() => {
        if (isFirst) {
          setTabLoading(false)
          markLoaded()
        }
      })
    }

    if (activeTab === 'ai') {
      if (isFirst) {
        setTabLoading(false)
        setIsSummarizing(true)
        fetch(`/api/containers/${container.id}/ai-logs`)
          .then(res => res.json())
          .then(data => {
            setAiSummary(data.summary)
            setIsSummarizing(false)
            markLoaded()
          })
      }
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
    if (tabLoading) {
      return <TabLoading label="LOADING" />
    }

    if (docker.loading && activeTab !== 'logs' && activeTab !== 'stats') {
      return <TabLoading label="GATHERING TELEMETRY" />
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
        return <InspectView inspect={docker.inspect} stats={docker.stats} />
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
