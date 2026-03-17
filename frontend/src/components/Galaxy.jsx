import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import ContainerStar from './ContainerStar'
import DataComet from './DataComet'
import NetworkConnection from './NetworkConnection'
import ConstellationLines from './ConstellationLines'
import AICopilotDrone from './AICopilotDrone'

function Galaxy({ containers, onSelect, selectedId, highlightedNetwork, onWarpTo, onToggleConstellation, onOpenBridge, clusters, incidents, aiInsight, onCopilotClick, isChatOpen }) {
  const groupRef = useRef()
  const positionsRef = useRef({})
  const [comets, setComets] = useState([])
  const cometIdRef = useRef(0)
  const lastSpawnRef = useRef(0)

  useEffect(() => {
    containers.forEach((container) => {
      if (container.position) {
        positionsRef.current[container.id] = container.position
      }
    })
  }, [containers])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0005
    }
    
    const time = state.clock.elapsedTime
    if (time - lastSpawnRef.current > 3 && containers.length >= 2) {
      lastSpawnRef.current = time
      
      const connectedContainers = containers.filter(c => c.network)
      
      if (connectedContainers.length >= 2) {
        const idx1 = Math.floor(Math.random() * connectedContainers.length)
        let idx2 = Math.floor(Math.random() * connectedContainers.length)
        while (idx2 === idx1 && connectedContainers.length > 1) {
          idx2 = Math.floor(Math.random() * connectedContainers.length)
        }
        
        const c1 = connectedContainers[idx1]
        const c2 = connectedContainers[idx2]
        
        const pos1 = positionsRef.current[c1.id] || c1.position
        const pos2 = positionsRef.current[c2.id] || c2.position
        
        if (pos1 && pos2) {
          const colors = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff8800']
          const color = colors[Math.floor(Math.random() * colors.length)]
          
          const newComet = {
            id: cometIdRef.current++,
            startPos: pos1,
            endPos: pos2,
            color,
            delay: 0
          }
          
          setComets(prev => [...prev.slice(-5), newComet])
        }
      }
    }
  })

  const handleCometComplete = (id) => {
    setComets(prev => prev.filter(c => c.id !== id))
  }

  return (
    <group ref={groupRef}>
      <NetworkConnection containers={containers} />
      <ConstellationLines containers={containers} clusters={clusters} />
      <AICopilotDrone insight={aiInsight} onClick={onCopilotClick} isChatOpen={isChatOpen} />
      
      {containers.map((container, index) => {
        const pos = positionsRef.current[container.id] || container.position || {
          x: Math.cos((index / Math.max(containers.length, 1)) * Math.PI * 2) * 8,
          y: (index % 5) * 2 - 4,
          z: Math.sin((index / Math.max(containers.length, 1)) * Math.PI * 2) * 8
        }
        
        const isHighlighted = highlightedNetwork && container.network === highlightedNetwork
        
        return (
          <ContainerStar
            key={container.id}
            container={container}
            position={[pos.x, pos.y, pos.z]}
            onSelect={onSelect}
            selectedId={selectedId}
            onWarpTo={onWarpTo}
            onToggleConstellation={onToggleConstellation}
            onOpenBridge={onOpenBridge}
            highlightedNetwork={isHighlighted ? container.network : null}
            incident={incidents?.find(inc => inc.container_id === container.id)}
          />
        )
      })}
      
      {comets.map((comet) => (
        <DataComet
          key={comet.id}
          startPos={comet.startPos}
          endPos={comet.endPos}
          color={comet.color}
          delay={comet.delay}
          onComplete={() => handleCometComplete(comet.id)}
        />
      ))}
    </group>
  )
}

export default Galaxy
