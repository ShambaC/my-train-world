/**
 * Coach types — pure data (no asset imports so Node tests can load it).
 * Spacing = engine half (0.5) + coach half length + 0.15 gap, in world units.
 */

export const COACH_TYPES = [
  { key: 'passenger-coach', label: 'Passenger Coach' },
  { key: 'freight-van', label: 'Freight Van' },
  { key: 'mail-coach', label: 'Mail Coach' },
  { key: 'open-coal-wagon', label: 'Open Coal Wagon' },
  { key: 'container-flat-wagon', label: 'Container Wagon' },
  { key: 'coal-cart', label: 'Coal Cart' },
];

export const COACH_LENGTH = {
  'passenger-coach': 1.12,
  'freight-van': 1.0,
  'mail-coach': 1.13,
  'open-coal-wagon': 0.99,
  'container-flat-wagon': 1.09,
  'coal-cart': 1.12,
};

// Engine-relative spacing (used for the placement ghost): engine half (0.5)
// + coach half + 0.15 gap. Real per-pair spacing is computed in addCoach.
export const COACH_SPACING = {
  'passenger-coach': 0.5 + COACH_LENGTH['passenger-coach'] / 2 + 0.15,
  'freight-van': 0.5 + COACH_LENGTH['freight-van'] / 2 + 0.15,
  'mail-coach': 0.5 + COACH_LENGTH['mail-coach'] / 2 + 0.15,
  'open-coal-wagon': 0.5 + COACH_LENGTH['open-coal-wagon'] / 2 + 0.15,
  'container-flat-wagon': 0.5 + COACH_LENGTH['container-flat-wagon'] / 2 + 0.15,
  'coal-cart': 0.5 + COACH_LENGTH['coal-cart'] / 2 + 0.15,
};

export const DEFAULT_COACH = 'passenger-coach';
