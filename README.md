# 🚂 MyTrainWorld - Railway Sandbox Game

A voxel-based train sandbox game built with React, Three.js, and Tauri.

## 🎮 Features

### Current Implementation (Phase 1 + Phase 2)
- ✅ **Randomized Voxel Terrain Generation**
  - Procedurally generated terrain using Simplex noise
  - Customizable terrain size (length × breadth)
  - **Optimized for railway construction** - Mostly flat plains with gentle hills
  - Multiple terrain types: water, sand, and grass
  - High-resolution voxels (smaller than Minecraft for better detail)
  - Optimized rendering using instanced meshes

- ✅ **Vegetation System**
  - Procedurally placed trees (3-4 voxels tall with canopy)
  - Simple bushes (rounded, 2 voxels high)
  - Natural distribution using noise-based placement
  - Proper spacing between vegetation
  - ~8% coverage on suitable terrain

- ✅ **Track Placement System** 🆕
  - **Two track types**: Straight and curved (90°)
  - **Click-to-place** on terrain with mouse
  - **Ghost preview** showing track before placement
  - **Visual feedback**: Green for valid placement, red for invalid
  - **Rotation system**: Press R or use hotbar to rotate tracks
  - **Hotbar interface**: Select tools with mouse or number keys (1-2)
  - **Delete mode**: Remove placed tracks
  - **Bridge mode**: Adjustable height with Q/E keys for elevated tracks
  - **Snap-to-grid** for perfect alignment
  - **UI-aware clicking**: Control panel clicks don't interfere with world

- ✅ **Interactive Hotbar**
  - Tool selection with mouse or number keys (1-5)
  - Visual feedback for selected tool
  - Keyboard shortcuts displayed
  - Expandable for future tools (trains, stations, etc.)

- ✅ **Interactive 3D Camera**
  - Orbit controls for navigation
  - Mouse controls: Left-click to rotate, right-click to pan, scroll to zoom
  - Smooth camera damping

- ✅ **Control Panel UI**
  - Adjustable terrain dimensions (20-200 units)
  - Quick preset sizes (Small, Medium, Large)
  - Toggle menu for clean gameplay view

- ✅ **Performance Monitoring**
  - Real-time FPS counter
  - Voxel count display
  - Debug information overlay
  - Performance-optimized rendering

- ✅ **Responsive UI with Tailwind CSS v3**
  - Modern, clean interface
  - Dark theme suitable for gameplay
  - Smooth transitions and animations

### Coming Soon (Phase 3+)
- 🚧 Train placement and movement
- 🚧 Multiple train types with physics
- 🚧 Track switching and signaling
- 🚧 Landscape editing tools
- 🚧 Station system
- 🚧 Save/Load functionality (using Tauri)

## 🛠️ Tech Stack

- **Frontend Framework**: React 19
- **3D Rendering**: Three.js + React Three Fiber
- **3D Helpers**: @react-three/drei
- **Styling**: Tailwind CSS v3
- **Build Tool**: Vite
- **Desktop Framework**: Tauri 2
- **Terrain Generation**: Simplex Noise

## 📦 Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run Tauri app (desktop)
npm run tauri dev
```

## 🎯 Usage

1. **Launch the application**: `npm run dev` and open http://localhost:1420/
2. **Adjust terrain size**: Use the control panel sliders or preset buttons
3. **Generate terrain**: Click "Generate Terrain" to create a new world
4. **Navigate**: 
   - Left mouse button: Rotate camera
   - Right mouse button: Pan camera
   - Mouse wheel: Zoom in/out

### Building Railways 🛤️

5. **Select track type**: 
   - Press `1` for straight tracks
   - Press `2` for curved tracks
   - Press `3` for delete tool
   - Or click tools in the hotbar at the bottom

6. **Place tracks**:
   - Move mouse over terrain to see ghost preview
   - Green = valid placement, Red = invalid
   - Press `R` to rotate before placing
   - Click to place the track

7. **Build bridges** (elevated tracks):
   - Press `Q` to lower track height
   - Press `E` to raise track height
   - Press `X` to reset to ground level
   - Tracks will angle automatically between different heights

8. **Delete tracks**:
   - Select delete tool (press `3`)
   - Click on tracks to remove them

9. **Toggle debug info**: Enable "Show Debug Info" to see FPS, track count, and performance stats

## 🎨 Terrain Generation

The terrain uses multi-octave Simplex noise for natural-looking landscapes, optimized for railway construction:

- **Water level**: Blue voxels at lower elevations
- **Sand**: Transition zone near water
- **Grass**: Primary terrain surface (plains and gentle hills)
- **Trees**: Dark green canopy with brown trunks (3-4 voxels tall)
- **Bushes**: Rounded vegetation (2 voxels high)

The terrain is intentionally flatter than typical voxel games to make it suitable for placing railway tracks. Mountains are rare, with most of the terrain consisting of plains and gentle, gradual slopes.

Voxel size is set to 0.5 units for higher resolution compared to Minecraft-style games.

## ⚡ Performance

- Instanced rendering for efficient GPU usage
- Optimized for terrains up to 200×200 units
- Real-time FPS monitoring
- Flat shading for authentic low-poly aesthetic

## 🗺️ Project Structure

```
src/
├── App.jsx              # Main application component
├── GameScene.jsx        # 3D scene with terrain and camera
├── ControlPanel.jsx     # UI controls for terrain generation
├── LoadingScreen.jsx    # Initial loading screen
├── terrain.js           # Terrain & vegetation generation logic
├── main.jsx            # React entry point
├── index.css           # Tailwind styles
├── tracks/
│   ├── TrackModels.js   # 3D track model generation
│   ├── TrackManager.js  # Track data management
│   └── TrackRenderer.jsx # Track rendering component
├── hooks/
│   └── useTrackPlacement.js # Track placement logic hook
└── ui/
    └── Hotbar.jsx       # Tool selection hotbar
```

## 🚀 Next Steps

1. **Phase 2**: Track placement system
   - Click-to-place track pieces
   - Track connection validation
   - Multiple track types (straight, curved, switches)

2. **Phase 3**: Train system
   - Train spawning
   - Physics-based movement
   - Train control (start/stop/speed)

3. **Phase 4**: Advanced features
   - Terrain editing
   - Multiple train types with different characteristics
   - Station system
   - Save/Load game state

## 📝 Development Notes

- Tauri functionality is prepared but not yet implemented
- All 3D models are currently procedurally generated
- The game is designed with performance in mind for smooth gameplay
- Debug mode provides valuable insights during development

## 🤝 Contributing

This is a personal project, but suggestions and ideas are welcome!

## 📄 License

MIT License - See package.json for details

---

Built with ❤️ using React, Three.js, and Tauri

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
