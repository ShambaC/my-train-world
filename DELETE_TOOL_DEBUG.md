# Delete Tool Debugging Guide

## How to Debug the Delete Tool

The delete tool has been instrumented with detailed console logging. Here's how to use it:

### 1. Open Browser Console
- Press `F12` in your browser
- Click on the "Console" tab
- Clear any existing messages

### 2. Select Delete Tool
- Press key `4` to select the delete tool
- You should see the trash can icon (🗑️) highlighted in the hotbar

### 3. Try to Delete a Track
- Move your mouse over a track piece
- Click on it
- Watch the console for messages

### 4. Expected Console Output

#### Successful Deletion:
```
[DELETE] Ghost position: { x: 5.0, y: 2.5, z: 3.0, ... }
[DELETE] Track found: { id: "track_0", type: "straight", ... }
[DELETE] Removing track: track_0
[DELETE] Tracks after removal: 2
```

#### Failed Deletion (No Track Found):
```
[DELETE] Ghost position: { x: 5.0, y: 2.5, z: 3.0, ... }
[DELETE] Track found: null
[DELETE] No track found at position
```

#### Failed Deletion (No Ghost Position):
```
[DELETE] Ghost position: null
[DELETE] Ghost position is null
```

### 5. Common Issues and Fixes

#### Issue: "Ghost position is null"
**Cause**: The raycaster isn't detecting the terrain
**Fix**: 
- Make sure you're hovering over terrain/tracks
- The delete tool needs to raycast to find a position

#### Issue: "No track found at position"
**Cause**: Tolerance for track detection might be too small
**Current tolerance**: 1.0 units
**Possible fixes**:
1. Increase tolerance in `TrackRenderer.jsx` line ~85:
```javascript
const trackToDelete = trackManager.getTrackAtPosition(ghostPosition, 2.0); // Increased from 1.0
```

2. Check if tracks are at expected positions:
```javascript
console.log('All tracks:', trackManager.getAllTracks());
```

#### Issue: Track found but not removed
**Cause**: TrackManager.removeTrack() might be failing
**Fix**: Add logging to `TrackManager.js`:
```javascript
removeTrack(id) {
  console.log('[TrackManager] Removing track:', id);
  console.log('[TrackManager] Track exists:', this.tracks.has(id));
  const track = this.tracks.get(id);
  if (!track) {
    console.log('[TrackManager] Track not found in Map');
    return false;
  }
  // ... rest of code
}
```

### 6. Manual Testing Steps

1. **Place a single track**
   - Press `1` (straight track)
   - Click to place
   - Console should show track placement

2. **Switch to delete tool**
   - Press `4`
   - Hotbar should highlight delete tool

3. **Hover over the track**
   - You should see a ghost position updating
   - Check console for ghost position logs

4. **Click on the track**
   - Console should show deletion attempt
   - Track should disappear if successful

### 7. Additional Debug Commands

Open console and try these commands while the game is running:

```javascript
// Check all current tracks
trackManagerRef.current.getAllTracks()

// Check a specific track
trackManagerRef.current.tracks.get('track_0')

// Manually remove a track (replace 'track_0' with actual ID)
trackManagerRef.current.removeTrack('track_0')

// Check track at a specific position
trackManagerRef.current.getTrackAtPosition({ x: 5, y: 2, z: 3 }, 2.0)
```

### 8. Next Steps

Based on the console output, we can:
1. Adjust the detection tolerance
2. Fix the raycasting logic
3. Improve track position matching
4. Add visual feedback (cursor change, highlight on hover)

---

**Report back with:**
- What you see in the console
- Whether ghost position is showing
- Whether tracks are found
- Any error messages

This will help pinpoint exactly where the delete tool is failing!
