import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const dustVertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;
  
  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const dustFragmentShader = `
  uniform float uTime;
  uniform vec3 uStarColors[20];
  uniform int uStarCount;
  
  varying vec2 vUv;
  varying vec3 vPosition;
  
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  void main() {
    vec2 uv = vUv * 3.0;
    
    float n = noise(uv + uTime * 0.02);
    n += noise(uv * 2.0 - uTime * 0.015) * 0.5;
    n += noise(uv * 4.0 + uTime * 0.01) * 0.25;
    n /= 1.75;
    
    float dist = length(vPosition);
    float falloff = 1.0 - smoothstep(0.0, 25.0, dist);
    
    vec3 color = vec3(0.0);
    float totalWeight = 0.0;
    
    for (int i = 0; i < 20; i++) {
      if (i >= uStarCount) break;
      
      float weight = 1.0 / (1.0 + dist * 0.1);
      color += uStarColors[i] * weight;
      totalWeight += weight;
    }
    
    if (totalWeight > 0.0) {
      color /= totalWeight;
    }
    
    color *= 0.15;
    
    float alpha = n * falloff * 0.4;
    
    gl_FragColor = vec4(color, alpha);
  }
`

function DustCloud({ starColors = [] }) {
  const meshRef = useRef()
  
  const uniforms = useMemo(() => {
    const colors = []
    for (let i = 0; i < 20; i++) {
      colors.push(new THREE.Color(starColors[i] || '#4488ff'))
    }
    
    return {
      uTime: { value: 0 },
      uStarColors: { value: colors },
      uStarCount: { value: Math.min(starColors.length, 20) }
    }
  }, [starColors])
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
      
      if (starColors.length > 0) {
        const colors = []
        for (let i = 0; i < 20; i++) {
          colors.push(new THREE.Color(starColors[i] || '#4488ff'))
        }
        meshRef.current.material.uniforms.uStarColors.value = colors
        meshRef.current.material.uniforms.uStarCount.value = Math.min(starColors.length, 20)
      }
    }
  })
  
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[25, 64, 64]} />
      <shaderMaterial
        vertexShader={dustVertexShader}
        fragmentShader={dustFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

export default DustCloud
