# Container Lifecycle Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the container lifecycle effect animations functional in the 3D galaxy — memory→color, crash explosion, star ignition on start, star fade on stop, restart pulse.

**Architecture:** A self-contained effect engine inside `ContainerStar`. A new hook (`useContainerEffects`) diffs each container's previous vs current status/exit-code and returns a one-shot effect token; `ContainerStar` animates purely from clock time since that token. A new `ExplosionBurst` component renders particles + shockwave for crashes. `HolographicHUD` fires an optimistic restart pulse via a new `onAction` prop. No App/Galaxy/backend changes.

**Tech Stack:** React 18, react-three-fiber, Three.js shaderMaterial, Vite (build = `npm run build`).

## Global Constraints

- **Verification:** `cd frontend && npm run build` must succeed after every task (canonical frontend check; no lint/typecheck scripts exist, no JS test framework).
- **No comments** in source unless explicitly requested.
- Demo mode stays static: effects trigger on **real Docker status transitions** only.
- Crash vs fade heuristic: `running→exited/stopped/dead` with `ExitCode !== 0` OR `OOMKilled` → **explode**; else → **fade**.
- Ignition fires on **brand-new id** (`container.isNew`) OR any transition into `running`.
- Restart pulse fires **optimistically** (HUD click) AND on any `status === 'restarting'` frame.
- Effects are edge-triggered: repeated 2s WS payloads must never replay an animation.
- Fix the frozen-uniform bug: all shader uniforms updated every frame in `useFrame` (never `useMemo([], ...)` frozen).
- Backend untouched → no `py_compile` needed unless backend files change (they don't).
- Follow existing code style (no framework beyond what's used; `AnimatePresence`, drei `Html` already in use).

---

### Task 1: Percent/status diff hook `useContainerEffects`

**Files:**
- Create: `frontend/src/hooks/useContainerEffects.js`

**Interfaces:**
- Consumes: a `container` object with at least `{ id, isNew, status, state? }` where `state` is Docker's `State` attrs (`{ ExitCode, OOMKilled, ... }`).
- Produces: `{ effect, token, bumpRestart }`
  - `effect`: `'ignite' | 'fade' | 'explode' | 'restart' | 'none'`
  - `token`: monotonically increasing int; increments only when a new effect is detected
  - `bumpRestart(): void` — forces a `'restart'` effect (used by HUD optimistic pulse)

- [ ] **Step 1: Write the hook**

```js
import { useEffect, useRef, useState } from 'react'

const isStoppedStatus = (s) => s === 'exited' || s === 'stopped' || s === 'dead'

export default function useContainerEffects(container) {
  const prevRef = useRef(null)
  const [state, setState] = useState({ type: 'none', token: 0 })
  const [restartBump, setRestartBump] = useState(0)

  useEffect(() => {
    const cur = {
      status: container.status,
      exitCode: container.state?.ExitCode,
      oomKilled: !!container.state?.OOMKilled
    }
    const prev = prevRef.current
    let type = 'none'

    if (container.isNew) {
      type = 'ignite'
    } else if (prev) {
      const prevStatus = prev.status
      const curStatus = cur.status

      if (prevStatus !== 'running' && curStatus === 'running') {
        type = 'ignite'
      } else if (
        (prevStatus === 'running' || prevStatus === 'restarting') &&
        isStoppedStatus(curStatus)
      ) {
        type = cur.exitCode !== 0 || cur.oomKilled ? 'explode' : 'fade'
      } else if (curStatus === 'restarting' && prevStatus !== 'restarting') {
        type = 'restart'
      }
    }

    prevRef.current = cur

    setState((s) => (type === 'none' ? s : { type, token: s.token + 1 }))
  }, [container.isNew, container.id, container.status, container.state])

  useEffect(() => {
    if (restartBump > 0) {
      setState((s) => ({ type: 'restart', token: s.token + 1 }))
    }
  }, [restartBump])

  const bumpRestart = () => setRestartBump((b) => b + 1)

  return { effect: state.type, token: state.token, bumpRestart }
}
```

- [ ] **Step 2: Sanity-check edge cases (no test framework — reason through)**
  - Brand-new id (isNew true) → `ignite`.
  - exited→running (started via HUD or CLI) → `ignite`.
  - running→exited, ExitCode 0 → `fade`.
  - running→exited, ExitCode 137 / OOMKilled → `explode`.
  - running→restarting→running → `restart` then `ignite`.
  - Repeated identical updates → `type` stays `none`, token unchanged, no replay.

- [ ] **Step 3: Verify build**

Run: `cd frontend; npm run build`
Expected: succeeds (hook is not imported yet, so tree-shaken).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useContainerEffects.js
git commit -m "feat(effects): add useContainerEffects status-diff hook"
```

---

### Task 2: `ExplosionBurst` particle + shockwave component

**Files:**
- Create: `frontend/src/components/ExplosionBurst.jsx`

**Interfaces:**
- Consumes: `onComplete(): void`, optional `duration` (default 1.4s).
- Produces: an additive particle burst + expanding shockwave ring parented into the caller's scene; calls `onComplete()` once when finished, then hides itself.

- [ ] **Step 1: Write the component**

```jsx
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
```

- [ ] **Step 2: Verify build**

Run: `cd frontend; npm run build`
Expected: succeeds (unused import is fine at build time only until Task 3 wires it — the file exports a component; Vite may flag no issue).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ExplosionBurst.jsx
git commit -m "feat(effects): add ExplosionBurst particles and shockwave ring"
```

---

### Task 3: Rework `ContainerStar` — uniform fix + 5 effect animations

**Files:**
- Modify: `frontend/src/components/ContainerStar.jsx` (full rewrite of the component body + fragment shader)

**Interfaces:**
- Consumes: `useContainerEffects` (Task 1), `ExplosionBurst` (Task 2), the existing props (`container`, `position`, `onSelect`, `selectedId`, `onOpenBridge`, `incident`).
- Produces: same props as before, plus passes `onAction(action)` down to `HolographicHUD` (caller of `bumpRestart` for `'restart'`).

- [ ] **Step 1: Rewrite `frontend/src/components/ContainerStar.jsx`**

Replace the entire file with the code below (vertex shader is unchanged; fragment shader gains `uColorMemory`, `uStopped`, `uRestartPulse` and replaces `uIsStopped`):

```jsx
import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { AnimatePresence } from 'framer-motion'
import HolographicHUD from './HolographicHUD'
import ExplosionBurst from './ExplosionBurst'
import useContainerEffects from '../hooks/useContainerEffects'

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
  uniform float uBirth;
  uniform float uRestartPulse;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vWorldPosition;

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
    float n1 = snoise(vPosition * 4.0 + time);
    float n2 = snoise(vPosition * 8.0 - time * 1.5) * 0.5;
    float granulation = n1 + n2;

    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float limbDarkening = pow(1.0 - fresnel, 0.5);

    float healthMix = smoothstep(30.0, 90.0, uCpu);
    vec3 color = mix(uColorHealthy, uColorError, healthMix);

    float memMix = smoothstep(30.0, 90.0, uMemory);
    color = mix(color, uColorMemory, memMix * 0.85);

    color = mix(color, vec3(1.0, 0.65, 0.2), uRestartPulse * 0.65);

    if (uIsPaused > 0.5) color = mix(vec3(0.8, 0.4, 0.0), vec3(0.4, 0.2, 0.0), sin(uTime)*0.5+0.5);

    vec3 surface = color * (0.8 + granulation * 0.4);
    surface *= (0.5 + limbDarkening * 1.0);

    surface += uColorError * pow(granulation, 8.0) * healthMix * 2.0;

    surface = mix(surface, vec3(1.0, 1.0, 1.0), uBirth);

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
    const baseSize = 0.5 + memory / 200

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

      {isRunning && (
        <pointLight
          color={cpu > 70 ? "#ff3300" : "#00ffff"}
          intensity={2 + birth * 10}
          distance={15}
        />
      )}

      {burst.active && (
        <ExplosionBurst
          key={burst.key}
          onComplete={() => setBurst((b) => ({ ...b, active: false }))}
        />
      )}

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
```

- [ ] **Step 2: Verify build**

Run: `cd frontend; npm run build`
Expected: succeeds. (Unknown props are not used — `HolographicHUD` ignores `onAction` until Task 4; the JSX passes it harmlessly.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ContainerStar.jsx
git commit -m "feat(effects): animate ignition, fade, explosion, restart pulse and memory color in ContainerStar"
```

---

### Task 4: `HolographicHUD` — optimistic `onAction` hook

**Files:**
- Modify: `frontend/src/components/HolographicHUD.jsx`

**Interfaces:**
- Consumes: new optional prop `onAction(action: string): void`.
- Produces: calls `onAction(action)` at the top of `handleAction(action)` for `'start' | 'stop' | 'restart' | 'kill' | 'pause' | 'unpause'`.

- [ ] **Step 1: Add the prop to the signature**

Find this line (top of the component):

```jsx
function HolographicHUD({ container, onClose, onOpenBridge }) {
```

Replace it with:

```jsx
function HolographicHUD({ container, onClose, onOpenBridge, onAction }) {
```

- [ ] **Step 2: Call `onAction` inside `handleAction`**

Find the `handleAction` definition (line ~270):

```jsx
  const handleAction = async (action) => {
    try {
```

Replace it with:

```jsx
  const handleAction = async (action) => {
    if (onAction) onAction(action)
    try {
```

- [ ] **Step 3: Verify build**

Run: `cd frontend; npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/HolographicHUD.jsx
git commit -m "feat(effects): fire optimistic onAction from HUD action buttons"
```

---

### Task 5: Full integration verification

**Files:** none changed.

- [ ] **Step 1: Full build**

Run: `cd frontend; npm run build`
Expected: succeeds with no warnings/errors.

- [ ] **Step 2: Manual smoke against real Docker (requires Docker running)**

1. Start the app (`docker compose up -d backend frontend` or `npm run dev` + backend).
2. Confirm a **brand-new container** ignites (scale 0→2 white flash ~1.5s) on first appearance.
3. Select a container in the HUD → press **Stop** → the star fades to dark over ~1.2s (graceful fade, no particles).
4. Select a container → press **Restart** → the star pulses (white/orange oscillation ~2s) immediately, then ignites again.
5. Select a container → press **Kill** (or `docker kill <id>`): running→exited with ExitCode 137 → red flash + particle burst + shockwave ring, then settles dark.
6. Confirm high-memory containers (mem ≥ 90%) take on a violet tint (memory→color) alongside the CPU gradient.

- [ ] **Step 3: Commit any stray changes**

```bash
git status
```

If clean and build green, nothing more.

---

## Self-Review Checklist

- **Spec coverage:** memory→color (Task 3 fragment), crash explosion (Tasks 2+3), ignite on start & brand-new id (Task 1+3), stop fade (Task 1+3), restart pulse optimistic + status edge (Tasks 1+3+4), uniform freeze fix (Task 3) — all covered.
- **Placeholders:** none; full file contents provided.
- **Type consistency:** hook returns `{ effect, token, bumpRestart }`; `ContainerStar` consumes exactly that; `HolographicHUD` gets `onAction`; `ExplosionBurst` takes `onComplete` + optional `duration`. Names match across tasks.