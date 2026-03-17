import React, { useState } from 'react'
import { Brain, X, Info, Shield, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import './AIArchitectureExplaner.css'

function AIArchitectureExplainer() {
  const [isOpen, setIsOpen] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)

  const handleExplain = async () => {
    setLoading(true)
    setIsOpen(true)
    try {
      const res = await fetch('/api/ai/explain')
      const data = await res.json()
      setExplanation(data.explanation)
    } catch (e) {
      setExplanation('Neural link failure. Could not aggregate architectural data.')
    } finally {
      setLoading(false)
    }
  }

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Brain className="pulse-ai" size={20} color="#00f2ff" />
                <span>ARCHITECTURAL INTELLIGENCE REPORT</span>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              {loading ? (
                <div className="ai-loader-container">
                    <div className="ai-scanner-line"></div>
                    <p>SCANNING SECTORS...</p>
                </div>
              ) : (
                <div className="explanation-text">
                  {explanation.split('\n').map((line, i) => (
                    <div key={i} style={{ marginBottom: '8px' }}>{line}</div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <div className="footer-stat"><Shield size={12} /> SECURE</div>
              <div className="footer-stat"><Zap size={12} /> REAL-TIME</div>
              <div className="footer-stat"><Info size={12} /> NEBULA-AI v1.2</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default AIArchitectureExplainer
