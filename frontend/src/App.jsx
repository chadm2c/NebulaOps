import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import Galaxy from './components/Galaxy'
import DeepDataNebula from './components/DeepDataNebula'
import DustCloud from './components/DustCloud'
import RemoteBridge from './components/RemoteBridge'
import AIArchitectureExplainer from './components/AIArchitectureExplainer'
import AICopilotChat from './components/AICopilotChat'
import './App.css'

function App() {
  const [containers, setContainers] = useState([])
  const [selectedContainer, setSelectedContainer] = useState(null)
  const [connected, setConnected] = useState(false)
  const [activeBridge, setActiveBridge] = useState(null)
  const [aiClusters, setAiClusters] = useState([])
  const [aiIncidents, setAiIncidents] = useState([])
  const [aiInsight, setAiInsight] = useState("")
  const prevContainerIdsRef = useRef(new Set())
  const [newContainerIds, setNewContainerIds] = useState(new Set())
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  useEffect(() => {
    fetch('/api/containers')
      .then(res => res.json())
      .then(data => {
        setContainers(data)
        setConnected(true)
      })
      .catch(err => console.error('Failed to fetch containers:', err))

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`)

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'containers') {
        const incomingIds = new Set(message.data.map(c => c.id))
        const brandNew = new Set([...incomingIds].filter(id => !prevContainerIdsRef.current.has(id)))
        
        if (brandNew.size > 0) {
          setNewContainerIds(brandNew)
          // Store all currently known IDs
          prevContainerIdsRef.current = new Set([...prevContainerIdsRef.current, ...incomingIds])
          // Clear "new" status after animation time
          setTimeout(() => setNewContainerIds(new Set()), 3000)
        } else {
          // Just update the tracking ref with current state regardless of novelty
          prevContainerIdsRef.current = incomingIds
        }

        setContainers(message.data)
        if (message.clusters) setAiClusters(message.clusters)
        if (message.incidents) setAiIncidents(message.incidents)
        if (message.ai_insight) setAiInsight(message.ai_insight)
      }
    }

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)

    return () => ws.close()
  }, [])

  const handleSelectContainer = useCallback((container) => {
    setSelectedContainer(container)
  }, [])

  const handleClosePanel = useCallback(() => {
    setSelectedContainer(null)
  }, [])

  const handleSendMessage = async (message) => {
    const userMsg = { role: 'user', content: message };
    setChatHistory(prev => [...prev, userMsg]);
    
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: chatHistory
        })
      });
      
      const data = await response.json();
      const aiMsg = { role: 'assistant', content: data.message };
      setChatHistory(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, { role: 'assistant', content: "Connection interupted. NebulaAI link lost." }]);
    }
  };

  const displayContainers = useMemo(() => {
    return containers.map(c => ({
      ...c,
      isNew: newContainerIds.has(c.id)
    }))
  }, [containers, newContainerIds])

  const starColors = useMemo(() => {
    return displayContainers.map(c => {
      const cpu = c.cpu_percent || 0
      const memory = c.memory_percent || 0
      if (cpu > 70 || memory > 80) return '#ff2222'
      if (cpu > 40 || memory > 50) return '#ffaa44'
      return '#0d8888'
    })
  }, [displayContainers])

  return (
    <div className="app">
      <div className="header">
        <div className="brand-container">
          <h1>NebulaOps</h1>
          <div className="status">
            <span className={`dot ${connected ? 'connected' : ''}`}></span>
            {connected ? `${containers.length} nodes active` : 'Establishing Uplink...'}
          </div>
        </div>
      </div>
      
      <Canvas 
        camera={{ position: [0, 20, 30], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#020208']} />
        <fog attach="fog" args={['#020208', 40, 120]} />
        
        <ambientLight intensity={0.05} />
        <pointLight position={[0, 0, 0]} intensity={0.3} color="#4488ff" />
        
        <DeepDataNebula count={60000} />
        
        <DustCloud starColors={starColors} />
        
        <Galaxy 
          containers={displayContainers} 
          onSelect={handleSelectContainer}
          selectedId={selectedContainer?.id}
          onOpenBridge={setActiveBridge}
          clusters={aiClusters}
          incidents={aiIncidents}
          aiInsight={aiInsight}
          onCopilotClick={() => setIsChatOpen(!isChatOpen)}
          isChatOpen={isChatOpen}
        />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={80}
          autoRotate={false}
        />
        
        <EffectComposer>
          <Bloom 
            intensity={1.5}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
          <Noise opacity={0.08} />
          <Vignette eskil={false} offset={0.1} darkness={0.8} />
        </EffectComposer>
      </Canvas>

      {activeBridge && (
        <RemoteBridge 
          container={activeBridge} 
          onClose={() => setActiveBridge(null)} 
        />
      )}

      <AICopilotChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        history={chatHistory}
        onSendMessage={handleSendMessage}
      />


      <AIArchitectureExplainer />
    </div>
  )
}

export default App
