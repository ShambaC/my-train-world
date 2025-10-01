# Changelog

All notable changes to MyTrainWorld will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Phase 2: Track Placement System 🎉
- **Track System**
  - Two track types: Straight and Curved (90° turns)
  - Click-to-place track placement on terrain
  - Ghost preview with transparency before placement
  - Visual validation: Green tint for valid, red for invalid placements
  - Snap-to-grid positioning for perfect alignment
  - Track data management with TrackManager class
  - Instanced rendering for performance

- **Rotation System**
  - Press R key to rotate tracks before placing
  - Rotation state persists between placements
  - Works with both track types
  - Visual feedback in debug overlay

- **Interactive Hotbar**
  - Bottom-screen tool selector
  - Number key shortcuts (1-5)
  - Mouse click selection
  - Visual indication of selected tool
  - Expandable for future tools

- **Delete Mode**
  - Dedicated delete tool (key 3)
  - Click-to-delete placed tracks
  - Track removal with connection cleanup

- **Bridge Mode (Bonus Feature)**
  - Adjustable track height with Q/E keys
  - Place tracks at elevated positions
  - X key to reset to ground level
  - Height offset indicator when active
  - Foundation for future bridge/viaduct features
  - Automatic track angling (prepared for height transitions)

- **Smart Click Detection**
  - UI clicks don't trigger world placement
  - Canvas-aware click handling
  - Prevents accidental placement when using controls

### Technical Improvements
- Created modular track system architecture
- Custom hook (useTrackPlacement) for raycasting
- Separation of concerns: models, rendering, management
- Real-time validation system
- Performance-optimized with instanced meshes

### Changed
- **Terrain Generation Overhaul**
  - Reduced height variation for flatter, more buildable terrain
  - Changed from mountainous to plains-focused landscape
  - Adjusted noise parameters for gentler slopes
  - Removed snow and rock biomes (too steep for railways)
  - Optimized terrain for track placement

### Added
- **Vegetation System**
  - Procedurally generated voxel trees (3-4 blocks tall)
  - Simple bushes with rounded shapes
  - Noise-based placement for natural distribution
  - Proper spacing system to prevent clustering
  - ~8% vegetation coverage on grass areas
  - Trees have brown trunks and green canopies
  - Performance-optimized instanced rendering

### Planned
- Track placement system
- Train spawning and movement
- Terrain editing tools
- Save/Load functionality using Tauri
- Multiple train types and models
- Station system
- Economic gameplay elements

## [0.1.0] - 2025-10-01

### Added - Initial Release 🎉
- **Terrain Generation System**
  - Procedural voxel terrain using Simplex noise algorithm
  - Multi-octave noise for natural-looking landscapes
  - 5 terrain types: water, sand, grass, rock, and snow
  - Height-based biome distribution
  - Customizable terrain size (20-200 units for both length and breadth)
  - High-resolution voxels (0.5 unit size)

- **3D Rendering**
  - Three.js integration via React Three Fiber
  - Instanced mesh rendering for optimal performance
  - Flat shading for low-poly aesthetic
  - Dynamic directional lighting with shadows
  - Sky system with atmospheric effects
  - Grid helper for spatial reference

- **Camera System**
  - Orbit controls for intuitive navigation
  - Left-click to rotate view
  - Right-click to pan
  - Mouse wheel to zoom
  - Smooth camera damping
  - Constrained angles (prevents underground view)
  - Distance limits (5-100 units)

- **User Interface**
  - Modern dark theme using Tailwind CSS v3
  - Collapsible control panel
  - Terrain size sliders with real-time preview
  - Quick preset buttons (Small/Medium/Large)
  - Loading screen with progress bar
  - Title overlay with project branding
  - Responsive design

- **Debug System**
  - Toggle-able debug overlay
  - Real-time FPS counter
  - Voxel count display
  - Terrain dimensions display
  - Control instructions overlay
  - Performance monitoring

- **Performance Optimizations**
  - Instanced rendering (single draw call per color)
  - Efficient memory management
  - Geometry reuse across instances
  - Batched mesh creation
  - GPU-based transformations

- **Developer Experience**
  - Hot module replacement (HMR)
  - Vite for fast development builds
  - Tauri integration ready (not yet utilized)
  - Comprehensive documentation (README, IMPLEMENTATION, QUICKSTART)
  - Clean project structure
  - Well-commented code

### Technical Stack
- React 19.1.0
- Three.js (latest)
- @react-three/fiber (latest)
- @react-three/drei (latest)
- Tailwind CSS 3.x
- Simplex-noise (latest)
- Vite 7.1.7
- Tauri 2.x

### Documentation
- `README.md` - Project overview and setup
- `IMPLEMENTATION.md` - Technical architecture and details
- `QUICKSTART.md` - User guide and controls
- `CHANGELOG.md` - Version history

### Known Issues
- None reported in initial release

### Performance Notes
- Tested with terrains up to 200×200 units
- Maintains 60 FPS on medium-range hardware
- Larger terrains may require better hardware
- Recommended starting size: 50×50 (Medium preset)

---

## Version History

### Version Numbering
- **Major**: Breaking changes or complete feature overhauls
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes and minor improvements

### Upcoming Versions
- **v0.2.0**: Track placement system
- **v0.3.0**: Train system with physics
- **v0.4.0**: Terrain editing tools
- **v0.5.0**: Save/Load functionality
- **v1.0.0**: Full game release with all core features

---

[Unreleased]: https://github.com/yourusername/mytrainworld/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/mytrainworld/releases/tag/v0.1.0
