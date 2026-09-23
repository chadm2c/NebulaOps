import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 150

function ExplosionBurst({ onComplete, duration = 1.4 }) {
  const groupRef = useRef()
  const pointsRef = useRef()
  const ringRef = useRef()
  const progressRef = useRef(0)
  const doneRef = useRef(false)

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < arr.length; i++) arr[i] = (Math.random() - 0.5) * 0.3
    return arr
  }, [])

  const velocities = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(0.8 + Math.random() * 2.1)
      arr[i * 3] = v.x
      arr[i * 3 + 1] = v.y
      arr[i * 3 + 2] = v.z
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (doneRef.current) return
    progressRef.current += delta / duration
    const p = Math.min(progressRef.current, 1)

    const pos = pointsRef.current?.geometry?.attributes.position
    if (pos) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos.array[i * 3] += velocities[i * 3] * delta
        pos.array[i * 3 + 1] += velocities[i * 3 + 1] * delta
        pos.array[i * 3 + 2] += velocities[i * 3 + 2] * delta
      }
      pos.needsUpdate = true
    }

    if (pointsRef.current?.material) {
      pointsRef.current.material.opacity = 1 - p
      pointsRef.current.material.size = 0.22 * (1 - p * 0.7)
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(0.2 + p * 3.8)
      ringRef.current.material.opacity = (1 - p) * 0.9
    }

    if (p >= 1) {
      doneRef.current = true
      if (groupRef.current) groupRef.current.visible = false
      onComplete()
    }
  })

  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ff9922"
          size={0.22}
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.92, 1, 48]} />
        <meshBasicMaterial
          color="#ff7722"
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export default ExplosionBurst