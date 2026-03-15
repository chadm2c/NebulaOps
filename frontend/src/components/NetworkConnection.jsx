import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const networkVertexShader = `
  attribute float aProgress;
  varying float vProgress;
  uniform float uTime;
  
  void main() {
    vProgress = aProgress;
    
    float flow = fract(vProgress - uTime * 0.3);
    
    vec3 pos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const networkFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  varying float vProgress;
  
  void main() {
    float flow = fract(vProgress - uTime * 0.3);
    float pulse = sin(flow * 6.28) * 0.5 + 0.5;
    
    float opacity = 0.15 + pulse * 0.25;
    
    vec3 color = uColor * (0.8 + pulse * 0.4);
    
    gl_FragColor = vec4(color, opacity);
  }
`

function NetworkConnection({ containers }) {
  const linesRef = useRef()
  
  const { positions, progresses } = useMemo(() => {
    const networkGroups = {}
    
    containers.forEach((container) => {
      const network = container.network
      if (network) {
        if (!networkGroups[network]) {
          networkGroups[network] = []
        }
        networkGroups[network].push(container)
      }
    })
    
    const allPositions = []
    const allProgresses = []
    
    Object.values(networkGroups).forEach((group) => {
      if (group.length < 2) return
      
      for (let i = 0; i < group.length; i++) {
        const start = group[i]
        const end = group[(i + 1) % group.length]
        
        if (!start.position || !end.position) continue
        
        const segments = 20
        for (let j = 0; j < segments; j++) {
          const t = j / segments
          const progress = (i + t) / group.length
          
          const x = start.position.x + (end.position.x - start.position.x) * t
          const y = start.position.y + (end.position.y - start.position.y) * t
          const z = start.position.z + (end.position.z - start.position.z) * t
          
          allPositions.push(x, y, z)
          allProgresses.push(progress)
        }
      }
    })
    
    return {
      positions: new Float32Array(allPositions),
      progresses: new Float32Array(allProgresses)
    }
  }, [containers])
  
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color('#00ffff') },
    uTime: { value: 0 }
  }), [])
  
  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
    }
  })
  
  if (positions.length === 0) return null
  
  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aProgress"
          count={progresses.length}
          array={progresses}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={networkVertexShader}
        fragmentShader={networkFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

export default NetworkConnection
