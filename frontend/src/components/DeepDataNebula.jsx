import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const nebulaVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  
  attribute float aScale;
  attribute float aRandom;
  
  varying float vRandom;
  varying vec3 vColor;
  
  // Simplex noise
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
  
  void main() {
    vRandom = aRandom;
    
    vec3 pos = position;
    
    float noiseScale = 0.015;
    float noiseSpeed = 0.08;
    
    float noiseX = snoise(vec3(pos.x * noiseScale, pos.y * noiseScale, uTime * noiseSpeed));
    float noiseY = snoise(vec3(pos.y * noiseScale, pos.z * noiseScale, uTime * noiseSpeed + 100.0));
    float noiseZ = snoise(vec3(pos.z * noiseScale, pos.x * noiseScale, uTime * noiseSpeed + 200.0));
    
    pos.x += noiseX * 3.0;
    pos.y += noiseY * 2.0;
    pos.z += noiseZ * 3.0;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    
    float colorMix = (noiseX + 1.0) * 0.5;
    vec3 color1 = vec3(0.05, 0.1, 0.2);
    vec3 color2 = vec3(0.1, 0.05, 0.15);
    vec3 color3 = vec3(0.02, 0.15, 0.12);
    vColor = mix(mix(color1, color2, colorMix), color3, aRandom);
    
    gl_PointSize = aScale * uPixelRatio * (80.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const nebulaFragmentShader = `
  varying float vRandom;
  varying vec3 vColor;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float alpha = (1.0 - dist * 2.0) * (0.3 + vRandom * 0.4);
    vec3 color = vColor * (1.0 + vRandom * 0.5);
    
    gl_FragColor = vec4(color, alpha);
  }
`

function DeepDataNebula({ count = 50000 }) {
  const pointsRef = useRef()
  
  const { positions, scales, randoms } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const randoms = new Float32Array(count)
    
    for (let i = 0; i < count; i++) {
      const radius = 30 + Math.random() * 70
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = radius * Math.cos(phi)
      
      scales[i] = Math.random() * 2 + 0.5
      randoms[i] = Math.random()
    }
    
    return { positions, scales, randoms }
  }, [count])
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
  }), [])
  
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.material.uniforms.uTime.value = state.clock.elapsedTime
    }
  })
  
  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aScale"
          count={count}
          array={scales}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aRandom"
          count={count}
          array={randoms}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default DeepDataNebula
