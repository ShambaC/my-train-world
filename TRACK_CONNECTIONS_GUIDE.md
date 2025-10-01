# Track Connection System - How It Works

## Overview
Tracks now automatically connect to adjacent tracks, allowing trains to travel across your entire railway network!

## Visual Guide

### Straight Track Connections
```
Before (No connections):
    [Track 1]    [Track 2]    [Track 3]
    
After placing (Auto-connected):
    [Track 1] → [Track 2] → [Track 3]
    
Train behavior:
    🚂 → → → → → → → → → → 
    Travels continuously across all three tracks!
```

### Curved Track Connections
```
    [Straight]
         |
    [Curved 90°]
         |
    [Straight]
    
Train path:
    🚂 goes straight, turns 90°, continues straight
```

### Mixed Layout Example
```
    [Straight] → [Curved] 
                     ↓
    [Straight] ← [Curved]
    
Creates a loop! Train will circle continuously.
```

## How Connections Are Made

### 1. **Distance Check**
- When you place a track, it searches within 0.6 units
- Must be close enough to connect (about 1.2 voxels)

### 2. **Height Check**
- Tracks must be at similar heights (within 0.3 units)
- Prevents connecting ground tracks to elevated tracks

### 3. **Connection Points**
- Each track has two connection points: **front** and **back**
- Connections are made between compatible ends
- One track's **front** connects to another's **back**

### 4. **Console Feedback**
When tracks connect, you'll see:
```
Connected track_0 (front) to track_1 (back)
Connected track_2 (back) to track_1 (front)
```

## Building Your Railway

### Simple Line
1. Press `1` for straight track
2. Click to place first track
3. Click right next to it to place second track
4. Console: "Connected track_0 (front) to track_1 (back)"
5. Place a train - watch it travel both tracks!

### Making a Loop
1. Place 4 straight tracks in a square pattern:
   - One going right →
   - One going down ↓
   - One going left ←
   - One going up ↑

2. Use curved tracks at corners to connect them

3. Place a train - it will loop forever!

### Elevated Railway
1. Place track on ground
2. Press `Q` to raise height (+0.5)
3. Place next track elevated
4. Won't connect (different heights)
5. This is intentional - prevents ramps without proper track placement

## Troubleshooting

### "Train only moves on one track"

**Possible causes:**
1. **Tracks not close enough**
   - Solution: Place tracks directly adjacent (touching)
   
2. **Different heights**
   - Check: Both tracks at heightOffset = 0?
   - Solution: Use same height for connections

3. **No connection message in console**
   - Press F12 to open console
   - Place track
   - Look for "Connected track_X..."
   - If missing, tracks didn't connect

### "Train reaches end and reverses"

**This is normal behavior!**
- If track has no forward connection, train reverses
- This prevents trains from disappearing

**To fix:**
- Complete your loop or add return tracks
- Create a circuit for continuous movement

### "Connections seem wrong"

**Debug steps:**
1. Open console (F12)
2. Type: `trackManagerRef.current.getAllTracks()`
3. Look at each track's `connections` object:
   ```javascript
   connections: {
     front: "track_2",  // Connected to track_2 ahead
     back: "track_0"    // Connected to track_0 behind
   }
   ```

## Tips for Better Railways

### 1. Plan Your Layout
- Draw it on paper first
- Consider loops for continuous running
- Leave space for stations (future feature)

### 2. Test with One Track at a Time
- Place track
- Check console for connections
- Place train to test
- Add next track

### 3. Use Curved Tracks Wisely
- Curved tracks rotate 90 degrees
- Use them at corners of your layout
- Two curved tracks = 180° turn

### 4. Height Matters
- Ground level tracks connect easily
- Elevated tracks need all to be same height
- Future: We could add ramp tracks!

### 5. Start Simple
- Build a simple oval first
- Add complexity once you understand connections
- Watch how trains behave

## Example Layouts

### Beginner: Simple Oval
```
Materials needed:
- 4 straight tracks
- 4 curved tracks

Layout:
    [Straight]────[Curved]
        |              |
    [Curved]────[Straight]
```

### Intermediate: Figure-8
```
Materials needed:
- 8 straight tracks  
- 8 curved tracks

Layout:
    ╭────╮
    │    │
    ╰──╮╭──╯
       ╰╯
    (Crosses in middle)
```

### Advanced: Multi-loop Network
```
Materials needed:
- Many tracks!

Layout:
    ╭────╮  ╭────╮
    │    ╰──╯    │
    │            │
    ╰────────────╯
```

## Performance Tip

With a large connected network:
- Many trains can run simultaneously
- Use the Train Control panel to stop trains you're not watching
- Stopped trains = zero performance cost
- Keep 3-5 active trains for best experience

## Future Connection Features (Planned)

- [ ] Visual connection indicators (glowing endpoints)
- [ ] Manual connection tool (force connections)
- [ ] Connection breaking tool
- [ ] Junction/switch tracks (split paths)
- [ ] Connection validation (prevent impossible connections)
- [ ] Ramp tracks (connect different heights)

---

**Now go build an amazing railway network!** 🚂✨

Place tracks, watch them connect, add trains, and enjoy your model railway!
