# MyTrainWorld - Implementation Details

## 🏗️ Architecture Overview

### Component Structure
```
App.jsx (Root)
├── LoadingScreen.jsx (Initial load)
├── GameScene.jsx (3D World)
│   └── Scene (Terrain + Lights + Camera)
└── ControlPanel.jsx (UI Controls)
```

## 🎨 Terrain Generation System

### Algorithm: Multi-Octave Simplex Noise

The terrain uses a sophisticated noise-based generation system:

```javascript
// Parameters
- Scale: 0.05 (controls feature size)
- Height Multiplier: 10 (max terrain height)
- Octaves: 4 (detail layers)
- Water Level: 2 (sea level)
```

### Height-Based Biomes
- **0-2**: Water (Blue, #4a90e2)
- **2-3**: Sand (Beige, #ddc490)
- **3-height-3**: Grass (Green, #5cb85c)
- **height-3 to height-1**: Rock (Gray, #808080)
- **height-1 to height**: Snow (White, #ffffff)

### Voxel System
- **Size**: 0.5 units (smaller than Minecraft's 1.0)
- **Rendering**: Instanced meshes for performance
- **Shading**: Flat shading for low-poly aesthetic
- **Shadows**: Enabled with dynamic lighting

## ⚡ Performance Optimizations

### 1. Instanced Rendering
Instead of creating individual meshes for each voxel, we group voxels by color and use `THREE.InstancedMesh`:

```javascript
Benefits:
- Single draw call per color type
- Reduced memory usage
- GPU-based transformations
- Handles 10,000+ voxels smoothly
```

### 2. Efficient Generation
- Pre-computed noise values
- Batched mesh creation
- Minimal state updates

### 3. Memory Management
- Geometry reuse across instances
- Single material per color
- Automatic cleanup on terrain regeneration

## 🎮 Controls & Interaction

### Camera System (OrbitControls)
- **Rotation**: Left mouse button + drag
- **Pan**: Right mouse button + drag
- **Zoom**: Mouse wheel
- **Damping**: Smooth, cinematic movement
- **Constraints**: 
  - Min distance: 5 units
  - Max distance: 100 units
  - Max polar angle: ~90° (prevents going below ground)

### UI Controls
- **Terrain Size**: 20-200 units (length & breadth)
- **Presets**: Small (50), Medium (100), Large (150)
- **Debug Toggle**: Real-time performance info
- **Menu Toggle**: Collapsible control panel

## 📊 Debug System

### Performance Metrics
```javascript
Displayed Information:
- FPS (Frames Per Second)
- Voxel Count (total rendered)
- Terrain Dimensions (length × breadth)
- Control Instructions
```

### Implementation
- Frame counting with 1-second intervals
- Non-intrusive overlay (top-left corner)
- Toggle-able for clean gameplay view

## 🎨 Styling (Tailwind CSS v3)

### Color Palette
- **Primary**: Blue (#2563eb)
- **Background**: Dark gray (#111827)
- **Accent**: Green (#22c55e)
- **Text**: White/Gray scale

### UI Components
- Responsive design
- Smooth transitions
- Hover states
- Disabled states for future features

## 🔮 Future Implementation Roadmap

### Phase 2: Track System
```javascript
Features to implement:
1. Track Types
   - Straight track
   - Curved track (45°, 90°)
   - Switch/junction tracks
   - Elevation changes

2. Placement System
   - Click-to-place interface
   - Snap-to-grid positioning
   - Connection validation
   - Visual feedback (valid/invalid)

3. Track Storage
   - Data structure for track network
   - Serialization for save/load
```

### Phase 3: Train System
```javascript
Features to implement:
1. Train Types
   - Steam locomotive
   - Diesel locomotive
   - Electric trains
   - Freight cars
   - Passenger cars

2. Physics System
   - Speed control
   - Acceleration/deceleration
   - Track following
   - Collision detection

3. Train Control
   - Start/stop controls
   - Speed adjustment
   - Direction control
   - Station stops
```

### Phase 4: Advanced Features
```javascript
1. Terrain Editing
   - Add/remove voxels
   - Flatten areas
   - Create tunnels
   - Build bridges

2. Stations & Buildings
   - Passenger stations
   - Freight depots
   - Maintenance yards
   - Decorative buildings

3. Economic System
   - Cargo transport
   - Passenger routes
   - Income/expenses
   - Research/upgrades

4. Save/Load (Tauri)
   - Save game state to file
   - Load saved games
   - Auto-save functionality
   - Multiple save slots
```

## 🛠️ Technical Decisions

### Why React Three Fiber?
- Declarative 3D scene management
- React hooks for Three.js
- Better state integration
- Active community

### Why Simplex Noise?
- Smoother than Perlin noise
- No directional artifacts
- Fast computation
- Natural-looking landscapes

### Why Instanced Meshes?
- Performance at scale
- Mobile-friendly
- Future-proof for larger worlds
- Industry standard

### Why Tailwind CSS?
- Rapid UI development
- Consistent design system
- Minimal custom CSS
- Excellent developer experience

## 📦 Dependencies Explained

### Core
- **react**: UI framework
- **three**: 3D rendering engine
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Three.js helpers (OrbitControls, Sky)

### Utilities
- **simplex-noise**: Terrain generation
- **tailwindcss**: Styling framework

### Development
- **vite**: Build tool & dev server
- **@tauri-apps/api**: Desktop app functionality

## 🐛 Known Limitations & TODOs

### Current Limitations
1. Terrain regeneration replaces entire world (no incremental updates)
2. No terrain editing yet
3. Camera can clip through tall mountains at close range
4. Large terrains (>150×150) may impact performance on lower-end devices

### Planned Improvements
1. Add terrain chunking for infinite worlds
2. Implement frustum culling
3. Add LOD (Level of Detail) system
4. Optimize shadow rendering
5. Add water animation
6. Implement fog for depth perception

## 💡 Development Tips

### Adding New Features
1. Create feature in separate component
2. Use React hooks for state
3. Keep Three.js logic in useEffect
4. Optimize with useMemo/useCallback
5. Test performance with debug mode

### Debugging
1. Enable debug overlay (shows FPS)
2. Check browser console for errors
3. Use React DevTools for component inspection
4. Monitor network tab for asset loading

### Performance Testing
1. Test with different terrain sizes
2. Monitor FPS in debug mode
3. Check memory usage in browser tools
4. Test on different devices

---

Last Updated: October 1, 2025
