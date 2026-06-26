import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { motion, AnimatePresence } from 'framer-motion'
import Draggable from 'react-draggable'
import { X, Maximize2, Minimize2, Terminal as TerminalIcon, Activity, History, Cpu } from 'lucide-react'
import { useDocker } from '../hooks/useDocker'
import 'xterm/css/xterm.css'
import './RemoteBridge.css'


const RemoteBridge = ({ container, onClose }) => {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const terminalSessionRef = useRef(null)
  const [bootStatus, setBootStatus] = useState('scanning') // scanning, unfolding, connected
  const [sessionAlive, setSessionAlive] = useState(false)
  const docker = useDocker()

  // CPU/RAM stats from useDocker
  useEffect(() => {
    if (bootStatus === 'connected') {
      docker.fetchStats(container.id)
      const interval = setInterval(() => docker.fetchStats(container.id), 2000)
      return () => clearInterval(interval)
    }
  }, [container.id, bootStatus])

  // Initialize Terminal and WebSocket
  useEffect(() => {
    if (bootStatus === 'connected' && terminalRef.current && !xtermRef.current) {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'underline',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 13,
        theme: {
          background: '#050505',
          foreground: '#00f2ff',
          cursor: '#00f2ff',
          selection: 'rgba(0, 242, 255, 0.3)',
          black: '#000000',
          red: '#ff2222',
          green: '#00ff88',
          yellow: '#ffff00',
          blue: '#4488ff',
          magenta: '#8a2be2',
          cyan: '#00f2ff',
          white: '#ffffff'
        },
        letterSpacing: 1,
        lineHeight: 1.2
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalRef.current)
      fitAddon.fit()
      
      // CRITICAL: Focus the terminal so the user can type immediately
      setTimeout(() => term.focus(), 100)

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      
      // Initialize WebSocket Session with immediate callbacks
      const session = docker.openTerminal(container.id, {
        onOpen: () => {
          setSessionAlive(true)
          term.write('\r\n\x1b[1;32m> BRIDGE ACTIVATED. PTY LINK ESTABLISHED.\x1b[0m\r\n\r\n')
          // Focus again just in case
          term.focus()
        },
        onData: (data) => {
          if (data === 'HEARTBEAT') return
          term.write(data)
        },
        onError: (err) => {
          setSessionAlive(false)
          term.write('\r\n\x1b[1;31m> CRITICAL ERROR: PTY MOUNT FAILED. CHECKING KERNEL...\x1b[0m\r\n')
          console.error("Terminal WebSocket Error:", err)
        },
        onClose: () => {
          setSessionAlive(false)
          term.write('\r\n\x1b[1;33m> LINK TERMINATED.\x1b[0m\r\n')
        }
      })
      
      terminalSessionRef.current = session

      // [Fix #2] Input batching: buffer keystrokes and flush every 30ms
      const inputBuffer = []
      let flushTimer = null

      const flushInput = () => {
        if (inputBuffer.length === 0) return
        const batched = inputBuffer.join('')
        inputBuffer.length = 0
        const sent = session.send(batched)
        if (!sent) {
          for (const ch of batched) {
            if (ch === '\x7f' || ch === '\b') {
              if (term.buffer.active.cursorX > 0) term.write('\b \b')
            } else if (ch === '\r') {
              term.write('\r\n')
            } else {
              term.write(ch)
            }
          }
        }
      }

      term.onData(data => {
        inputBuffer.push(data)
        if (!flushTimer) {
          flushTimer = setTimeout(() => {
            flushTimer = null
            flushInput()
          }, 30)
        }
      })

      // Add click listener to re-focus terminal
      const handleClick = () => term.focus()
      terminalRef.current.addEventListener('click', handleClick)

      window.addEventListener('resize', () => fitAddon.fit())
      
      return () => {
        if (flushTimer) {
          clearTimeout(flushTimer)
          flushInput()
        }
        terminalRef.current?.removeEventListener('click', handleClick)
        session.close()
        term.dispose()
      }
    }
  }, [bootStatus])

  // Lifecycle Animation Sequence
  useEffect(() => {
    const timer1 = setTimeout(() => setBootStatus('unfolding'), 1500)
    const timer2 = setTimeout(() => setBootStatus('connected'), 2500)
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [])

  const cpuPercent = docker.stats?.cpu_percent || 0
  const memPercent = docker.stats?.memory_percent || 0

  return (
    <div className="remote-bridge-container">
      <Draggable handle=".bridge-header" bounds="parent">
        <motion.div 
          className="remote-bridge-window"
          initial={{ height: '2px', width: '30vw', opacity: 0, rotateY: 20 }}
          animate={
            bootStatus === 'scanning' 
              ? { opacity: 1, height: '200px', width: '400px', rotateY: 0 } 
              : { 
                  height: '70vh', 
                  width: '70vw', 
                  opacity: 1,
                  rotateY: 10,
                  transition: { duration: 0.8, ease: "circOut" }
                }
          }
          style={{ perspective: '1000px' }}
        >
          {/* Scanning Layer - Now internal to the window */}
          <AnimatePresence>
            {bootStatus === 'scanning' && (
              <motion.div 
                className="boot-layer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="scanning-label">SCANNING SOURCE</div>
                <div className="scanning-bar">
                  <div className="scanning-progress"></div>
                </div>
                <div className="scanning-details">{container.name}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tactical Corners */}
          <div className="tactical-corner corner-tl"></div>
          <div className="tactical-corner corner-tr"></div>
          <div className="tactical-corner corner-bl"></div>
          <div className="tactical-corner corner-br"></div>

          {/* Flash Effect on connection */}
          {bootStatus === 'connected' && (
            <motion.div 
              className="flash-overlay"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1 }}
            />
          )}

          <header className="bridge-header">
            <div className="header-title">
              <TerminalIcon size={16} />
              <span>Remote Bridge :: {container.name}</span>
            </div>
            <div className="header-actions">
              <X className="close-bridge" size={18} onClick={onClose} />
            </div>
          </header>

          <main className="terminal-wrapper">
            <div ref={terminalRef} className="xterm-container" />
          </main>

          <aside className="vital-strip">
            <div className="vital-item">
              <div className="vital-label">CPU LOAD</div>
              <div className="vital-bar-track">
                <div className="vital-bar-fill" style={{ height: `${cpuPercent}%` }}></div>
              </div>
              <div className="vital-value">{cpuPercent.toFixed(1)}%</div>
            </div>
            <div className="vital-item">
              <div className="vital-label">MEM LOAD</div>
              <div className="vital-bar-track">
                <div className="vital-bar-fill" style={{ height: `${memPercent}%` }}></div>
              </div>
              <div className="vital-value">{memPercent.toFixed(1)}%</div>
            </div>
          </aside>

          <section className="command-history">
            <div className="history-title">SESSION METRICS</div>
            <div className="history-list">
               <div className="history-item" style={{ borderLeftColor: sessionAlive ? '#00ff88' : '#ff4444' }}>
                 STATUS: {sessionAlive ? 'CONNECTED' : 'DISCONNECTED'}
               </div>
               <div className="history-item">PTY: {sessionAlive ? 'REALTIME' : 'OFFLINE'}</div>
               <div className="history-item">ID: {container.id}</div>
            </div>
          </section>
        </motion.div>
      </Draggable>
    </div>
  )
}

export default RemoteBridge
