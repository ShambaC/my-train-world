import * as THREE from 'three';

/**
 * Instanced puff system for soft smoke plumes (chimneys, vents).
 * One InstancedMesh, no React components per particle. Particles spawn at
 * the mesh origin and rise with sway; scale grows and fades near death.
 */
export class PuffSystem {
  constructor({
    count = 12,
    size = 0.08,
    rise = 0.35,
    life = 2.2,
    color = 0x8f8f8f,
    opacity = 0.55,
    position = [0, 0, 0],
    jitter = 0.02,
  } = {}) {
    this.count = count;
    this.rise = rise;
    this.life = life;
    this.jitter = jitter;
    this.elapsed = 0;

    const geometry = new THREE.DodecahedronGeometry(size, 0);
    const material = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity,
      flatShading: true,
      depthWrite: false,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.position.set(...position);
    this.mesh.renderOrder = 2;

    this.particles = Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * jitter,
      y: (i / count) * life * rise, // pre-spread so the plume is full immediately
      z: (Math.random() - 0.5) * jitter,
      vy: rise * (0.8 + Math.random() * 0.4),
      phase: Math.random() * Math.PI * 2,
      age: (i / count) * life,
    }));

    this.dummy = new THREE.Object3D();
    this.identity = new THREE.Quaternion();
  }

  update(dt, active = true) {
    this.elapsed += dt;
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age > this.life || !active) {
        // Full respawn at the emitter origin — the base of the plume must
        // stay anchored or it creeps up/away with every cycle.
        p.age = 0;
        p.x = (Math.random() - 0.5) * this.jitter;
        p.y = 0;
        p.z = (Math.random() - 0.5) * this.jitter;
        p.vy = this.rise * (0.8 + Math.random() * 0.4);
      }
      p.y += p.vy * dt;
      p.x += Math.sin(p.age * 1.8 + p.phase) * 0.03 * dt;
      p.z += Math.cos(p.age * 1.4 + p.phase) * 0.025 * dt;

      const progress = p.age / this.life;
      const grow = 1 + progress * 1.6;              // expands as it rises
      const fade = 1 - Math.max(0, (progress - 0.55) / 0.45); // fades near death
      const scale = Math.max(0.001, 0.6 * grow * fade);

      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.quaternion.copy(this.identity);
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
