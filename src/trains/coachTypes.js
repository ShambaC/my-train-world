/**
 * Coach types — pure data (no asset imports so Node tests can load it).
 * Spacing = engine half (0.5) + coach half length + 0.15 gap, in world units.
 */

export const COACH_TYPES = [
  { key: 'passenger-coach', label: 'Passenger Coach' },
  { key: 'coal-cart', label: 'Coal Cart' },
  { key: 'gas-coach', label: 'Gas Tanker' },
  { key: 'goods-coach', label: 'Goods Coach' },
  { key: 'container-coach', label: 'Container Coach' },
  { key: 'viewdeck-coach', label: 'Viewdeck Coach' },
];

export const COACH_LENGTH = {
  'passenger-coach': 1.12,
  'coal-cart': 1.12,
  'gas-coach': 1.12,
  'goods-coach': 1.12,
  'container-coach': 1.12,
  'viewdeck-coach': 1.12,
};

// Visual presentation roles — which ambient cargo type boards each coach.
// Hooks for the activity system only; every coach still attaches to every
// engine and travels everywhere regardless of role.
export const COACH_ROLE = {
  'passenger-coach': 'passenger',
  'mail-coach': 'passenger',
  'viewdeck-coach': 'passenger',
  'goods-coach': 'crate',
  'freight-van': 'crate',
  'coal-cart': 'coal',
  'container-coach': 'container',
  'container-flat-wagon': 'container',
  'gas-coach': 'tanker',
};

// Engine-relative spacing (used for the placement ghost): engine half (0.5)
// + coach half + 0.15 gap. Real per-pair spacing is computed in addCoach.
export const COACH_SPACING = {
  'passenger-coach': 0.5 + COACH_LENGTH['passenger-coach'] / 2 + 0.15,
  'coal-cart': 0.5 + COACH_LENGTH['coal-cart'] / 2 + 0.15,
  'gas-coach': 0.5 + COACH_LENGTH['gas-coach'] / 2 + 0.15,
  'goods-coach': 0.5 + COACH_LENGTH['goods-coach'] / 2 + 0.15,
  'container-coach': 0.5 + COACH_LENGTH['container-coach'] / 2 + 0.15,
  'viewdeck-coach': 0.5 + COACH_LENGTH['viewdeck-coach'] / 2 + 0.15,
};

export const DEFAULT_COACH = 'passenger-coach';
