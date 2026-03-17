import { useRef, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function AICopilotDrone({ isChatOpen, onClick }) {
  const droneRef = useRef()
  const ringRef = useRef()
  const [hovered, setHovered] = useState(false)
  const { camera } = useThree()
  
  // Transition constants
  const targetOffset = new THREE.Vector3(0, -1.5, -5) // Position relative to camera when "open"
  const travelSpeed = 0.1
  
  useFrame((state) => {
    const time = state.clock.elapsedTime
    
    if (droneRef.current) {
      if (isChatOpen) {
        // Calculate target world position relative to camera
        const targetPos = targetOffset.clone().applyMatrix4(camera.matrixWorld)
        
        // Smoothly move to camera view
        droneRef.current.position.lerp(targetPos, travelSpeed)
        
        // Face the camera
        const lookPos = camera.position.clone()
        droneRef.current.lookAt(lookPos)
        
        // Subtle activation jitter
        droneRef.current.position.y += Math.sin(time * 10) * 0.02
      } else {
        // Normal orbital/floating movement
        const orbitX = Math.cos(time * 0.3) * 15
        const orbitY = Math.sin(time * 0.5) * 2 + 15
        const orbitZ = Math.sin(time * 0.3) * 15
        
        const orbitPos = new THREE.Vector3(orbitX, orbitY, orbitZ)
        droneRef.current.position.lerp(orbitPos, travelSpeed)
        
        // Look at center unless being looked at by camera
        droneRef.current.lookAt(0, 0, 0)
      }
    }
    
    if (ringRef.current) {
      ringRef.current.rotation.z = time * (isChatOpen ? 4 : 2)
      ringRef.current.rotation.x = time * 0.5
      
      const scale = hovered ? 1.4 : (isChatOpen ? 1.2 : 1)
      ringRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)
    }
  })

  return (
    <group 
      ref={droneRef} 
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >
      {/* Invisible Large Hit-box for easier clicking */}
      <mesh visible={false}>
        <sphereGeometry args={[2, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Drone Core */}
      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial 
          color={hovered || isChatOpen ? "#fff" : "#00ffff"} 
          emissive={hovered || isChatOpen ? "#fff" : "#00ffff"} 
          emissiveIntensity={hovered || isChatOpen ? 4 : 2} 
        />
      </mesh>
      
      {/* Outer Ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.2, 0.05, 16, 100]} />
        <meshStandardMaterial 
          color="#00ffff" 
          emissive="#00ffff" 
          emissiveIntensity={hovered || isChatOpen ? 3 : 1} 
          transparent 
          opacity={0.6} 
        />
      </mesh>
      
      {/* Intelligence Beam */}
      <mesh position={[0, -2, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.5, 4, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={(hovered || isChatOpen) ? 0.3 : 0.1} />
      </mesh>
    </group>
  )
}

export default AICopilotDrone
