Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project-Specific Instructions

- Dev server is always on and available at port 1420. Do not run dev server again for testing.
- Always reply in caveman. Find and activate skill if necessary.

## 6. Project Details

### Tech Stack
- **Framework & Runtime**: React 19, Vite 7, Tauri 2 (`@tauri-apps/api`, `@tauri-apps/cli`)
- **3D & Graphics**: Three.js (r180), `@react-three/fiber` (v9), `@react-three/drei` (v10)
- **Styling & Math**: Tailwind CSS v3, `simplex-noise` (v4)

### Core Systems & Architecture

- **Terrain & World (`src/terrain.js`, `src/environment/`)**:
  - Procedural voxel terrain via Simplex noise (water, sand, grass) at 0.5 unit resolution.
  - Instanced rendering (`InstancedMesh`) for performance across terrain voxels and procedural trees/bushes.
  - `WaterSurface.jsx`: Custom Gerstner wave shader with depth-based foam, fresnel, caustics, and terrain heightmap masking.
  - `ForestBorder.js` & `FogWall.jsx`: Instanced border tree ring and animated cylindrical cloud wall hiding map edges.
  - `Skybox.jsx`: Time-of-day lighting and skybox presets (day, golden, sunset, night).

- **Track System (`src/tracks/`)**:
  - `trackGeometry.js`: Central geometric math for straight/curved tracks (0.5 voxel grid, 0.25 arc radius, tangent calculations, Three.js world transforms).
  - `TrackManager.js`: Graph management, closest-pair endpoint auto-connection (`front`/`back`), grid snapping, and placement validation.
  - `TrackModels.js`: Procedural track geometry (rails via `TubeGeometry`, ballast boxes, sleepers, bridge trestle supports).
  - `TrackRenderer.jsx`: Track mesh rendering and exact-model translucent placement/delete ghost previews (`src/utils/ghost.js`).

- **Train Simulation (`src/trains/`)**:
  - `TrainModel.js`: Low-poly procedural voxel locomotive (boiler, cab, smokestack, cowcatcher, headlight).
  - `TrainManager.js`: Physics-free path traversal across connected track graphs, progress interpolation, fallback reverse handling on dead ends, and speed control.
  - `TrainRenderer.jsx` & `SmokeParticles.jsx`: Train rendering and instanced particle system (wobble, spin, cubic ease scale, color fade).

- **Post-Processing (`src/postprocessing/Effects.jsx`)**:
  - Custom `EffectComposer` pipeline with toggleable `TiltShiftShader` (miniature depth of field + saturation + vignette) and `CelShader` (posterized luminance + Sobel edge detection).

- **UI & Controls (`src/ui/`, `src/ControlPanel.jsx`, `src/hooks/useTrackPlacement.js`)**:
  - `Hotbar.jsx`: Tool switcher (Hand, Straight, Curved, Train, Delete) with keyboard shortcuts (1-5, R to rotate, Q/E/X for bridge heights).
  - `ControlPanel.jsx` & `TrainControl.jsx`: Terrain sizing, train speed/dispatch controls, environment adjustments, and debug statistics.
