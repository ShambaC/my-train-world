/**
 * Graphics Quality Presets Contract
 * Defines immutable quality settings for Low, Medium, and High tiers.
 */

export const QUALITY_TIERS = {
  low: {
    id: 'low',
    name: 'Low',
    dprCap: 1.0,
    terrainShell: 'simple',
    shadowMapSize: 1024,
    shadowFiltering: 'basic',
    shadowRadius: 2,
    contactAO: 'analytic',
    aoResolution: 0,
    waterReflection: 'sky',
    waterRefraction: false,
    waterNormalLayers: 1,
    bloom: false,
    bloomResolution: 0,
    miniatureDof: { resolution: 0.25, sampleCount: 4 },
    cloudLayers: 1,
    grassDensityMultiplier: 0.55,
    flowerDensityMultiplier: 0.55,
    anisotropyCap: 2,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    dprCap: 1.5,
    terrainShell: 'chamfered',
    shadowMapSize: 2048,
    shadowFiltering: 'pcfsoft',
    shadowRadius: 4,
    contactAO: 'gtao_half',
    aoResolution: 0.5,
    waterReflection: 'sky_refract',
    waterRefraction: true,
    waterNormalLayers: 2,
    bloom: true,
    bloomResolution: 0.25,
    miniatureDof: { resolution: 0.5, sampleCount: 8 },
    cloudLayers: 2,
    grassDensityMultiplier: 0.8,
    flowerDensityMultiplier: 0.8,
    anisotropyCap: 4,
  },
  high: {
    id: 'high',
    name: 'High',
    dprCap: 2.0,
    terrainShell: 'chamfered_dressed',
    shadowMapSize: 4096,
    shadowFiltering: 'pcfsoft_tight',
    shadowRadius: 5,
    contactAO: 'gtao_full',
    aoResolution: 0.75,
    waterReflection: 'planar',
    waterRefraction: true,
    waterNormalLayers: 2,
    bloom: true,
    bloomResolution: 0.5,
    miniatureDof: { resolution: 0.5, sampleCount: 16 },
    cloudLayers: 3,
    grassDensityMultiplier: 1.0,
    flowerDensityMultiplier: 1.0,
    anisotropyCap: 8,
  },
  custom: {
    id: 'custom',
    name: 'Custom',
    dprCap: 1.5,
    terrainShell: 'chamfered',
    shadowMapSize: 2048,
    shadowFiltering: 'pcfsoft',
    shadowRadius: 4,
    contactAO: 'gtao_half',
    aoResolution: 0.5,
    waterReflection: 'sky_refract',
    waterRefraction: true,
    waterNormalLayers: 2,
    bloom: true,
    bloomResolution: 0.25,
    miniatureDof: { resolution: 0.5, sampleCount: 8 },
    cloudLayers: 2,
    grassDensityMultiplier: 0.8,
    flowerDensityMultiplier: 0.8,
    anisotropyCap: 4,
  },
};

export const DEFAULT_QUALITY = 'medium';

let customOverrides = {};

export function setCustomQualityOverrides(overrides) {
  customOverrides = { ...customOverrides, ...overrides };
}

export function getQualityPreset(tierName) {
  if (tierName === 'custom') {
    return { ...QUALITY_TIERS.custom, ...customOverrides };
  }
  return QUALITY_TIERS[tierName] || QUALITY_TIERS[DEFAULT_QUALITY];
}
