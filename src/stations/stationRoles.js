/**
 * Station roles — descriptive presentation presets for ambient activity.
 * Pure data. Roles never gate placement, track binding, trains, or anything
 * else: they only shape which decorative passengers/cargo appear.
 */

export const DEFAULT_ROLE = 'village';

export const STATION_ROLES = [
  { key: 'village', label: 'Village', icon: '🏘️', passengers: [2, 4], cargo: ['sack'] },
  { key: 'city', label: 'City', icon: '🏙️', passengers: [5, 9], cargo: [] },
  { key: 'farm', label: 'Farm', icon: '🌾', passengers: [1, 2], cargo: ['sack'] },
  { key: 'mine', label: 'Mine', icon: '⛏️', passengers: [0, 1], cargo: ['coal'] },
  { key: 'factory', label: 'Factory', icon: '🏭', passengers: [0, 2], cargo: ['crate'] },
  { key: 'port', label: 'Port', icon: '🚢', passengers: [1, 3], cargo: ['container'] },
  { key: 'fuel', label: 'Fuel Depot', icon: '⛽', passengers: [0, 1], cargo: ['tanker'] },
  { key: 'scenic', label: 'Scenic Stop', icon: '🌄', passengers: [2, 4], cargo: [] },
];

export const ROLE_BY_KEY = Object.fromEntries(STATION_ROLES.map((r) => [r.key, r]));

// Ambient cargo budget per role: how many platform piles of each cargo
// type a station may hold. Soft targets — spawned gradually, never
// economic, never blocking.
export const ROLE_CARGO_BUDGET = {
  village: { sack: [1, 2] },
  city: {},
  farm: { sack: [2, 4] },
  mine: { coal: [2, 5] },
  factory: { crate: [3, 6] },
  port: { container: [2, 5], crate: [1, 2] },
  fuel: { tanker: [2, 4] },
  scenic: {},
};
