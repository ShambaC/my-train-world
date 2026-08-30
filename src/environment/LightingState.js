import * as THREE from 'three';
import { getLightingForTime } from './SkyAtmosphere.jsx';
import { getStyleTimePalette } from '../render/stylePalette.js';

// Exponential smoothing rate: reaches ~95% of the way in ~1 second.
const LERP_RATE = 3.0;

/**
 * Interpolated lighting state. Holds the *current* (animated) values for
 * every light, fog and water tint, and eases toward a target preset when
 * the time of day changes — no abrupt color or intensity jumps.
 *
 * Mutated in place every frame by GameScene, so cheap to share with
 * WaterSurface, FogWall, TrainRenderer and Fireflies.
 */
export default class LightingState {
  constructor(timeOfDay) {
    this.ambient = { color: new THREE.Color(), intensity: 1 };
    this.hemisphereSky = new THREE.Color();
    this.hemisphereGround = new THREE.Color();
    this.hemisphereIntensity = 0.7;
    this.sun = { color: new THREE.Color(), intensity: 1, position: new THREE.Vector3() };
    this.fog = { color: new THREE.Color(), density: 0.01 };
    this.skyTint = new THREE.Color();
    this.sunTint = new THREE.Color();
    this.waterDeep = new THREE.Color();
    this.waterShallow = new THREE.Color();
    this.waterFoam = new THREE.Color();
    this.waterSand = new THREE.Color();
    this.nightness = 0;
    this.shadowRadius = 4;
    this.skyTop = new THREE.Color();
    this.skyHorizon = new THREE.Color();
    this.skyGround = new THREE.Color();
    this.shadowTint = new THREE.Color();
    this.highlightTint = new THREE.Color();
    this.sunDiskColor = new THREE.Color();
    this.cloudLight = new THREE.Color();
    this.cloudShadow = new THREE.Color();
    this.bloomThreshold = 1.5;
    this.bloomStrength = 0.2;
    this.exposure = 1;
    this.saturation = 1;
    this.contrast = 1;
    this.waterReflectivity = 0.3;
    this.waterRoughness = 0.75;
    this.atmosphereStrength = 0.1;
    this.target = null;
    this.setTarget(timeOfDay, true);
  }

  /** Snapshot preset colors into lerp-friendly THREE objects. */
  setTarget(timeOfDay, snap = false) {
    const p = getLightingForTime(timeOfDay);
    const style = getStyleTimePalette(timeOfDay);
    this.target = {
      ambientColor: new THREE.Color(p.ambient.color),
      ambientIntensity: p.ambient.intensity,
      hemisphereSky: new THREE.Color(style.hemisphereSky),
      hemisphereGround: new THREE.Color(style.hemisphereGround),
      hemisphereIntensity: Math.min(1.7, p.ambient.intensity * 2.1),
      sunColor: new THREE.Color(p.directional.color),
      sunIntensity: p.directional.intensity,
      sunPosition: new THREE.Vector3(...p.directional.position),
      fogColor: new THREE.Color(p.fog.color),
      fogDensity: p.fog.density,
      skyTint: new THREE.Color(p.skyTint),
      sunTint: new THREE.Color(p.sunTint),
      waterDeep: new THREE.Color(p.waterDeep),
      waterShallow: new THREE.Color(p.waterShallow),
      waterFoam: new THREE.Color(p.waterFoam),
      waterSand: new THREE.Color(p.waterSand),
      nightness: p.nightness,
      shadowRadius: p.shadowRadius,
      skyTop: new THREE.Color(style.skyTop),
      skyHorizon: new THREE.Color(style.skyHorizon),
      skyGround: new THREE.Color(style.skyGround),
      shadowTint: new THREE.Color(style.shadowTint),
      highlightTint: new THREE.Color(style.highlightTint),
      sunDiskColor: new THREE.Color(style.sunDiskColor),
      cloudLight: new THREE.Color(style.cloudLight),
      cloudShadow: new THREE.Color(style.cloudShadow),
      bloomThreshold: style.bloomThreshold,
      bloomStrength: style.bloomStrength,
      exposure: style.exposure,
      saturation: style.saturation,
      contrast: style.contrast,
      waterReflectivity: style.waterReflectivity,
      waterRoughness: style.waterRoughness,
      atmosphereStrength: style.atmosphereStrength,
    };
    if (snap) this.snapTo(this.target);
  }

  snapTo(t) {
    this.ambient.color.copy(t.ambientColor);
    this.ambient.intensity = t.ambientIntensity;
    this.hemisphereSky.copy(t.hemisphereSky);
    this.hemisphereGround.copy(t.hemisphereGround);
    this.hemisphereIntensity = t.hemisphereIntensity;
    this.sun.color.copy(t.sunColor);
    this.sun.intensity = t.sunIntensity;
    this.sun.position.copy(t.sunPosition);
    this.fog.color.copy(t.fogColor);
    this.fog.density = t.fogDensity;
    this.skyTint.copy(t.skyTint);
    this.sunTint.copy(t.sunTint);
    this.waterDeep.copy(t.waterDeep);
    this.waterShallow.copy(t.waterShallow);
    this.waterFoam.copy(t.waterFoam);
    this.waterSand.copy(t.waterSand);
    this.nightness = t.nightness;
    this.shadowRadius = t.shadowRadius;
    this.skyTop.copy(t.skyTop);
    this.skyHorizon.copy(t.skyHorizon);
    this.skyGround.copy(t.skyGround);
    this.shadowTint.copy(t.shadowTint);
    this.highlightTint.copy(t.highlightTint);
    this.sunDiskColor.copy(t.sunDiskColor);
    this.cloudLight.copy(t.cloudLight);
    this.cloudShadow.copy(t.cloudShadow);
    this.bloomThreshold = t.bloomThreshold;
    this.bloomStrength = t.bloomStrength;
    this.exposure = t.exposure;
    this.saturation = t.saturation;
    this.contrast = t.contrast;
    this.waterReflectivity = t.waterReflectivity;
    this.waterRoughness = t.waterRoughness;
    this.atmosphereStrength = t.atmosphereStrength;
  }

  /** Ease current values toward the target preset. Call once per frame. */
  update(delta) {
    const t = this.target;
    if (!t) return;
    const k = 1 - Math.exp(-LERP_RATE * Math.min(delta, 0.1));
    this.ambient.color.lerp(t.ambientColor, k);
    this.ambient.intensity += (t.ambientIntensity - this.ambient.intensity) * k;
    this.sun.color.lerp(t.sunColor, k);
    this.sun.intensity += (t.sunIntensity - this.sun.intensity) * k;
    this.sun.position.lerp(t.sunPosition, k);
    this.fog.color.lerp(t.fogColor, k);
    this.fog.density += (t.fogDensity - this.fog.density) * k;
    this.skyTint.lerp(t.skyTint, k);
    this.sunTint.lerp(t.sunTint, k);
    this.waterDeep.lerp(t.waterDeep, k);
    this.waterShallow.lerp(t.waterShallow, k);
    this.waterFoam.lerp(t.waterFoam, k);
    this.waterSand.lerp(t.waterSand, k);
    this.nightness += (t.nightness - this.nightness) * k;
    this.shadowRadius += (t.shadowRadius - this.shadowRadius) * k;
    this.hemisphereSky.lerp(t.hemisphereSky, k);
    this.hemisphereGround.lerp(t.hemisphereGround, k);
    this.hemisphereIntensity += (t.hemisphereIntensity - this.hemisphereIntensity) * k;
    this.skyTop.lerp(t.skyTop, k);
    this.skyHorizon.lerp(t.skyHorizon, k);
    this.skyGround.lerp(t.skyGround, k);
    this.shadowTint.lerp(t.shadowTint, k);
    this.highlightTint.lerp(t.highlightTint, k);
    this.sunDiskColor.lerp(t.sunDiskColor, k);
    this.cloudLight.lerp(t.cloudLight, k);
    this.cloudShadow.lerp(t.cloudShadow, k);
    this.bloomThreshold += (t.bloomThreshold - this.bloomThreshold) * k;
    this.bloomStrength += (t.bloomStrength - this.bloomStrength) * k;
    this.exposure += (t.exposure - this.exposure) * k;
    this.saturation += (t.saturation - this.saturation) * k;
    this.contrast += (t.contrast - this.contrast) * k;
    this.waterReflectivity += (t.waterReflectivity - this.waterReflectivity) * k;
    this.waterRoughness += (t.waterRoughness - this.waterRoughness) * k;
    this.atmosphereStrength += (t.atmosphereStrength - this.atmosphereStrength) * k;
  }
}
