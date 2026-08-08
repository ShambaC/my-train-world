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
];

export const COACH_SPACING = {
  'passenger-coach': 0.5 + 2.54 / 2 + 0.15, // 1.92
  'freight-van': 0.5 + 1.0 / 2 + 0.15,       // 1.15
  'mail-coach': 0.5 + 1.13 / 2 + 0.15,       // 1.22
  'open-coal-wagon': 0.5 + 0.99 / 2 + 0.15,  // 1.14
  'container-flat-wagon': 0.5 + 1.09 / 2 + 0.15, // 1.2
};

export const DEFAULT_COACH = 'passenger-coach';
