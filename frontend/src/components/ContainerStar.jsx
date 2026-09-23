import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AnimatePresence } from 'framer-motion'
import HolographicHUD from './HolographicHUD'
import ExplosionBurst from './ExplosionBurst'
import useContainerEffects from '../hooks/useContainerEffects'

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
  uniform vec3 uColorMemory;
  uniform float uIsPaused;
  uniform float uStopped;
  uniform float uIsIncident;
  uniform float uBirth; // Birth flash factor
  uniform float uRestartPulse; // Restart pulse factor
  
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
    
    // Base Color: CPU health gradient
    float healthMix = smoothstep(30.0, 90.0, uCpu);
    vec3 color = mix(uColorHealthy, uColorError, healthMix);
    
    // Memory pressure tints toward violet
    float memMix = smoothstep(30.0, 90.0, uMemory);
    color = mix(color, uColorMemory, memMix * 0.85);
    
    // Restart pulse flashes white/orange
    color = mix(color, vec3(1.0, 0.65, 0.2), uRestartPulse * 0.65);
    
    if (uIsPaused > 0.5) color = mix(vec3(0.8, 0.4, 0.0), vec3(0.4, 0.2, 0.0), sin(uTime)*0.5+0.5);
    
    // Realistic Star Surface Integration
    vec3 surface = color * (0.8 + granulation * 0.4);
    surface *= (0.5 + limbDarkening * 1.0); // Brighter in center
    
    // Add glowing heat
    surface += uColorError * pow(granulation, 8.0) * healthMix * 2.0;
    
    // Birth Flash
    surface = mix(surface, vec3(1.0, 1.0, 1.0), uBirth);
    
    // Stopped dimming (animated via uStopped)
    surface = mix(surface, vec3(0.05, 0.05, 0.08), uStopped);
    
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

const smoothstep = (edge0, edge1, x) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function ContainerStar({ container, position, onSelect, selectedId, onOpenBridge, incident }) {
  const meshRef = useRef()
  const coronaRef = useRef()
  const materialRef = useRef()
  const coronaMatRef = useRef()
  const burstKeyRef = useRef(0)
  const [burst, setBurst] = useState({ active: false, key: 0 })
  const effRef = useRef({ type: 'none', start: 0, token: -1 })

  const { effect, token, bumpRestart } = useContainerEffects(container)

  const cpu = container.cpu_percent || 0
  const memory = container.memory_percent || 0
  const isIncident = !!incident
  const isRunning = container.status === 'running'
  const isStoppedNow = container.status === 'exited' || container.status === 'stopped' || container.status === 'dead'

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCpu: { value: cpu },
    uMemory: { value: memory },
    uColorHealthy: { value: new THREE.Color('#00ffff') },
    uColorError: { value: new THREE.Color('#ff3300') },
    uColorMemory: { value: new THREE.Color('#bb33ff') },
    uIsPaused: { value: 0 },
    uStopped: { value: 0 },
    uIsIncident: { value: 0 },
    uBirth: { value: 0 },
    uRestartPulse: { value: 0 }
  }), [])

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime

    if (effRef.current.token !== token) {
      effRef.current = { type: effect, start: elapsed, token }
      if (effect === 'explode') {
        burstKeyRef.current += 1
        setBurst((b) => ({ active: true, key: burstKeyRef.current }))
      }
    }

    const t = elapsed - effRef.current.start
    const type = effRef.current.type
    const baseSize = 0.5 + (memory / 200)

    let birth = 0
    let restartPulse = 0
    let stopped = isStoppedNow ? 1 : 0
    let scaleBoost = 1

    if (type === 'ignite' && t < 1.5) {
      const p = t / 1.5
      if (p < 0.2) {
        scaleBoost = (p / 0.2) * 2
        birth = 1.0
      } else {
        const q = (p - 0.2) / 0.8
        scaleBoost = 2 - q
        birth = 1 - q
      }
      stopped = 1 - smoothstep(0, 0.35, t)
    } else if (type === 'fade' && t < 1.2) {
      const q = smoothstep(0, 1.2, t)
      stopped = q
      scaleBoost = 1 - 0.25 * q
    } else if (type === 'explode' && t < 1.6) {
      if (t < 0.15) {
        birth = 1.0
        scaleBoost = 1 + 0.6 * (t / 0.15)
      } else {
        scaleBoost = 1.6 - 0.85 * smoothstep(0.15, 1.2, t)
        stopped = smoothstep(0.15, 1.2, t)
      }
    } else if (type === 'restart' && t < 2.0) {
      restartPulse = Math.max(0, 0.5 - 0.5 * Math.cos(t * Math.PI * 3))
      scaleBoost = 1 + 0.3 * restartPulse
    }

    const m = materialRef.current?.uniforms
    if (m) {
      m.uTime.value = elapsed
      m.uCpu.value = cpu
      m.uMemory.value = memory
      m.uIsPaused.value = container.status === 'paused' ? 1 : 0
      m.uStopped.value = stopped
      m.uIsIncident.value = isIncident ? 1 : 0
      m.uBirth.value = birth
      m.uRestartPulse.value = restartPulse
    }

    const pulse = 1.0 + Math.sin(elapsed * 2) * 0.05
    meshRef.current?.scale.setScalar(baseSize * scaleBoost * pulse)

    if (coronaMatRef.current) {
      coronaMatRef.current.uniforms.uTime.value = elapsed
      coronaMatRef.current.uniforms.uBirth.value = birth
      const healthyColor = new THREE.Color('#00ffff')
      const errorColor = new THREE.Color('#ff3300')
      const memoryColor = new THREE.Color('#bb33ff')
      let c = healthyColor.lerp(errorColor, cpu / 100)
      c = c.lerp(memoryColor, Math.min(1, memory / 100) * 0.85 * 0.5)
      coronaMatRef.current.uniforms.uColor.value = c
      coronaRef.current?.scale.setScalar(baseSize * scaleBoost * 1.4)
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
          intensity={2 + birth * 10} 
          distance={15} 
        />
      )}

      {/* Crash Explosion */}
      {burst.active && (
        <ExplosionBurst
          key={burst.key}
          onComplete={() => setBurst((b) => ({ ...b, active: false }))}
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
                    onAction={(action) => {
                      if (action === 'restart') bumpRestart()
                    }}
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