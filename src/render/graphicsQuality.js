const QUALITY_PRESETS = {
  low: {
    id: 'low',
    dprCap: 1,
    terrainDetail: 'simple',
    foliageDetail: 'far',
    grassDensity: 0.55,
    flowerDensity: 0.55,
    shadowMapSize: 1024,
    shadowRadius: 2,
    ao: false,
    reflection: 'palette',
    waterNormalLayers: 1,
    bloom: false,
    miniatureResolution: 0.25,
    cloudLayers: 1,
    textureMaxSize: 512,
    anisotropyCap: 2,
  },
  medium: {
    id: 'medium',
    dprCap: 1.5,
    terrainDetail: 'chamfered',
    foliageDetail: 'cluster',
    grassDensity: 0.8,
    flowerDensity: 0.8,
    shadowMapSize: 2048,
    shadowRadius: 3,
    ao: false,
    reflection: 'sky',
    waterNormalLayers: 2,
    bloom: true,
    miniatureResolution: 0.5,
    cloudLayers: 2,
    textureMaxSize: 1024,
    anisotropyCap: 4,
  },
  high: {
    id: 'high',
    dprCap: 2,
    terrainDetail: 'dressed',
    foliageDetail: 'breakup',
    grassDensity: 1,
    flowerDensity: 1,
    shadowMapSize: 4096,
    shadowRadius: 4,
    ao: true,
    reflection: 'planar',
    waterNormalLayers: 3,
    bloom: true,
    miniatureResolution: 0.5,
    cloudLayers: 3,
    textureMaxSize: 2048,
    anisotropyCap: 8,
  },
};

export const GRAPHICS_QUALITY_OPTIONS = Object.freeze([
  { value: 'low', label: 'Low', description: 'Fastest rendering and reduced detail.' },
  { value: 'medium', label: 'Medium', description: 'Balanced diorama presentation.' },
  { value: 'high', label: 'High', description: 'Maximum visual detail.' },
]);

export const DEFAULT_GRAPHICS_QUALITY = 'medium';

export function normalizeGraphicsQuality(value) {
  return Object.prototype.hasOwnProperty.call(QUALITY_PRESETS, value)
    ? value
    : DEFAULT_GRAPHICS_QUALITY;
}

export function getGraphicsQuality(value) {
  return QUALITY_PRESETS[normalizeGraphicsQuality(value)];
}

export const GRAPHICS_QUALITY = Object.freeze({
  low: Object.freeze(QUALITY_PRESETS.low),
  medium: Object.freeze(QUALITY_PRESETS.medium),
  high: Object.freeze(QUALITY_PRESETS.high),
});
