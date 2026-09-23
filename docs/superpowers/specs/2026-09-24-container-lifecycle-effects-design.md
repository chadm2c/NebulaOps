# Design: Container Lifecycle Effects (NebulaOps)

Date: 2026-09-24

## Problem

The PRD (nebulaops_prd.md §7.2, §7.4, §7.5) lists container-behavior visual
effects that are missing or incomplete in the 3D galaxy:

1. High memory usage -> color change (currently memory only changes star size;
   the `uMemory` uniform is dead).
2. Container crash -> explosion animation (currently exited stars just sit as a
   flat dark sphere).
3. Container start -> star ignition (currently only brand-new WS ids get a
   birth flash; a container that starts later never ignites).
4. Container stop -> star fade (currently an instant dark state with no fade
   animation).
5. Container restart -> pulse animation (not implemented at all).

A latent bug also blocks status-driven rendering: star uniforms are created via
`useMemo([], ...)` so `uIsStopped`, `uIsPaused`, `uIsIncident`, `uMemory` are
frozen at mount and never update when a container changes status.

## Decisions (from brainstorming)

- Demo mode stays static; effects trigger on **real Docker status transitions**
  only (containers go through `running`/`exited`/`paused`/`restarting` in the
  2s WS stream).
- Crash vs fade is decided by exit code + OOMKilled:
  - `running -> exited/stopped` with `ExitCode == 0` -> **fade**
  - `running -> exited/stopped` with non-zero `ExitCode`, `OOMKilled`, or
    `dead` -> **explode**
- Restart pulse is **optimistic**: it fires the moment the user clicks Restart
  in the HUD, and also on any `status === 'restarting'` frame over WS.
- Ignition covers BOTH a brand-new container id (`isNew`) and any transition
  into `running`, sharing one flash animation, so a fresh container that starts
  running always gets the star-ignition animation.

## Approach

Self-contained effect engine inside `ContainerStar` (Approach A from
brainstorming). Each star diffs its own previous status/state, derives a one-shot
effect token, and animates itself. No App/Galaxy wiring, no backend changes.

## Changes

### 1. `frontend/src/hooks/useContainerEffects.js` (new)

- Tracks `prevRef = { status, exitCode, oomKilled }` per container id.
- On each container update, diffs against the previous snapshot and returns an
  effect token: `ignite` | `fade` | `explode` | `restart` | `none`.
- Token is monotonically increasing so repeated 2s WS payloads never replay an
  effect (edge-triggered only).
- Exposes `triggerOptimisticRestart()` for the HUD button.

### 2. `frontend/src/components/ContainerStar.jsx`

- Consume the hook; drive animation from the effect token + start time.
- **Uniform fix**: write `uTime`, `uCpu`, `uMemory`, `uIsPaused`, `uIsStopped`,
  `uIsIncident`, `uBirth`, `uRestartPulse`, `uFade` every frame in `useFrame`
  from live props + active effect. Remove the frozen `useMemo([])` uniform
  pattern.
- **#2 memory color**: add `uColorMemory` (violet) and
  `uMemMix = smoothstep(30.0, 90.0, uMemory)`; final health color becomes
  `mix(cpuColor, uColorMemory, uMemMix * 0.85)`. Corona tints toward the memory
  color too.
- **#4 ignite**: brand-new id OR transition into `running` -> reuse existing
  flash (scale 0 -> 2, white `uBirth`, settle ~1.5s).
- **#5 fade**: `running -> exited` (exit 0) -> `fadeFactor` 0->1 over ~1.2s
  that lerps `uIsStopped`, shrinks the star, dims the point light.
- **#3 explode**: `running -> exited` (exit != 0 / OOMKilled / `dead`) -> short
  red/white flash, spawn `ExplosionBurst` (~1.5s), settle to stopped-dark.
- **#6 restart pulse**: `status === 'restarting'` or optimistic click ->
  `uRestartPulse` oscillates scale and flashes white/orange (~2s).

### 3. `frontend/src/components/ExplosionBurst.jsx` (new)

- Parented inside the star group; inherits the star's position.
- ~150 additive particles flying outward + an expanding fading shockwave ring.
- Self-unmounts via `onComplete`.

### 4. `frontend/src/components/HolographicHUD.jsx`

- Accept an `onAction` prop; `handleAction` calls it alongside the docker API
  call so `restart` triggers the optimistic pulse immediately.

## Verification

- `cd frontend && npm run build` (canonical frontend check; no lint/typecheck
  scripts exist).
- Manual smoke against real Docker: start/stop/kill/restart a live container
  and confirm the 2s WS-driven animations (ignite / fade / explode / pulse) and
  that brand-new containers ignite on first appearance.

## Out of scope

- Containers that vanish entirely from the snapshot (no "gone" effect).
- Demo-mode status simulation (decision: real Docker only).