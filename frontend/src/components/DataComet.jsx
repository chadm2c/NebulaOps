import { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  attribute float aProgress;
  varying float vProgress;
  
  void main() {
    vProgress = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  varying float vProgress;
  
  void main() {
    float opacity = pow(1.0 - vProgress, 2.0);
    float glow = sin(vProgress * 20.0 - uTime * 5.0) * 0.3 + 0.7;
    vec3 color = uColor * glow;
    gl_FragColor = vec4(color, opacity * 0.9);
  }
`

function easeInOutCubic(t) {
  return t < 0.5 
    ? 4 * t * t * t 
    : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function DataComet({ startPos, endPos, color = '#00ffff', delay = 0, onComplete }) {
  const meshRef = useRef()
  const headLightRef = useRef()
  const progressRef = useRef(0)
  const startTimeRef = useRef(null)
  const [active, setActive] = useState(false)
  const completedRef = useRef(false)
  
  const { curve, geometry, uniforms } = useMemo(() => {
    const points = [
      new THREE.Vector3(startPos.x, startPos.y, startPos.z),
      new THREE.Vector3(
        (startPos.x + endPos.x) / 2 + (Math.random() - 0.5) * 4,
        (startPos.y + endPos.y) / 2 + Math.random() * 3,
        (startPos.z + endPos.z) / 2 + (Math.random() - 0.5) * 4
      ),
      new THREE.Vector3(endPos.x, endPos.y, endPos.z)
    ]
    
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)
    
    const segments = 64
    const positions = new Float32Array(segments * 2 * 3)
    const progress = new Float32Array(segments * 2)
    
    for (let i = 0; i < segments; i++) {
      const t = i / (segments - 1)
      const point = curve.getPoint(t)
      const tangent = curve.getTangent(t)
      const normal = new THREE.Vector3(0, 1, 0).cross(tangent).normalize()
      const bitangent = tangent.clone().cross(normal).normalize()
      
      const width = 0.08 * (1 - t * 0.7)
      
      positions[i * 6] = point.x - normal.x * width
      positions[i * 6 + 1] = point.y - normal.y * width
      positions[i * 6 + 2] = point.z - normal.z * width
      
      positions[i * 6 + 3] = point.x + normal.x * width
      positions[i * 6 + 4] = point.y + normal.y * width
      positions[i * 6 + 5] = point.z + normal.z * width
      
      progress[i * 2] = t
      progress[i * 2 + 1] = t
    }
    
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aProgress', new THREE.BufferAttribute(progress, 1))
    
    const uniforms = {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 }
    }
    
    return { curve, geometry, uniforms }
  }, [startPos, endPos, color])
  
  useEffect(() => {
    const timer = setTimeout(() => setActive(true), delay)
    return () => clearTimeout(timer)
  }, [delay])
  
  useFrame((state) => {
    if (!active || completedRef.current) return
    
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime
    }
    
    const elapsed = state.clock.elapsedTime - startTimeRef.current
    const duration = 2.5
    
    if (elapsed < 0) return
    
    let t = Math.min(elapsed / duration, 1)
    t = easeOutExpo(t)
    
    progressRef.current = t
    
    const point = curve.getPoint(t)
    
    if (meshRef.current) {
      meshRef.current.position.copy(point)
    }
    
    if (headLightRef.current) {
      headLightRef.current.position.copy(point)
      headLightRef.current.intensity = 2 + Math.sin(state.clock.elapsedTime * 10) * 0.5
    }
    
    if (uniforms.uTime) {
      uniforms.uTime.value = state.clock.elapsedTime
    }
    
    if (t >= 1 && !completedRef.current) {
      completedRef.current = true
      if (onComplete) onComplete()
    }
  })
  
  if (!active) return null
  
  return (
    <group>
      <mesh geometry={geometry}>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      <pointLight
        ref={headLightRef}
        color={color}
        intensity={2}
        distance={8}
        decay={2}
      />
    </group>
  )
}

export default DataComet
