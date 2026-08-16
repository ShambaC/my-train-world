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
- **Assets**: Draco-compressed GLB models loaded via `GLTFLoader`/`DRACOLoader` through `src/models/ModelLibrary.js` (`MODEL_SCALE = 0.3`)
- **Sub-Agents**: If you do not have vision capabilities. Use Mimo V2.5 or other vision capable models as sub agents for your vision related tasks like browser screenshotting or reading image attachments.

### Core Systems & Architecture

- **Terrain & World (`src/terrain.js`, `src/environment/`)**:
  - Procedural voxel terrain via Simplex noise (water, sand, grass) at 0.5 unit resolution.
  - Instanced rendering (`InstancedMesh`) for performance across terrain voxels and procedural trees/bushes.
  - `WaterSurface.jsx`: Custom Gerstner wave shader with depth-based foam, fresnel, caustics, and terrain heightmap masking.
  - `ForestBorder.js` & `FogWall.jsx`: Instanced border tree ring and animated cylindrical cloud wall hiding map edges.
  - `Skybox.jsx`: Time-of-day lighting and skybox presets (dawn, day, dusk, night) via `getLightingForTime`.
  - `ScatterProps.jsx`: Probability-based scattering of instanced GLB props (trees, rocks, buildings, fences), excluding water, slopes, tracks, and station zones.
  - `GrassField.jsx` (+ `grassShaders.js`, `grassMaterials.js`): Stylized instanced grass field (ported from cortiz2894/stylized-components) — wind-swayed shader blades (gradient + patch color, fake +Y normal, soft ring-sampled shadows, backlit translucency) and alpha-mask flower cross-billboards (`src/assets/Textures/flower{,3}/`, custom depth materials). Scattered deterministically per terrain seed as DENSE IRREGULAR patches (16-sample radial blob outlines, outward-spraying blades): one patch compulsory at every tree base (`scatterRegistry.trees`, any dry biome), others on meadow/forest cells kept `PATCH_SPACING` apart; hidden (zero-scale) under tracks/stations/roads/scattered buildings via the same exclusion pass + road version poll as ScatterProps; sway syncs with the shared wind clock, sun dir/color + night dim from `lighting`.
  - `CameraController.jsx`: WASD camera-relative movement (Shift sprint, Space rise, C lower) that moves the `OrbitControls` target with the camera.

- **Track System (`src/tracks/`)**:
  - `trackGeometry.js`: Central geometric math for straight/curved tracks (0.5 voxel grid, 0.25 arc radius, tangent calculations, Three.js world transforms).
  - `TrackManager.js`: Graph management, closest-pair endpoint auto-connection (`front`/`back`), grid snapping, and placement validation.
  - `TrackModels.js`: Procedural track geometry (rails via `TubeGeometry`, ballast boxes, sleepers, bridge trestle supports).
  - `TrackRenderer.jsx`: Track mesh rendering and exact-model translucent placement/delete ghost previews (`src/utils/ghost.js`).
  - `OverheadLine.jsx`: Procedural electrification gantries (gate-shaped poles + sagging contact wires + messenger wire) every 5 tracks per connected chain, at both ends for chains < 5 tracks; derived from the track layout, rebuilt on track changes, never stores user state.

- **Train Simulation (`src/trains/`)**:
  - `TrainModel.js`: Low-poly procedural voxel locomotive (boiler, cab, smokestack, cowcatcher, headlight).
  - `TrainManager.js`: Physics-free path traversal across connected track graphs, progress interpolation, fallback reverse handling on dead ends, and speed control.
  - Coach system: `addCoach` attaches coaches behind engines (`coachTypes.js` defines `COACH_TYPES`/`COACH_LENGTH`); trains with coaches never reverse at dead ends. Procedural per-type coach models (`PassengerCoachModel.js`, `GoodsCoachModel.js`, `GasCoachModel.js`, `ContainerCoachModel.js`, `ViewdeckCoachModel.js`, `CoalCartModel.js`).
  - `TrainRenderer.jsx` & `SmokeParticles.jsx`: Train rendering and instanced particle system (wobble, spin, cubic ease scale, color fade).

- **Station System (`src/stations/`)**:
  - `StationManager.js`: Station storage and track binding (tracks running beside a station become stops; lateral 0.75..2.5 units, same ground height, axially overlapping).
  - `StationBuilder.js`: Composes decorated station groups from two marker cells (`STATION_WIDTH` 3 voxels, `PLATFORM_HEIGHT` 0.15, min/max length 8..40 voxels) with pop-animation metadata; prop jitter is deterministic per marker cell (`mulberry32`) so undo/redo and save-load rebuild identical stations.
  - `StationRenderer.jsx` & `src/hooks/useStationPlacement.js`: Two-marker placement ghost with green/red validation and wave pop-out reveal.

- **Model Library (`src/models/ModelLibrary.js`)**:
  - Loads, normalizes and caches all Draco-compressed GLB props (buildings, props, rocks, trees, trains) at `MODEL_SCALE = 0.3`; bakes node transforms and centers bases at y=0.

- **Roads & Traffic (`src/environment/`)**:
  - `roadNetwork.js`: Deterministic scenery road network (seeded, any non-highland biome, slope <= 1, clearing cells excluded). `RoadManager` stores roads (polyline waypoints per road, widths per type) + lamps/signs; supports user-placed straight road segments (`addRoad`/`removeRoad`, road crossings allowed, `restoreUserRoad`/`exportUserData`/`importUserData` for undo + save-load) merged with the natural layout. `createRoadMeshes` renders instanced asphalt/shoulder/dirt quads (no sidewalks at crossroads, later road lifted to avoid z-fighting), lamp posts with night-glow, and signs. `ScatterProps` excludes road cells so props never sit on the surface; a version poll keeps meshes/exclusions/traffic in sync with runtime road edits.
  - `scatterRegistry.js`: Runtime record of scattered buildings (barns/sheds/huts) and trees (oaks/pines) so roads, walkers and GrassField can target them without duplicating scatter logic.
  - `TrafficManager.js` & `TrafficRenderer.jsx`: Pooled decorative vehicles (car/truck/bus/cart/bike) and road-edge pedestrians. Vehicles despawn/respawn with random type from either road end; walkers walk the road edge only. All actors stop at active railway crossings (approach-relative). Delta-time based, frozen beyond 45 units from camera.
  - `Roads.jsx`: Builds road layout per terrain; fades lamp glow with `lighting.nightness`.
  - Road placement: Hotbar Road tool (straight, axis-aligned, R rotates, Delete tool removes).

- **Signals (`src/signals/`)**:
  - `SignalManager.js`: Deterministic auto-scattered signals beside long track runs (`rebuildAuto`, seeded, runs >= 5 tracks, every 15th track, dead-end signals). States (clear/approaching/occupied/departing) derive from along-track train distance — visual only, never stop trains. Aspect mapping per type (two/platform, three, junction).
  - `SignalsRenderer.jsx` & `signalModels.js`: Renders the `colour-light-signal` GLB with additive aspect lamps; React reconciles only on topology changes. Auto-regenerated on every track layout change (no user tool).
  - `src/tracks/pathDistance.js`: `distanceAlongTrack` — Dijkstra over the track graph for track-relative approach detection.

- **Road-Rail Crossings (`src/crossings/`)**:
  - `CrossingManager.js`: Detects track×road intersections (per-type tolerance ≈ half road width), groups hits, merges crossings of the same connected track line over one road. State machine open → warning → closing → closed → opening (gates stay closed while ANY consist part is on/within exit margin; stopped/reversed trains never cause unsafe opening). Optional bell/gate-motor/whistle audio via `trainAudio`.
  - `CrossingRenderer.jsx` & `crossingModels.js`: Rebuilds on track/road layout changes (signature poll), animates barrier arms + alternating red warning lamps imperatively.

- **Post-Processing (`src/postprocessing/Effects.jsx`)**:
  - `EffectComposer` pipeline always mounted: an unconditional final color pass (ACES exposure 1.1, saturation 1.2, vignette 0.15 — vanilla now matches miniature-mode grading) plus toggleable `TiltShiftShader` blur (miniature mode) and `CelShader` (posterized luminance + Sobel edge detection). Tone mapping/output color space are handled by the final pass while mounted.

- **UI & Controls (`src/ui/`, `src/ControlPanel.jsx`, `src/hooks/useTrackPlacement.js`)**:
  - `Hotbar.jsx`: Tool switcher (Hand, Straight, Curved, Road, Train, Station, Coach, Delete) with keyboard shortcuts (1-8, Escape to deselect, R to rotate/flip, Q/E/X for bridge heights).
  - `ControlPanel.jsx`, `TrainControl.jsx` (per-train start/stop, reverse, focus, follow, coach removal), `EnvironmentSettings.jsx` (time-of-day, fog, shadows, effects, ambient/traffic/signals toggles, audio volume sliders via `trainAudio` buses) & `PerformanceSettings.jsx`: frame limit/vsync and debug statistics.
  - `WorldControls.jsx`: Undo/redo (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, `src/utils/history.js`), save/load as user-picked `.world` files (`src/utils/worldSave.js` — JSON; File System Access API with download/file-input fallbacks), quiet localStorage autosave + recovery snapshots (recent + fallback rotation, snapshot before destructive terrain regen), reset-overview/frame-railway camera buttons.
  - `SelectionPanel.jsx`: Hand-tool entity selection (train/station/track) with read-only route inspection (`src/utils/inspect.js` — connected tracks, route distance, dead ends, segments) and permissive controls; consist highlight rings in `TrainRenderer.jsx`.
  - `src/environment/CameraCommands.jsx` & `src/utils/cameraBus.js`: In-scene camera focus/frame/reset/ease commands (non-forced construction framing assist on tool select).
  - Placement QoL (`src/hooks/useTrackPlacement.js`, `src/hooks/useStationPlacement.js`): ghost recomputes on camera/tool/rotation/height/terrain/track changes; clicks recompute ghost synchronously from the event (no mouse-away workaround); grid snapping only (no endpoint snap assist); pointer-leave hides ghost while keeping the last pointer position.
  - `CoachMenu.jsx`: Radial coach picker (thumbnails in a circle) opened by clicking an engine with the Coach tool; `GameScene.jsx` orchestrates scene composition (terrain, tracks, stations, activity, roads/traffic, signals, crossings, trains) and `LoadingScreen.jsx` shows asset-load progress.
  - `App.jsx` owns all managers (track/station/train/road/signal refs, `HistoryManager`), selection state, save/load/recover handlers and autosave scheduling; `GameScene.jsx` receives them as props and owns traffic/crossing managers, version counters and camera follow. `handleTerrainReady` applies pending world loads after terrain regeneration.
