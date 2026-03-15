import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform float uCpu;
  uniform float uBreath;
  uniform vec3 uColorHealthy;
  uniform vec3 uColorError;
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  
  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
  
  // Voronoi noise
  float voronoi(vec3 p) {
    vec3 n = floor(p);
    vec3 f = fract(p);
    
    float md = 8.0;
    
    for(int i = -1; i <= 1; i++) {
      for(int j = -1; j <= 1; j++) {
        for(int k = -1; k <= 1; k++) {
          vec3 g = vec3(float(i), float(j), float(k));
          vec3 o = vec3(
            snoise(n + g + vec3(0.0, 0.0, uTime * 0.1)) * 0.5 + 0.5,
            snoise(n + g + vec3(100.0, 0.0, uTime * 0.1)) * 0.5 + 0.5,
            snoise(n + g + vec3(200.0, 0.0, uTime * 0.1)) * 0.5 + 0.5
          );
          vec3 r = g + o - f;
          float d = dot(r, r);
          md = min(md, d);
        }
      }
    }
    
    return sqrt(md);
  }
  
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = pow(1.0 - max(dot(viewDirection, vNormal), 0.0), 3.0);
    
    float voronoiPattern = voronoi(vPosition * 2.0 + uTime * 0.2);
    float pulse = sin(uTime * 3.0) * 0.5 + 0.5;
    float noise = snoise(vPosition * 3.0 + uTime * 0.5) * 0.5 + 0.5;
    
    float cpuFactor = smoothstep(40.0, 90.0, uCpu);
    vec3 baseColor = mix(uColorHealthy, uColorError, cpuFactor);
    
    float coreGlow = voronoiPattern * (0.5 + pulse * 0.5);
    vec3 color = baseColor * (0.6 + coreGlow * 0.8);
    
    color += fresnel * baseColor * 1.2;
    
    color += noise * 0.15 * baseColor;
    
    gl_FragColor = vec4(color, 1.0);
  }
`

const cmeVertexShader = `
  attribute float aSize;
  attribute float aLife;
  
  varying float vLife;
  
  uniform float uTime;
  
  void main() {
    vLife = aLife;
    
    vec3 pos = position;
    float angle = uTime * 2.0 + aLife * 6.28;
    pos.x += cos(angle) * aLife * 0.5;
    pos.y += sin(angle) * aLife * 0.5;
    pos.z += sin(uTime * 3.0 + aLife * 3.14) * 0.3;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const cmeFragmentShader = `
  varying float vLife;
  uniform vec3 uColorError;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = (1.0 - dist * 2.0) * vLife;
    vec3 color = uColorError * (1.0 + vLife);
    
    gl_FragColor = vec4(color, alpha * 0.8);
  }
`

function CMEParticles({ cpuHigh, color }) {
  const pointsRef = useRef()
  const particleCount = 200
  
  const { positions, sizes, lives } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const lives = new Float32Array(particleCount)
    
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const radius = 0.5 + Math.random() * 0.5
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)
      
      sizes[i] = Math.random() * 3 + 1
      lives[i] = Math.random()
    }
    
    return { positions, sizes, lives }
  }, [])
  
  useFrame((state) => {
    if (pointsRef.current && cpuHigh) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.5
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.2
    }
  })
  
  if (!cpuHigh) return null
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={particleCount}
          array={sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aLife"
          count={particleCount}
          array={lives}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={cmeVertexShader}
        fragmentShader={cmeFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uColorError: { value: new THREE.Color('#ff2222') }
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function Star({ container, position, onClick, isSelected }) {
  const meshRef = useRef()
  const glowRef = useRef()
  const materialRef = useRef()
  
  const cpu = container.cpu_percent || 0
  const memory = container.memory_percent || 0
  const isCpuHigh = cpu > 70
  const isMemoryHigh = memory > 80
  const isError = isCpuHigh || isMemoryHigh
  
  const size = useMemo(() => {
    return 0.4 + (memory / 100) * 0.3
  }, [memory])
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCpu: { value: cpu },
    uBreath: { value: 0 },
    uColorHealthy: { value: new THREE.Color('#0d4f4f') },
    uColorError: { value: new THREE.Color('#ff2222') }
  }), [])
  
  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = elapsed
      materialRef.current.uniforms.uCpu.value = cpu
      
      const breath = Math.sin(elapsed * 2 + position[0] * 0.5) * 0.5 + 0.5
      materialRef.current.uniforms.uBreath.value = breath
      
      if (meshRef.current) {
        const scale = 1 + breath * 0.15
        meshRef.current.scale.setScalar(size * scale)
      }
    }
    
    if (glowRef.current) {
      const glowScale = 1.5 + Math.sin(elapsed * 3) * 0.1
      glowRef.current.scale.setScalar(size * glowScale)
    }
  })
  
  const color = useMemo(() => {
    const healthyColor = new THREE.Color('#0d4f4f')
    const errorColor = new THREE.Color('#ff2222')
    const cpuFactor = Math.min(cpu / 80, 1)
    return healthyColor.lerp(errorColor, cpuFactor)
  }, [cpu])
  
  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={onClick}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'default'}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      
      <mesh ref={glowRef} scale={1.5}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>
      
      <CMEParticles cpuHigh={isCpuHigh} color={color} />
      
      <pointLight
        color={color}
        intensity={isError ? 3 : 1.5}
        distance={12}
        decay={2}
      />
      
      <Html
        position={[0, size + 0.6, 0]}
        center
        style={{
          transition: 'all 0.3s',
          opacity: isSelected ? 1 : 0.7,
          pointerEvents: 'none'
        }}
      >
        <div style={{
          color: '#fff',
          fontSize: '10px',
          fontFamily: 'monospace',
          textAlign: 'center',
          textShadow: '0 0 5px #000',
          whiteSpace: 'nowrap'
        }}>
          <div style={{ fontWeight: 'bold' }}>{container.name}</div>
          {isSelected && (
            <div style={{ 
              color: isError ? '#ff6666' : '#88aacc', 
              fontSize: '8px' 
            }}>
              CPU: {cpu.toFixed(1)}% | MEM: {memory.toFixed(1)}%
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

export default Star
