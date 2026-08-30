/**
 * Style Palette — Canonical color families and time-of-day color ramps
 * for Tiny Glade-inspired painterly rendering.
 */
import * as THREE from 'three';

export const STYLE_PALETTE = {
  // Terrain
  meadow: { base: 0x6ea85f, dry: 0x8fb86b, lush: 0x549448, underside: 0x3d6e35 },
  forest_ground: { base: 0x486b3e, dark: 0x36542e, litter: 0x5c4d36 },
  soil: { base: 0x6e533b, dark: 0x4d3826 },
  sand: { base: 0xd8bc85, wet: 0xb59963 },
  highland: { base: 0x6e9460, rock: 0x7c786e },
  wetland: { base: 0x5a874e, mud: 0x4f4433 },
  warm_rock: { base: 0x8f8474, highlight: 0xa89d8d, shadow: 0x635a4d },
  cool_rock: { base: 0x737a82, highlight: 0x8b939c, shadow: 0x50565e },

  // Architecture
  plaster_cream: { base: 0xded5c5, trim: 0xeee6d8 },
  plaster_peach: { base: 0xe0c7b6, trim: 0xf0dcd0 },
  plaster_sage: { base: 0xc4ccbe, trim: 0xdce2d7 },
  brick_stone: { base: 0x918b84, mortar: 0xb8b3ab },
  platform_deck: { base: 0x82705b, stone: 0x9c968f },
  roof_slate: { base: 0x4f6475, highlight: 0x698194 },
  roof_teal: { base: 0x3e777a, highlight: 0x579497 },
  roof_terracotta: { base: 0xab5d44, highlight: 0xc4745c },

  // Wood & Timber
  dark_timber: { base: 0x423224, highlight: 0x594533 },
  warm_timber: { base: 0x7a5b3e, highlight: 0x947251 },
  sleeper_wood: { base: 0x5c4837, weathered: 0x73604f },

  // Infrastructure & Metal
  rail_steel: { base: 0x828a91, shine: 0xb0b8bf, rust: 0x665345 },
  ballast: { base: 0x78726a, dark: 0x5c564f },
  galvanized: { base: 0x8a9296, highlight: 0xa8b0b5 },
  lamp_metal: { base: 0x384042 },
  crossing_red: { base: 0xb33b32 },
  sign_green: { base: 0x356e49 },

  // Roads
  road_asphalt: { base: 0x4c4e52, light: 0x63666b },
  road_shoulder: { base: 0x736c5c },
  road_dirt: { base: 0x7a664e },

  // Rolling Stock
  paint_red: { base: 0xad382e, highlight: 0xc95349 },
  paint_blue: { base: 0x2e5487, highlight: 0x4871a8 },
  paint_green: { base: 0x316942, highlight: 0x498a5d },
  brass: { base: 0xd4a844, highlight: 0xf2cb68 },
  dark_chassis: { base: 0x272a2e, highlight: 0x3d4147 },
  wheel_steel: { base: 0x596066 },

  // Nature
  foliage_deciduous: { top: 0x82b85e, mid: 0x5a9142, base: 0x386129 },
  foliage_pine: { top: 0x447849, mid: 0x2e5733, base: 0x1c3820 },
  foliage_shrub: { top: 0x6e9c49, mid: 0x4c7531, base: 0x2c471c },
  flower_gold: { petal: 0xf5bf38, stem: 0x4f7d37 },
  flower_purple: { petal: 0x9969b8, stem: 0x497332 },
  flower_pink: { petal: 0xde738d, stem: 0x497332 },
  flower_cream: { petal: 0xf2edd5, stem: 0x497332 },

  // Lighting & Emissive
  lamp_glow: { color: 0xffd994, intensity: 3.5 },
  window_warm: { color: 0xffcb78, intensity: 3.0 },
  window_day: { color: 0x405566, intensity: 0.0 },
  headlight: { color: 0xfff0c4, intensity: 4.0 },
};

export function getPaletteColor(category, key = 'base') {
  const group = STYLE_PALETTE[category];
  if (!group) return new THREE.Color(0xffffff);
  const val = group[key] ?? group.base ?? 0xffffff;
  return new THREE.Color(val);
}
