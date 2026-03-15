import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import Galaxy from './components/Galaxy'
import DeepDataNebula from './components/DeepDataNebula'
import DustCloud from './components/DustCloud'
import RemoteBridge from './components/RemoteBridge'
import './App.css'

function CameraController({ targetPosition, enabled }) {
  const { camera, controls } = useThree()
  const targetRef = useRef(null)
  
  useEffect(() => {
    if (enabled && targetPosition) {
      targetRef.current = {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z
      }
    }
  }, [targetPosition, enabled])
  
  useFrame((state, delta) => {
    if (enabled && targetRef.current) {
      const target = targetRef.current
      const t = 1 - Math.pow(0.001, delta)
      
      const currentTarget = controls?.target || { x: 0, y: 0, z: 0 }
      controls.target.x = currentTarget.x + (target.x - currentTarget.x) * t
      controls.target.y = currentTarget.y + (target.y - currentTarget.y) * t
      controls.target.z = currentTarget.z + (target.z - currentTarget.z) * t
      
      const desiredCamPos = {
        x: target.x + 8,
        y: target.y + 5,
        z: target.z + 8
      }
      
      camera.position.x += (desiredCamPos.x - camera.position.x) * t
      camera.position.y += (desiredCamPos.y - camera.position.y) * t
      camera.position.z += (desiredCamPos.z - camera.position.z) * t
      
      controls.update()
    }
  })
  
  return null
}

function App() {
  const [containers, setContainers] = useState([])
  const [selectedContainer, setSelectedContainer] = useState(null)
  const [connected, setConnected] = useState(false)
  const [warpTarget, setWarpTarget] = useState(null)
  const [isWarping, setIsWarping] = useState(false)
  const [highlightedNetwork, setHighlightedNetwork] = useState(null)
  const [activeBridge, setActiveBridge] = useState(null)

  useEffect(() => {
    fetch('/api/containers')
      .then(res => res.json())
      .then(data => {
        setContainers(data)
        setConnected(true)
      })
      .catch(err => console.error('Failed to fetch containers:', err))

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const apiHost = 'localhost:8000' // Should match backend port
    const ws = new WebSocket(`${wsProtocol}//${apiHost}/ws`)

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      if (message.type === 'containers') {
        setContainers(message.data)
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

  const handleWarpTo = useCallback((container) => {
    if (container?.position) {
      setWarpTarget(container.position)
      setIsWarping(true)
      setTimeout(() => setIsWarping(false), 2000)
    }
  }, [])

  const handleToggleConstellation = useCallback((container, active) => {
    setHighlightedNetwork(active ? container.network : null)
  }, [])

  const starColors = useMemo(() => {
    return containers.map(c => {
      const cpu = c.cpu_percent || 0
      const memory = c.memory_percent || 0
      if (cpu > 70 || memory > 80) return '#ff2222'
      if (cpu > 40 || memory > 50) return '#ffaa44'
      return '#0d8888'
    })
  }, [containers])

  return (
    <div className="app">
      <div className="header">
        <h1>NebulaOps</h1>
        <div className="status">
          <span className={`dot ${connected ? 'connected' : ''}`}></span>
          {connected ? `${containers.length} containers` : 'Connecting...'}
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
          containers={containers} 
          onSelect={handleSelectContainer}
          selectedId={selectedContainer?.id}
          highlightedNetwork={highlightedNetwork}
          onWarpTo={handleWarpTo}
          onToggleConstellation={handleToggleConstellation}
          onOpenBridge={setActiveBridge}
        />
        
        <CameraController targetPosition={warpTarget} enabled={isWarping} />
        
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
    </div>
  )
}

export default App
