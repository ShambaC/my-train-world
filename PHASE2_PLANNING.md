# Phase 2 Planning: Track Placement System

## Overview
Now that we have flatter terrain suitable for railway construction, the next step is implementing the track placement system.

## Current Terrain Improvements (✅ Completed)
- **Flatter terrain generation** - Reduced height multiplier from 10 to 4
- **Gentler hills** - Fewer octaves and adjusted amplitude for gradual slopes
- **Plains-focused** - Bias toward middle height values for more buildable area
- **Vegetation system** - Trees and bushes for visual interest
  - Simple voxel trees (3-4 blocks tall with canopy)
  - Rounded bushes (2 blocks with branches)
  - Procedural placement with proper spacing
  - ~8% vegetation density on grass areas

## Track System Design

### Track Types to Implement
1. **Straight Track**
   - Standard rail piece
   - 1 unit length
   - Connections: front/back

2. **Curved Track**
   - 45° and 90° curves
   - Quarter-circle shape
   - Connections: corner pieces

3. **Switch/Junction** (Future)
   - Allows train direction changes
   - Multiple output paths

4. **Slope Track** (Future)
   - Gradual elevation changes
   - Max gradient: 15°

### Track Placement Mechanics

#### 1. Click-to-Place System
```javascript
// Raycasting to detect terrain click
- Detect mouse click on terrain
- Cast ray from camera to terrain
- Get intersection point
- Snap to grid position
- Validate placement
- Create track at position
```

#### 2. Placement Validation
- Check if position is on grass (not water)
- Check if position is already occupied
- Check slope (max gradient)
- Check connection compatibility
- Visual feedback (green = valid, red = invalid)

#### 3. Track Connection Logic
- Auto-detect nearby tracks
- Snap to connection points
- Validate compatible connections
- Update connection state

### Data Structure

```javascript
// Track object structure
{
  id: "track_001",
  type: "straight" | "curved_45" | "curved_90" | "switch",
  position: { x, y, z },
  rotation: 0, // 0, 90, 180, 270 degrees
  connections: {
    front: null | "track_002",
    back: null | "track_003"
  },
  height: 2 // terrain height at position
}

// Track network storage
const trackNetwork = {
  tracks: Map<id, TrackObject>,
  connections: Map<id, [connectedIds]>
}
```

### Visual Design

#### Track Model (Procedural)
```javascript
// Simple voxel track representation
- 2 parallel rails (dark gray/steel)
- Wooden sleepers/ties (brown)
- Gravel base (gray)
- Width: 1.5 voxels
- Height: 0.3 voxels above terrain
```

#### Placement Indicators
- **Ghost Track**: Semi-transparent preview
- **Valid Placement**: Green tint
- **Invalid Placement**: Red tint
- **Connection Points**: Yellow spheres
- **Hover Highlight**: Blue outline

### UI Components Needed

#### 1. Track Toolbar
```
Location: Left side of screen
Components:
- Track type selector
- Delete mode toggle
- Rotate button (R key)
- Current selection highlight
```

#### 2. Placement Mode
```
States:
- View Mode (default)
- Place Mode (selected track type)
- Delete Mode (remove tracks)

Controls:
- Click: Place/Delete track
- R key: Rotate before placing
- ESC: Cancel placement mode
- Right-click: Cancel/deselect
```

#### 3. Track Information Panel
```
Show when hovering track:
- Track type
- Connected tracks
- Position
- Delete option
```

### Implementation Steps

#### Step 1: Basic Placement (MVP)
1. Create straight track model
2. Add raycasting for terrain clicks
3. Implement grid snapping
4. Show ghost preview on hover
5. Place track on click
6. Store track data

#### Step 2: Rotation & Types
1. Add rotation controls (R key)
2. Create curved track models
3. Track type selector UI
4. Update placement with rotation

#### Step 3: Validation
1. Terrain height validation
2. Overlap detection
3. Visual feedback (green/red)
4. Placement rules enforcement

#### Step 4: Connection System
1. Detect nearby tracks
2. Calculate connection points
3. Snap to connections
4. Update connection graph
5. Visual connection indicators

#### Step 5: Delete & Edit
1. Delete mode
2. Track selection
3. Track modification
4. Connection updates on delete

### Code Structure

```
src/
├── tracks/
│   ├── TrackModels.js       # Track 3D models
│   ├── TrackPlacement.jsx   # Placement logic component
│   ├── TrackManager.js      # Track data management
│   ├── TrackRenderer.jsx    # Track rendering
│   └── TrackUtils.js        # Helper functions
├── ui/
│   ├── TrackToolbar.jsx     # Track selection UI
│   └── PlacementIndicator.jsx # Visual feedback
└── hooks/
    ├── useTrackPlacement.js # Placement hook
    └── useRaycaster.js      # Mouse interaction
```

### Performance Considerations

1. **Instanced Meshes**: Use for repeated track pieces
2. **LOD**: Reduce detail for distant tracks
3. **Culling**: Only render visible tracks
4. **Batching**: Group track updates
5. **Limits**: Max ~1000 track pieces initially

### Testing Checklist

- [ ] Track appears at click position
- [ ] Snapping works correctly
- [ ] Rotation works as expected
- [ ] Invalid placements are blocked
- [ ] Visual feedback is clear
- [ ] Tracks connect properly
- [ ] Delete works without errors
- [ ] Performance is acceptable
- [ ] Works with different terrain sizes
- [ ] Mobile/touch support (future)

## Estimated Implementation Time
- **Basic Placement**: 2-3 hours
- **Rotation & Types**: 2 hours
- **Validation**: 1-2 hours
- **Connection System**: 3-4 hours
- **UI Polish**: 1-2 hours
- **Total**: ~10-14 hours

## Next Phase Preview: Trains
Once tracks are working:
1. Train models (locomotive + cars)
2. Path following algorithm
3. Speed controls
4. Multiple trains
5. Station stops

---

Ready to start implementing Phase 2 when you are! 🛤️
