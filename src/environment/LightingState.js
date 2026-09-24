import * as THREE from 'three';
import { getLightingForTime } from './SkyAtmosphere.jsx';

const LERP_RATE = 3.0;
const PHASES = ['dawn', 'day', 'dusk', 'night'];

function targetForTime(timeOfDay) {
  const p = getLightingForTime(timeOfDay);
  return {
    ambientColor: new THREE.Color(p.ambient.color),
    ambientIntensity: p.ambient.intensity,
    hemisphereSky: new THREE.Color(p.hemisphereSky || p.ambient.color),
    hemisphereGround: new THREE.Color(p.hemisphereGround || 0x444444),
    sunColor: new THREE.Color(p.directional.color),
    sunIntensity: p.directional.intensity,
    sunPosition: new THREE.Vector3(...p.directional.position),
    fogColor: new THREE.Color(p.fog.color),
    fogDensity: p.fog.density,
    skyTint: new THREE.Color(p.skyHorizon || p.fog.color),
    skyZenith: new THREE.Color(p.skyZenith || p.ambient.color),
    skyGround: new THREE.Color(p.skyGround || p.fog.color),
    sunTint: new THREE.Color(p.sunTint),
    waterDeep: new THREE.Color(p.waterDeep),
    waterShallow: new THREE.Color(p.waterShallow),
    waterFoam: new THREE.Color(p.waterFoam),
    waterSand: new THREE.Color(p.waterSand),
    nightness: p.nightness,
    shadowRadius: p.shadowRadius,
  };
}

/**
 * Interpolated lighting state. Holds the *current* (animated) values for
 * every light, fog, hemisphere, sky, and water tint.
 */
export default class LightingState {
  constructor(timeOfDay) {
    this.ambient = { color: new THREE.Color(), intensity: 1 };
    this.hemisphereSky = new THREE.Color();
    this.hemisphereGround = new THREE.Color();
    this.sun = { color: new THREE.Color(), intensity: 1, position: new THREE.Vector3() };
    this.fog = { color: new THREE.Color(), density: 0.01 };
    this.skyTint = new THREE.Color();
    this.skyZenith = new THREE.Color();
    this.skyGround = new THREE.Color();
    this.sunTint = new THREE.Color();
    this.waterDeep = new THREE.Color();
    this.waterShallow = new THREE.Color();
    this.waterFoam = new THREE.Color();
    this.waterSand = new THREE.Color();
    this.nightness = 0;
    this.shadowRadius = 4;
    this.cycleBlend = 0;
    this.cyclePhase = timeOfDay;
    this.cycleTargets = null;
    this.target = null;
    this.setTarget(timeOfDay, true);
  }

  setTarget(timeOfDay, snap = false) {
    this.target = targetForTime(timeOfDay);
    if (snap) this.snapTo(this.target);
  }

  updateCycle(timeOfDay, progress) {
    this.cycleTargets ||= PHASES.map(targetForTime);
    const index = Math.max(0, PHASES.indexOf(timeOfDay));
    const a = this.cycleTargets[index];
    const b = this.cycleTargets[(index + 1) % PHASES.length];
    const blend = Math.max(0, progress * 2 - 1);
    this.cycleBlend = blend;
    this.cyclePhase = timeOfDay;
    this.target = a;
    this.ambient.color.copy(a.ambientColor).lerp(b.ambientColor, blend);
    this.ambient.intensity = THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, blend);
    this.hemisphereSky.copy(a.hemisphereSky).lerp(b.hemisphereSky, blend);
    this.hemisphereGround.copy(a.hemisphereGround).lerp(b.hemisphereGround, blend);
    this.sun.color.copy(a.sunColor).lerp(b.sunColor, blend);
    this.sun.intensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, blend);
    this.sun.position.copy(a.sunPosition).lerp(b.sunPosition, progress);
    this.fog.color.copy(a.fogColor).lerp(b.fogColor, blend);
    this.fog.density = THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, blend);
    this.skyTint.copy(a.skyTint).lerp(b.skyTint, blend);
    this.skyZenith.copy(a.skyZenith).lerp(b.skyZenith, blend);
    this.skyGround.copy(a.skyGround).lerp(b.skyGround, blend);
    this.sunTint.copy(a.sunTint).lerp(b.sunTint, blend);
    this.waterDeep.copy(a.waterDeep).lerp(b.waterDeep, blend);
    this.waterShallow.copy(a.waterShallow).lerp(b.waterShallow, blend);
    this.waterFoam.copy(a.waterFoam).lerp(b.waterFoam, blend);
    this.waterSand.copy(a.waterSand).lerp(b.waterSand, blend);
    this.nightness = THREE.MathUtils.lerp(a.nightness, b.nightness, blend);
    this.shadowRadius = THREE.MathUtils.lerp(a.shadowRadius, b.shadowRadius, blend);
  }

  snapTo(t) {
    this.ambient.color.copy(t.ambientColor);
    this.ambient.intensity = t.ambientIntensity;
    this.hemisphereSky.copy(t.hemisphereSky);
    this.hemisphereGround.copy(t.hemisphereGround);
    this.sun.color.copy(t.sunColor);
    this.sun.intensity = t.sunIntensity;
    this.sun.position.copy(t.sunPosition);
    this.fog.color.copy(t.fogColor);
    this.fog.density = t.fogDensity;
    this.skyTint.copy(t.skyTint);
    this.skyZenith.copy(t.skyZenith);
    this.skyGround.copy(t.skyGround);
    this.sunTint.copy(t.sunTint);
    this.waterDeep.copy(t.waterDeep);
    this.waterShallow.copy(t.waterShallow);
    this.waterFoam.copy(t.waterFoam);
    this.waterSand.copy(t.waterSand);
    this.nightness = t.nightness;
    this.shadowRadius = t.shadowRadius;
  }

  update(delta) {
    const t = this.target;
    if (!t) return;
    const k = 1 - Math.exp(-LERP_RATE * Math.min(delta, 0.1));
    this.ambient.color.lerp(t.ambientColor, k);
    this.ambient.intensity += (t.ambientIntensity - this.ambient.intensity) * k;
    this.hemisphereSky.lerp(t.hemisphereSky, k);
    this.hemisphereGround.lerp(t.hemisphereGround, k);
    this.sun.color.lerp(t.sunColor, k);
    this.sun.intensity += (t.sunIntensity - this.sun.intensity) * k;
    this.sun.position.lerp(t.sunPosition, k);
    this.fog.color.lerp(t.fogColor, k);
    this.fog.density += (t.fogDensity - this.fog.density) * k;
    this.skyTint.lerp(t.skyTint, k);
    this.skyZenith.lerp(t.skyZenith, k);
    this.skyGround.lerp(t.skyGround, k);
    this.sunTint.lerp(t.sunTint, k);
    this.waterDeep.lerp(t.waterDeep, k);
    this.waterShallow.lerp(t.waterShallow, k);
    this.waterFoam.lerp(t.waterFoam, k);
    this.waterSand.lerp(t.waterSand, k);
    this.nightness += (t.nightness - this.nightness) * k;
    this.shadowRadius += (t.shadowRadius - this.shadowRadius) * k;
  }
}
