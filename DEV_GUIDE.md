# Development Tips & Best Practices

## 🎨 Working with the Codebase

### Key Files to Know

#### Core Game Logic
- **`src/terrain.js`** - Terrain and vegetation generation algorithms
- **`src/GameScene.jsx`** - 3D scene, lighting, camera setup
- **`src/App.jsx`** - Main app state and component orchestration

#### UI Components
- **`src/ControlPanel.jsx`** - Settings and controls UI
- **`src/LoadingScreen.jsx`** - Initial loading experience

#### Styling
- **`src/index.css`** - Tailwind imports and global styles
- **`tailwind.config.js`** - Tailwind configuration

---

## 🔧 Common Development Tasks

### Testing Terrain Changes

1. **Quick iteration**:
   ```javascript
   // In terrain.js, adjust these:
   const scale = 0.03;          // Feature size
   const heightMultiplier = 4;   // Max height
   const vegetationDensity = 0.08; // Vegetation amount
   ```

2. **See changes immediately**: File saves trigger HMR
3. **Use debug mode**: Monitor FPS impact
4. **Test different sizes**: Small (50), Medium (100), Large (150)

### Adding New Terrain Types

```javascript
// 1. Add color to TERRAIN_COLORS
const TERRAIN_COLORS = {
  grass: 0x5cb85c,
  newType: 0xHEXCOLOR, // Add here
};

// 2. Add logic in terrain generation
if (condition) {
  color = TERRAIN_COLORS.newType;
}
```

### Adjusting Vegetation

```javascript
// In generateVegetation function:

// Change density (0.0 to 1.0)
const vegetationDensity = 0.08; // 8%

// Change spacing
const minSpacing = 3; // Units between plants

// Change sampling rate
for (let x = 0; x < length; x += 2) // Change +=2
```

---

## 🎮 Camera & Controls

### Adjusting Camera Position

```javascript
// In GameScene.jsx:
<Canvas
  camera={{ 
    position: [20, 15, 20], // [x, y, z]
    fov: 60                 // Field of view
  }}
>
```

### OrbitControls Settings

```javascript
<OrbitControls
  enableDamping          // Smooth movement
  dampingFactor={0.05}   // Lower = smoother
  minDistance={5}        // Closest zoom
  maxDistance={100}      // Farthest zoom
  maxPolarAngle={Math.PI / 2.1} // Prevent underground
/>
```

---

## 🎨 UI Customization

### Changing Colors

In Tailwind classes:
```jsx
// Background colors
className="bg-gray-800"  // Dark gray
className="bg-blue-600"  // Blue button

// Text colors
className="text-white"   // White text
className="text-gray-400" // Gray text

// Hover states
className="hover:bg-blue-700"
```

### Adding New UI Elements

1. **Add to ControlPanel.jsx** for settings
2. **Add to GameScene.jsx** for overlays
3. Use Tailwind classes for styling
4. Pass props to App.jsx for state

---

## ⚡ Performance Optimization

### Monitoring Performance

```javascript
// Enable debug mode in UI
// Watch these metrics:
- FPS: Should be 60 on good hardware
- Voxels: More = slower
- Generation time: Monitor console

// Browser DevTools:
// F12 > Performance tab > Record
```

### Optimization Strategies

1. **Reduce terrain size** if FPS drops
2. **Lower vegetation density**
3. **Use instanced meshes** (already done)
4. **Reduce shadow quality** (in GameScene.jsx):
   ```javascript
   shadow-mapSize-width={1024}  // Lower from 2048
   ```

### Instance Limits

```javascript
// In terrain.js, track instance counts:
- Terrain voxels: < 10,000 ideal
- Vegetation: < 1,000 ideal
- Total: < 15,000 for 60 FPS
```

---

## 🐛 Debugging

### Common Issues & Solutions

#### Terrain Not Generating
```javascript
// Check console for errors
// Verify terrain size is valid
// Check noise function is working
console.log('Generating terrain:', length, breadth);
```

#### Low FPS
```javascript
// Reduce terrain size
// Lower vegetation density
// Check browser console for errors
// Try different browser (Chrome/Edge best)
```

#### UI Not Responding
```javascript
// Check React DevTools
// Verify state updates
// Check for console errors
console.log('State:', terrainSize, showDebug);
```

### Logging Tips

```javascript
// In terrain generation:
console.log('Height at', x, z, '=', height);

// In components:
useEffect(() => {
  console.log('Terrain updated:', terrainSize);
}, [terrainSize]);
```

---

## 📦 Adding Dependencies

### Install New Packages

```bash
# Development dependency
npm install -D package-name

# Runtime dependency
npm install package-name

# Specific version
npm install package-name@version
```

### Common Packages You Might Need

```bash
# For Phase 2 (Tracks):
npm install uuid           # Generate unique IDs
npm install zustand        # State management

# For Phase 3 (Trains):
npm install @use-gesture/react  # Mouse gestures

# For saving:
npm install localforage    # Browser storage
```

---

## 🎯 Code Style

### React Best Practices

```javascript
// Use hooks correctly
const [state, setState] = useState(initial);

useEffect(() => {
  // Side effects here
  return () => {
    // Cleanup
  };
}, [dependencies]);

// Memoize expensive calculations
const value = useMemo(() => {
  return expensiveOperation();
}, [dependencies]);
```

### Three.js Best Practices

```javascript
// Reuse geometry
const geometry = new THREE.BoxGeometry();

// Use instanced meshes for repeated objects
const mesh = new THREE.InstancedMesh(geometry, material, count);

// Clean up resources
useEffect(() => {
  return () => {
    geometry.dispose();
    material.dispose();
  };
}, []);
```

---

## 📚 Useful Resources

### Documentation
- [Three.js Docs](https://threejs.org/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [Drei Helpers](https://github.com/pmndrs/drei)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Tauri Guide](https://tauri.app/v2/guides/)

### Learning
- [Three.js Journey](https://threejs-journey.com/)
- [React Three Fiber Tutorial](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
- [Simplex Noise](https://en.wikipedia.org/wiki/Simplex_noise)

---

## 🚀 Git Workflow

### Commit Messages

```bash
# Good commit messages:
git commit -m "feat: add vegetation system"
git commit -m "fix: terrain generation height bias"
git commit -m "refactor: optimize instanced rendering"
git commit -m "docs: update terrain changes documentation"

# Types: feat, fix, refactor, docs, style, test, chore
```

### Branching Strategy

```bash
# Create feature branch
git checkout -b feature/track-placement

# Work on feature
git add .
git commit -m "feat: add track placement"

# Merge back
git checkout main
git merge feature/track-placement
```

---

## 🎓 Phase 2 Preparation

### What You'll Need to Learn

1. **Raycasting** - Detecting mouse clicks on 3D objects
2. **Snap-to-Grid** - Aligning objects to grid positions
3. **Graph Data Structures** - Track connections
4. **Validation Logic** - Check valid placements

### Recommended Reading

- Three.js Raycaster documentation
- React state management patterns
- Graph traversal algorithms (for trains later)

### Practice Exercise

Before Phase 2, try:
```javascript
// Add a simple cube that follows mouse
// This will help understand raycasting
// Can be done in GameScene.jsx
```

---

## 🎉 You're Ready!

The codebase is:
- ✅ Well-structured
- ✅ Well-documented
- ✅ Performance-optimized
- ✅ Easy to extend

**Next step**: Start Phase 2 when ready! 🛤️

---

*Happy coding! 🚂*
