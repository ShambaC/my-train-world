# 🚂 MyTrainWorld - Railway Sandbox Game

A voxel-based train sandbox game built with React, Three.js, and Tauri.

## 🎮 Features

### Current Implementation (Phase 1)
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

### Coming Soon (Phase 2+)
- 🚧 Track placement system
- 🚧 Train placement and movement
- 🚧 Multiple train types
- 🚧 Track switching and signaling
- 🚧 Landscape editing tools
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
5. **Toggle debug info**: Enable "Show Debug Info" to see FPS and performance stats

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
├── terrain.js           # Terrain generation logic
├── main.jsx            # React entry point
└── index.css           # Tailwind styles
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
