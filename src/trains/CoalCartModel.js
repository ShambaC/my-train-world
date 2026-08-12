import * as THREE from 'three';

export const COAL_CART_COLORS = {
  bodyDark: 0x5a5e62,
  chassisBlack: 0x3a3d40,
  wheelDark: 0x444849,
  coalBlack: 0x1e1e1e,
  rivetDark: 0x6a6e72,
};

/**
 * Procedural Coal Mine Cart Model
 * Open-top trapezoidal hopper on a simple 4-wheel chassis.
 * Length: ~0.90, Width: ~0.44, Height: ~0.48
 */
export function createCoalCart() {
  const group = new THREE.Group();
  group.name = 'CoalCart';

  // ── Materials ──
  const bodyMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.bodyDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.chassisBlack, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.wheelDark, flatShading: true });
  const rivetMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.rivetDark, flatShading: true });

  // ── 1. Chassis ──
  const chassisGroup = new THREE.Group();

  const bedGeo = new THREE.BoxGeometry(0.38, 0.04, 0.84);
  const bed = new THREE.Mesh(bedGeo, chassisMat);
  bed.position.set(0, 0.09, 0);
  bed.castShadow = true;
  bed.receiveShadow = true;
  chassisGroup.add(bed);

  // Cross supports
  const crossGeo = new THREE.BoxGeometry(0.36, 0.03, 0.03);
  [-0.28, 0, 0.28].forEach((z) => {
    const cross = new THREE.Mesh(crossGeo, chassisMat);
    cross.position.set(0, 0.065, z);
    cross.castShadow = true;
    chassisGroup.add(cross);
  });

  // Side beams
  const sideBeamGeo = new THREE.BoxGeometry(0.03, 0.04, 0.82);
  [-0.175, 0.175].forEach((x) => {
    const beam = new THREE.Mesh(sideBeamGeo, chassisMat);
    beam.position.set(x, 0.065, 0);
    beam.castShadow = true;
    chassisGroup.add(beam);
  });

  group.add(chassisGroup);

  // ── 2. Wheels & Axles ──
  const wheelGroup = new THREE.Group();
  const axleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.40, 8);
  const tireGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 12);
  const hubGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8);

  [-0.24, 0.24].forEach((zAxle) => {
    const axle = new THREE.Mesh(axleGeo, chassisMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.065, zAxle);
    wheelGroup.add(axle);

    [-0.19, 0.19].forEach((xPos) => {
      const tire = new THREE.Mesh(tireGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(xPos, 0.065, zAxle);
      tire.castShadow = true;
      wheelGroup.add(tire);

      const hub = new THREE.Mesh(hubGeo, chassisMat);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(xPos, 0.065, zAxle);
      wheelGroup.add(hub);
    });
  });

  group.add(wheelGroup);

  // ── 3. Hopper (Trapezoidal open-top container) ──
  const hopperGroup = new THREE.Group();

  const tW = 0.22, bW = 0.15, tH = 0.29, d = 0.74;
  const verts = new Float32Array([
    -tW, tH, -d / 2,   tW, tH, -d / 2,   tW, tH, d / 2,  -tW, tH, d / 2,
    -bW, 0, -d / 2,     bW, 0, -d / 2,     bW, 0, d / 2,  -bW, 0, d / 2,
  ]);
  const idx = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    2, 3, 7, 2, 7, 6,
    0, 4, 7, 0, 7, 3,
    1, 2, 6, 1, 6, 5,
  ];
  const hopperGeo = new THREE.BufferGeometry();
  hopperGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  hopperGeo.setIndex(idx);
  hopperGeo.computeVertexNormals();

  const hopperMesh = new THREE.Mesh(hopperGeo, bodyMat);
  hopperMesh.position.set(0, 0.11, 0);
  hopperMesh.castShadow = true;
  hopperMesh.receiveShadow = true;
  hopperGroup.add(hopperMesh);

  // Top rim band
  const rimGeo = new THREE.BoxGeometry(0.455, 0.025, 0.775);
  const rim = new THREE.Mesh(rimGeo, bodyMat);
  rim.position.set(0, 0.41, 0);
  rim.castShadow = true;
  hopperGroup.add(rim);

  // Vertical ribs (3 per side)
  const ribGeo = new THREE.BoxGeometry(0.02, 0.26, 0.025);
  [-0.24, 0, 0.24].forEach((z) => {
    [-0.215, 0.215].forEach((x) => {
      const rib = new THREE.Mesh(ribGeo, bodyMat);
      rib.position.set(x, 0.25, z);
      rib.castShadow = true;
      hopperGroup.add(rib);
    });
  });

  // Lower horizontal support beams
  const lowerBeamGeo = new THREE.BoxGeometry(0.02, 0.02, 0.72);
  [-0.165, 0.165].forEach((x) => {
    const beam = new THREE.Mesh(lowerBeamGeo, bodyMat);
    beam.position.set(x, 0.16, 0);
    hopperGroup.add(beam);
  });

  // End plates
  const endPlateGeo = new THREE.BoxGeometry(0.34, 0.22, 0.02);
  [-0.375, 0.375].forEach((z) => {
    const plate = new THREE.Mesh(endPlateGeo, bodyMat);
    plate.position.set(0, 0.24, z);
    plate.castShadow = true;
    hopperGroup.add(plate);
  });

  // ── Rivets ──
  const rivetGeo = new THREE.SphereGeometry(0.008, 4, 4);

  // Top rim rivets
  [-0.34, -0.17, 0, 0.17, 0.34].forEach((z) => {
    [-0.225, 0.225].forEach((x) => {
      const r = new THREE.Mesh(rivetGeo, rivetMat);
      r.position.set(x, 0.425, z);
      hopperGroup.add(r);
    });
  });

  // Side panel rivets (2 rows)
  [-0.215, 0.215].forEach((x) => {
    [-0.28, -0.14, 0, 0.14, 0.28].forEach((z) => {
      [0.18, 0.34].forEach((y) => {
        const r = new THREE.Mesh(rivetGeo, rivetMat);
        r.position.set(x, y, z);
        hopperGroup.add(r);
      });
    });
  });

  // End plate rivets
  [-0.375, 0.375].forEach((z) => {
    [-0.12, 0, 0.12].forEach((x) => {
      const r = new THREE.Mesh(rivetGeo, rivetMat);
      r.position.set(x, 0.34, z);
      hopperGroup.add(r);
    });
  });

  group.add(hopperGroup);

  // ── 4. Couplings ──
  const couplingGroup = new THREE.Group();
  const hookGeo = new THREE.BoxGeometry(0.04, 0.03, 0.06);
  const linkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.04);

  [-0.44, 0.44].forEach((z) => {
    const hook = new THREE.Mesh(hookGeo, chassisMat);
    hook.position.set(0, 0.08, z);
    hook.castShadow = true;
    couplingGroup.add(hook);

    const link = new THREE.Mesh(linkGeo, chassisMat);
    link.position.set(0, 0.08, z + (z > 0 ? 0.05 : -0.05));
    couplingGroup.add(link);
  });

  // Side buffers
  const bufGeo = new THREE.BoxGeometry(0.04, 0.035, 0.03);
  [-0.14, 0.14].forEach((x) => {
    [-0.44, 0.44].forEach((z) => {
      const buf = new THREE.Mesh(bufGeo, chassisMat);
      buf.position.set(x, 0.09, z);
      couplingGroup.add(buf);
    });
  });

  group.add(couplingGroup);

  // ── 5. Coal Load ──
  const coalGroup = createCoalLoad();
  group.add(coalGroup);

  return group;
}

function createCoalLoad() {
  const group = new THREE.Group();
  group.name = 'CoalLoad';

  const coalMat = new THREE.MeshLambertMaterial({
    color: COAL_CART_COLORS.coalBlack,
    flatShading: true,
  });

  const chunkGeo = new THREE.DodecahedronGeometry(0.04, 0);

  for (let i = 0; i < 22; i++) {
    const chunk = new THREE.Mesh(chunkGeo, coalMat);
    const x = (Math.random() - 0.5) * 0.30;
    const z = (Math.random() - 0.5) * 0.58;
    const baseY = 0.32;
    const yOff = Math.random() * 0.10;
    const mound = Math.max(0, 1.0 - Math.sqrt(x * x * 5 + z * z * 3)) * 0.08;
    chunk.position.set(x, baseY + yOff + mound, z);
    chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    const s = 0.7 + Math.random() * 0.6;
    chunk.scale.set(s, s * (0.6 + Math.random() * 0.5), s);
    chunk.castShadow = true;
    group.add(chunk);
  }

  return group;
}

export function getCoalCartDimensions() {
  return { length: 0.90, width: 0.44, height: 0.48 };
}
