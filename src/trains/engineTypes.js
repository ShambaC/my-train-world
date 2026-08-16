/**
 * Engine types — pure data (no asset imports so Node tests can load it).
 * Dimensions and metadata for locomotives.
 */

export const ENGINE_TYPES = [
  { key: 'steam-engine', label: 'Steam Engine' },
  { key: 'diesel-engine', label: 'Diesel Engine' },
  { key: 'electric-engine', label: 'Electric Engine' },
  { key: 'checker-engine', label: 'Checker Engine' },
];

export const DEFAULT_ENGINE = 'steam-engine';

export const ENGINE_LENGTH = 1.0;
export const ENGINE_WIDTH = 0.5;
export const ENGINE_HEIGHT = 0.5;

export const ENGINE_DIMENSIONS = {
  'steam-engine': { length: 1.08, width: 0.48, height: 0.54 },
  'diesel-engine': { length: 1.08, width: 0.48, height: 0.52 },
  'electric-engine': { length: 1.08, width: 0.48, height: 0.68 },
  'checker-engine': { length: 1.08, width: 0.48, height: 0.52 },
};
