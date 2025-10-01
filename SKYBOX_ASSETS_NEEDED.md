# Skybox and Day/Night Cycle - Asset Requirements

## Overview
To implement a realistic skybox with day/night cycle for MyTrainWorld, we need high-quality environment textures that will surround the scene.

## Required Assets

### 1. Skybox Cubemap Textures
A skybox uses 6 images that form a cube around the scene. For a day/night cycle, we need multiple sets:

#### Option A: Cubemap Format (Preferred)
Six separate images for each time of day, named consistently:
- `px.jpg` (positive X / right)
- `nx.jpg` (negative X / left)
- `py.jpg` (positive Y / up/top)
- `ny.jpg` (negative Y / down/bottom)
- `pz.jpg` (positive Z / front)
- `nz.jpg` (negative Z / back)

**Time periods needed:**
1. **Dawn** (sunrise) - 6 images - warm orange/pink tones
2. **Day** (noon) - 6 images - bright blue sky
3. **Dusk** (sunset) - 6 images - orange/red tones
4. **Night** - 6 images - dark blue/black with stars/moon

#### Option B: Equirectangular Format (Alternative)
Single panoramic image (360° × 180°) for each time period:
- `dawn.jpg` - 2048x1024 or 4096x2048
- `day.jpg` - 2048x1024 or 4096x2048
- `dusk.jpg` - 2048x1024 or 4096x2048
- `night.jpg` - 2048x1024 or 4096x2048

### 2. Image Specifications
- **Format**: JPG or PNG (JPG recommended for smaller file size)
- **Resolution**: 
  - Cubemap: 1024x1024 or 2048x2048 per face (6 images each)
  - Equirectangular: 2048x1024 or 4096x2048 per panorama
- **Quality**: High quality, seamless edges (no visible seams between faces)
- **Style**: Realistic or stylized to match your game aesthetic

### 3. Optional Enhanced Assets

#### Cloud Textures (for animated clouds)
- `clouds_alpha.png` - grayscale cloud alpha map
- Resolution: 1024x1024 or larger
- Can be used to add moving clouds overlay

#### Sun/Moon Textures
- `sun.png` - circular sun with glow
- `moon.png` - moon with detail
- Resolution: 512x512 with alpha channel
- Used for directional light source visuals

## Where to Get Assets

### Free Sources:
1. **Poly Haven** (https://polyhaven.com/hdris)
   - High-quality HDRIs that can be converted to cubemaps
   - Free for commercial use (CC0 license)

2. **HDRI Haven** (https://hdrihaven.com/)
   - Excellent free HDRI skies
   - Can be converted to cubemap format

3. **Humus** (http://www.humus.name/index.php?page=Textures)
   - Classic cubemap collection

### Paid Sources:
1. **Unity Asset Store / Unreal Marketplace**
   - Pre-made skybox collections
   - Usually include multiple times of day

2. **TextureHaven / ArtStation**
   - Professional quality skyboxes

## File Structure
Once you provide the assets, place them in your project like this:

```
public/
  textures/
    skybox/
      day/
        px.jpg, nx.jpg, py.jpg, ny.jpg, pz.jpg, nz.jpg
      dawn/
        px.jpg, nx.jpg, py.jpg, ny.jpg, pz.jpg, nz.jpg
      dusk/
        px.jpg, nx.jpg, py.jpg, ny.jpg, pz.jpg, nz.jpg
      night/
        px.jpg, nx.jpg, py.jpg, ny.jpg, pz.jpg, nz.jpg
```

Or for equirectangular:
```
public/
  textures/
    skybox/
      day.jpg
      dawn.jpg
      dusk.jpg
      night.jpg
```

## Implementation Plan (Once Assets Are Provided)

1. **Create Skybox Component**
   - Load cubemap or equirectangular textures
   - Apply to scene background
   - Set up as infinite distance sphere/cube

2. **Day/Night Cycle System**
   - Time progression (0-24 hours)
   - Smooth texture blending between time periods
   - Lighting adjustments (ambient, directional light color/intensity)
   - Optional: Sun/moon position calculation

3. **Lighting System**
   - Directional light follows sun position
   - Ambient light color changes with time
   - Shadow intensity varies
   - Optional: Fog color transitions

4. **Controls**
   - Time speed control (pause, 1x, 2x, 5x, 10x speed)
   - Manual time setting
   - Toggle day/night cycle on/off

## What I Need From You

Please provide either:
- **24 images** (6 cubemap faces × 4 time periods), OR
- **4 images** (4 equirectangular panoramas)

Let me know which format you prefer, and I'll implement the complete day/night cycle system with smooth transitions and atmospheric lighting!
