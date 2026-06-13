import { useRef, useMemo, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AnimatePresence } from 'framer-motion'
import HolographicHUD from './HolographicHUD'

// Revolutionary Solar Surface Shader
const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  uniform float uCpu;
  uniform float uMemory;
  uniform vec3 uColorHealthy;
  uniform vec3 uColorError;
  uniform float uIsPaused;
  uniform float uIsStopped;
  uniform float uIsIncident;
  uniform float uBirth; // Birth flash factor
  
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  
  // High quality noise for granulation
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
    vec4 j = p - 49.0 * floor(p * (1.0 / 49.0));
    vec4 x_ = floor(j * (1.0 / 7.0));
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * (1.0 / 7.0) + 0.5/7.0;
    vec4 y = y_ * (1.0 / 7.0) + 0.5/7.0;
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
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float time = uTime * 0.2;
    // Layered noise for convection cells (granules)
    float n1 = snoise(vPosition * 4.0 + time);
    float n2 = snoise(vPosition * 8.0 - time * 1.5) * 0.5;
    float granulation = n1 + n2;
    
    // Fresnel limb darkening
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float limbDarkening = pow(1.0 - fresnel, 0.5);
    
    // Base Color based on health
    float healthMix = smoothstep(30.0, 90.0, uCpu);
    vec3 color = mix(uColorHealthy, uColorError, healthMix);
    
    if (uIsStopped > 0.5) color = vec3(0.05, 0.05, 0.08);
    if (uIsPaused > 0.5) color = mix(vec3(0.8, 0.4, 0.0), vec3(0.4, 0.2, 0.0), sin(uTime)*0.5+0.5);
    
    // Realistic Star Surface Integration
    vec3 surface = color * (0.8 + granulation * 0.4);
    surface *= (0.5 + limbDarkening * 1.0); // Brighter in center
    
    // Add glowing heat
    surface += uColorError * pow(granulation, 8.0) * healthMix * 2.0;
    
    // Birth Flash
    surface = mix(surface, vec3(1.0, 1.0, 1.0), uBirth);
    
    if (uIsIncident > 0.5) {
       surface = mix(vec3(0.0, 0.0, 0.0), vec3(1.0, 0.2, 0.0), pow(fresnel, 4.0));
    }

    gl_FragColor = vec4(surface, 1.0);
  }
`

const coronaVertexShader = `
  varying float vFresnel;
  varying vec3 vNormal;
  
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec3 viewDir = normalize(cameraPosition - (modelMatrix * vec4(position, 1.0)).xyz);
    vFresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const coronaFragmentShader = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uBirth;
  varying float vFresnel;
  
  void main() {
    float noise = sin(uTime * 2.0 + vFresnel * 10.0) * 0.1 + 0.9;
    vec3 color = mix(uColor, vec3(1.0), uBirth);
    gl_FragColor = vec4(color, vFresnel * 0.6 * noise + uBirth);
  }
`

function ContainerStar({ container, position, onSelect, selectedId, onOpenBridge, incident }) {
  const meshRef = useRef()
  const coronaRef = useRef()
  const materialRef = useRef()
  const coronaMatRef = useRef()
  
  const [birthFactor, setBirthFactor] = useState(0)
  const [activeScale, setActiveScale] = useState(0)

  const cpu = container.cpu_percent || 0
  const memory = container.memory_percent || 0
  const isIncident = !!incident
  const isRunning = container.status === 'running'
  
  // Birth animation logic
  useEffect(() => {
    if (container.isNew) {
      setBirthFactor(1)
      setActiveScale(0)
      // Rapid sequence: 0 scale -> 1.5 scale + white flash -> 1.0 scale + settle
      let start = null
      const duration = 1500
      const animate = (time) => {
        if (!start) start = time
        const progress = (time - start) / duration
        
        if (progress < 0.2) {
          // Rapid expansion and flash
          const p = progress / 0.2
          setActiveScale(p * 2.0)
          setBirthFactor(1.0)
        } else if (progress < 1.0) {
          // Settle down
          const p = (progress - 0.2) / 0.8
          setActiveScale(2.0 - p * 1.0)
          setBirthFactor(1.0 - p)
        } else {
          setActiveScale(1.0)
          setBirthFactor(0)
          return
        }
        requestAnimationFrame(animate)
      }
      requestAnimationFrame(animate)
    } else {
      setActiveScale(1)
      setBirthFactor(0)
    }
  }, [container.isNew])

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCpu: { value: cpu },
    uMemory: { value: memory },
    uColorHealthy: { value: new THREE.Color('#00ffff') },
    uColorError: { value: new THREE.Color('#ff3300') },
    uIsPaused: { value: container.status === 'paused' ? 1.0 : 0.0 },
    uIsStopped: { value: (container.status === 'exited' || container.status === 'stopped') ? 1.0 : 0.0 },
    uIsIncident: { value: isIncident ? 1.0 : 0.0 },
    uBirth: { value: 0 }
  }), [])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = elapsed
      materialRef.current.uniforms.uCpu.value = cpu
      materialRef.current.uniforms.uBirth.value = birthFactor
      
      const pulse = 1.0 + Math.sin(elapsed * 2) * 0.05
      const baseSize = 0.5 + (memory / 200)
      meshRef.current.scale.setScalar(baseSize * activeScale * pulse)
    }
    if (coronaMatRef.current) {
      coronaMatRef.current.uniforms.uTime.value = elapsed
      coronaMatRef.current.uniforms.uBirth.value = birthFactor
      const healthyColor = new THREE.Color('#00ffff')
      const errorColor = new THREE.Color('#ff3300')
      coronaMatRef.current.uniforms.uColor.value = healthyColor.lerp(errorColor, cpu / 100)
      
      const baseSize = 0.5 + (memory / 200)
      coronaRef.current.scale.setScalar(baseSize * activeScale * 1.4)
    }
  })

  return (
    <group position={position}>
      {/* Revolutionary Star Core */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onSelect(container); }}
        onPointerOver={() => document.body.style.cursor = 'pointer'}
        onPointerOut={() => document.body.style.cursor = 'default'}
      >
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>

      {/* Volumetric Corona Atmosphere */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[1.1, 32, 32]} />
        <shaderMaterial
          ref={coronaMatRef}
          vertexShader={coronaVertexShader}
          fragmentShader={coronaFragmentShader}
          uniforms={{
            uColor: { value: new THREE.Color('#00ffff') },
            uTime: { value: 0 },
            uBirth: { value: 0 }
          }}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Dynamic Lighting */}
      {isRunning && (
        <pointLight 
          color={cpu > 70 ? "#ff3300" : "#00ffff"} 
          intensity={2 + birthFactor * 10} 
          distance={15} 
        />
      )}

      {/* HUD Info */}
      <Html
        position={[0, 0, 0]}
        center
        zIndexRange={[100, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{ pointerEvents: 'none' }}>
          <AnimatePresence>
            {selectedId === container.id ? (
               <div style={{ pointerEvents: 'auto' }}>
                 <HolographicHUD 
                    key="hud"
                    container={container} 
                    onClose={() => onSelect(null)} 
                    onOpenBridge={onOpenBridge}
                  />
               </div>
            ) : (
              <div style={{
                color: '#88faff',
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
                textShadow: '0 0 10px rgba(0,255,255,0.5)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                transform: `translateY(-40px)`,
                opacity: 0.8,
                letterSpacing: '1px'
              }}>
                {container.name}
              </div>
            )}
          </AnimatePresence>
        </div>
      </Html>
    </group>
  )
}

export default ContainerStar
