import React, { useState } from 'react'
import { Brain, X, Shield, Zap, Activity, Box, GitBranch, Cpu, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './AIArchitectureExplainer.css'

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="metric-card" style={{ '--card-color': color }}>
      <Icon size={14} className="metric-icon" />
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  )
}

function HealthBadge({ health }) {
  const config = {
    healthy: { label: 'STABLE', color: '#00ff88', glow: 'rgba(0,255,136,0.4)' },
    degraded: { label: 'DEGRADED', color: '#ffaa00', glow: 'rgba(255,170,0,0.4)' },
    critical: { label: 'CRITICAL', color: '#ff3300', glow: 'rgba(255,51,0,0.4)' },
    empty: { label: 'EMPTY', color: '#666', glow: 'rgba(102,102,102,0.4)' },
  }
  const c = config[health] || config.empty
  return (
    <div className="health-badge" style={{ borderColor: c.color, boxShadow: `0 0 12px ${c.glow}` }}>
      <span className="health-dot" style={{ background: c.color }} />
      <span className="health-label" style={{ color: c.color }}>{c.label}</span>
    </div>
  )
}

function ClusterBar({ value }) {
  const color = value > 80 ? '#ff3300' : value > 50 ? '#ffaa00' : '#00ff88'
  return (
    <div className="cluster-bar-track">
      <div className="cluster-bar-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  )
}

function ClusterRow({ cluster }) {
  const dotColor = cluster.avg_cpu > 80 ? '#ff3300' : cluster.avg_cpu > 50 ? '#ffaa00' : '#00ff88'
  return (
    <motion.div
      className="cluster-row"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <span className="cluster-dot" style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }} />
      <span className="cluster-name">{cluster.name}</span>
      <span className="cluster-members">{cluster.members} node{cluster.members !== 1 ? 's' : ''}</span>
      <div className="cluster-metrics">
        <div className="cluster-metric">
          <Cpu size={10} />
          <ClusterBar value={cluster.avg_cpu} />
          <span className="cluster-pct">{cluster.avg_cpu}%</span>
        </div>
      </div>
    </motion.div>
  )
}

function AIArchitectureExplainer() {
  const [isOpen, setIsOpen] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleExplain = async () => {
    setLoading(true)
    setIsOpen(true)
    try {
      const res = await fetch('/api/ai/explain')
      const data = await res.json()
      setExplanation(data.explanation || '')
      setMetrics(data.metrics || null)
    } catch {
      setExplanation('Neural link failure. Could not aggregate architectural data.')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }

  const paragraphs = explanation.split('\n').filter(l => l.trim())

  return (
    <>
      <button className="ai-explain-trigger" onClick={handleExplain}>
        <Brain size={18} />
        <span>ANALYZE GALAXY</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="ai-explanation-modal"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
          >
            <div className="modal-header">
              <div className="modal-header-left">
                <Brain className="pulse-ai" size={18} color="#00f2ff" />
                <span>ARCHITECTURAL INTELLIGENCE</span>
              </div>
              <button className="modal-close" onClick={() => setIsOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {loading ? (
                <div className="ai-loader-container">
                  <div className="ai-scanner-line" />
                  <p>SCANNING SECTORS...</p>
                </div>
              ) : (
                <>
                  {metrics && (
                    <>
                      <div className="metrics-grid">
                        <MetricCard icon={Box} label="NODES" value={metrics.node_count} color="#00f2ff" />
                        <MetricCard icon={GitBranch} label="CLUSTERS" value={metrics.cluster_count} color="#8a2be2" />
                        <MetricCard icon={Activity} label="CPU AVG" value={`${metrics.avg_cpu}%`} color="#00ff88" />
                        <MetricCard icon={Shield} label="HEALTH" value={<HealthBadge health={metrics.health} />} color="#00f2ff" />
                      </div>

                      {metrics.clusters && metrics.clusters.length > 0 && (
                        <div className="clusters-section">
                          <div className="section-header">
                            <span className="section-line" />
                            <span>CONSTELLATIONS</span>
                            <span className="section-line" />
                          </div>
                          <div className="clusters-list">
                            {metrics.clusters.map((cl, i) => (
                              <ClusterRow key={i} cluster={cl} />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {paragraphs.length > 0 && (
                    <div className="narrative-section">
                      <div className="section-header">
                        <span className="section-line" />
                        <span>NEURAL ANALYSIS</span>
                        <span className="section-line" />
                      </div>
                      <div className="narrative-text">
                        {paragraphs.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <div className="footer-stat"><Shield size={11} /> SECURE</div>
              <div className="footer-stat"><Zap size={11} /> REAL-TIME</div>
              <div className="footer-stat"><AlertTriangle size={11} /> NEBULA-AI v1.2</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default AIArchitectureExplainer