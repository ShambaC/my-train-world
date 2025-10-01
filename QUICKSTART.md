# 🎮 MyTrainWorld - Quick Start Guide

## Getting Started

### Installation
```bash
npm install
npm run dev
```

Open your browser to: `http://localhost:1420/`

## 🕹️ Controls

### Mouse Controls
| Action | Control |
|--------|---------|
| Rotate Camera | Left Click + Drag |
| Pan Camera | Right Click + Drag |
| Zoom In/Out | Mouse Wheel Scroll |

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| ESC | Close Menu (future) |

## 🗺️ Terrain Generation

### Quick Start
1. Click the **menu icon** (top-right corner)
2. Adjust **Length** and **Breadth** sliders
3. Click **"Generate Terrain"**
4. Wait for generation to complete

### Terrain Size Guide
- **Small (50×50)**: Fast generation, good for testing
- **Medium (100×100)**: Balanced size, recommended
- **Large (150×150)**: More exploration, slower generation
- **Custom**: Adjust sliders for any size (20-200 units)

### Performance Tips
- Start with smaller terrains if FPS is low
- Enable debug mode to monitor performance
- Close other browser tabs for better performance

## 🔧 Debug Mode

Toggle debug info in the control panel to see:
- **FPS**: Frames per second (aim for 60)
- **Voxels**: Total voxel count in scene
- **Terrain Size**: Current dimensions
- **Controls**: Quick reference overlay

### Performance Targets
- ✅ **60 FPS**: Excellent
- ⚠️ **30-60 FPS**: Good
- ❌ **Below 30 FPS**: Reduce terrain size

## 🎨 Understanding Terrain

### Terrain Types (by height)
| Type | Color | Location |
|------|-------|----------|
| 💧 Water | Blue | Low areas |
| 🏖️ Sand | Beige | Beaches |
| 🌱 Grass | Green | Plains |
| 🪨 Rock | Gray | Hills |
| ❄️ Snow | White | Peaks |

### Visual Features
- Procedurally generated (unique every time)
- Low-poly voxel style
- Dynamic shadows
- Natural-looking landscapes

## 🚧 Coming Soon

### Phase 2: Tracks
- Place track pieces
- Connect tracks
- Build rail networks

### Phase 3: Trains
- Add trains to tracks
- Control train speed
- Watch trains run

### Phase 4: Advanced
- Edit terrain
- Build stations
- Economic system

## ❓ Troubleshooting

### Low FPS
1. Reduce terrain size
2. Close other applications
3. Update graphics drivers
4. Try a different browser (Chrome/Edge recommended)

### Terrain Not Loading
1. Check browser console for errors
2. Refresh the page
3. Clear browser cache
4. Restart dev server

### Controls Not Working
1. Click on the 3D view to focus
2. Check mouse/trackpad settings
3. Try different mouse button

### Menu Not Appearing
1. Click menu icon (top-right)
2. Refresh page if needed
3. Check browser zoom (100% recommended)

## 🎯 Best Practices

### For Best Experience
1. Use a mouse (better than trackpad)
2. Full-screen the browser window
3. Start with medium terrain size
4. Enable debug mode initially
5. Explore camera controls first

### For Performance
1. Close unnecessary tabs
2. Use hardware acceleration
3. Keep drivers updated
4. Monitor FPS in debug mode

### For Development
1. Keep console open
2. Use React DevTools
3. Test multiple terrain sizes
4. Monitor memory usage

## 🎓 Tips & Tricks

### Camera Navigation
- **Find good angle**: Rotate to 45° for best view
- **Reset view**: Refresh page
- **Explore peaks**: Zoom in on high terrain
- **Find water**: Look for blue areas

### Terrain Exploration
- Generate multiple times for variety
- Try different sizes for different experiences
- Look for interesting formations
- Find natural valleys and mountains

### UI Tips
- Collapse menu for clean view
- Use preset buttons for quick changes
- Slider precision: Click on bar to jump to value
- Debug info helps optimize size

## 📱 Future: Desktop Features (Tauri)

When desktop features are added:
- Save/Load game states
- File system access
- Better performance
- Native menus
- Offline mode

## 🤝 Need Help?

Check these files:
- `README.md` - General information
- `IMPLEMENTATION.md` - Technical details
- Browser console - Error messages
- Debug overlay - Performance metrics

---

**Have fun building your railway empire! 🚂**
