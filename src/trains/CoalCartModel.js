import * as THREE from 'three';

export const COAL_CART_COLORS = {
  bodyMetal: 0x3e4246,     // Dark charcoal slate steel for hopper body and ribs
  rimDark: 0x323538,       // Structured dark steel for top collar
  rivetSteel: 0x52575c,    // Highlighted steel for rivets and bolts
  chassisDark: 0x202224,   // Off-black dark slate for undercarriage and couplers
  wheelDark: 0x32363a,     // Slate grey for wheel tires
  wheelHub: 0x1c1e20,      // Dark center hubcap
  wheelPin: 0x4a4e52,      // Steel center bolt pin
  coalBlack: 0x141618,     // Jet anthracite black for coal chunks
};

/**
 * Procedural Coal Cart / Coal Wagon Model matching reference sheet
 * Length: ~1.12, Width: ~0.48, Height: ~0.49
 */
export function createCoalCart() {
  const cartGroup = new THREE.Group();
  cartGroup.name = 'CoalCart';

  // ── Materials ──
  const bodyMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.bodyMetal, flatShading: true });
  const rimMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.rimDark, flatShading: true });
  const rivetMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.rivetSteel, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.wheelHub, flatShading: true });
  const pinMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.wheelPin, flatShading: true });
  const coalMat = new THREE.MeshLambertMaterial({ color: COAL_CART_COLORS.coalBlack, flatShading: true });

  // ── 1. Undercarriage & Chassis ──
  const chassisGroup = new THREE.Group();

  // Main chassis bed plate
  const bedGeo = new THREE.BoxGeometry(0.44, 0.05, 1.04);
  const bed = new THREE.Mesh(bedGeo, chassisMat);
  bed.position.set(0, 0.10, 0);
  bed.castShadow = true;
  bed.receiveShadow = true;
  chassisGroup.add(bed);

  // Front and rear bumper step extensions
  const bumperStepGeo = new THREE.BoxGeometry(0.44, 0.03, 0.10);
  [-0.52, 0.52].forEach((zPos) => {
    const step = new THREE.Mesh(bumperStepGeo, chassisMat);
    step.position.set(0, 0.11, zPos);
    step.castShadow = true;
    step.receiveShadow = true;
    chassisGroup.add(step);
  });

  // Center couplers & knuckles
  const couplerBoxGeo = new THREE.BoxGeometry(0.08, 0.06, 0.10);
  const couplerHeadGeo = new THREE.BoxGeometry(0.12, 0.04, 0.04);

  // Front coupler (z = +0.58)
  const frontCoupler = new THREE.Mesh(couplerBoxGeo, chassisMat);
  frontCoupler.position.set(0, 0.08, 0.58);
  chassisGroup.add(frontCoupler);
  const frontHead = new THREE.Mesh(couplerHeadGeo, chassisMat);
  frontHead.position.set(0, 0.08, 0.63);
  chassisGroup.add(frontHead);

  // Rear coupler (z = -0.58)
  const rearCoupler = new THREE.Mesh(couplerBoxGeo, chassisMat);
  rearCoupler.position.set(0, 0.08, -0.58);
  chassisGroup.add(rearCoupler);
  const rearHead = new THREE.Mesh(couplerHeadGeo, chassisMat);
  rearHead.position.set(0, 0.08, -0.63);
  chassisGroup.add(rearHead);

  // Side buffer pads
  const bufferGeo = new THREE.BoxGeometry(0.06, 0.05, 0.04);
  [-0.17, 0.17].forEach((xPos) => {
    [-0.59, 0.59].forEach((zPos) => {
      const buf = new THREE.Mesh(bufferGeo, chassisMat);
      buf.position.set(xPos, 0.09, zPos);
      chassisGroup.add(buf);
    });
  });

  cartGroup.add(chassisGroup);

  // ── 2. Wheels & Axles (2 Axles, 4 Wheels matching train scale) ──
  const wheelGroup = new THREE.Group();
  const axleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8);
  const tireGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16);
  const flangeGeo = new THREE.CylinderGeometry(0.098, 0.098, 0.01, 16);
  const hubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.048, 12);
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.052, 8);

  [-0.28, 0.28].forEach((zAxle) => {
    // Axle rod
    const axle = new THREE.Mesh(axleGeo, chassisMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.09, zAxle);
    wheelGroup.add(axle);

    // Left and Right wheels
    [-0.22, 0.22].forEach((xPos) => {
      const wheelSub = new THREE.Group();
      wheelSub.position.set(xPos, 0.09, zAxle);

      // Main wheel tire
      const tire = new THREE.Mesh(tireGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelSub.add(tire);

      // Inner flange
      const flange = new THREE.Mesh(flangeGeo, wheelMat);
      flange.rotation.z = Math.PI / 2;
      flange.position.x = xPos > 0 ? -0.015 : 0.015;
      wheelSub.add(flange);

      // Center hubcap
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      wheelSub.add(hub);

      // Center bolt pin
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  cartGroup.add(wheelGroup);

  // ── 3. Trapezoidal Hopper Container ──
  const hopperGroup = new THREE.Group();

  // Top dimensions: width = 0.44 (x: ±0.22), length = 0.86 (z: ±0.43), y = 0.37
  // Bottom dimensions: width = 0.30 (x: ±0.15), length = 0.76 (z: ±0.38), y = 0.125
  const topX = 0.22, botX = 0.15;
  const topZ = 0.43, botZ = 0.38;
  const topY = 0.37, botY = 0.125;

  const hopperVerts = new Float32Array([
    // Top 4 vertices (0: -x,-z, 1: +x,-z, 2: +x,+z, 3: -x,+z)
    -topX, topY, -topZ,
     topX, topY, -topZ,
     topX, topY,  topZ,
    -topX, topY,  topZ,
    // Bottom 4 vertices (4: -x,-z, 5: +x,-z, 6: +x,+z, 7: -x,+z)
    -botX, botY, -botZ,
     botX, botY, -botZ,
     botX, botY,  botZ,
    -botX, botY,  botZ,
  ]);

  const hopperIndices = [
    // Bottom face
    4, 6, 5, 4, 7, 6,
    // North face (-Z)
    0, 1, 5, 0, 5, 4,
    // South face (+Z)
    2, 3, 7, 2, 7, 6,
    // West face (-X)
    0, 4, 7, 0, 7, 3,
    // East face (+X)
    1, 2, 6, 1, 6, 5,
  ];

  const hopperGeo = new THREE.BufferGeometry();
  hopperGeo.setAttribute('position', new THREE.BufferAttribute(hopperVerts, 3));
  hopperGeo.setIndex(hopperIndices);
  hopperGeo.computeVertexNormals();

  const hopperMesh = new THREE.Mesh(hopperGeo, bodyMat);
  hopperMesh.castShadow = true;
  hopperMesh.receiveShadow = true;
  hopperGroup.add(hopperMesh);

  // ── 4. Thick Top Collar Rim ──
  const rimGroup = new THREE.Group();

  // Side rim bars
  const rimSideGeo = new THREE.BoxGeometry(0.024, 0.045, 0.90);
  [-0.224, 0.224].forEach((xPos) => {
    const sideRim = new THREE.Mesh(rimSideGeo, rimMat);
    sideRim.position.set(xPos, 0.385, 0);
    sideRim.castShadow = true;
    rimGroup.add(sideRim);
  });

  // End rim bars
  const rimEndGeo = new THREE.BoxGeometry(0.472, 0.045, 0.024);
  [-0.438, 0.438].forEach((zPos) => {
    const endRim = new THREE.Mesh(rimEndGeo, rimMat);
    endRim.position.set(0, 0.385, zPos);
    endRim.castShadow = true;
    rimGroup.add(endRim);
  });

  hopperGroup.add(rimGroup);

  // ── 5. Reinforcing Ribs & Studs ──
  const ribGroup = new THREE.Group();
  const rivetGeo = new THREE.SphereGeometry(0.007, 6, 6);

  // Side vertical angled ribs (4 per side)
  const dy = topY - botY; // 0.245
  const dx = topX - botX; // 0.07
  const sideRibLen = Math.hypot(dy, dx);
  const sideRibAngle = Math.atan2(dx, dy); // ~0.277 rad
  const sideRibGeo = new THREE.BoxGeometry(0.016, sideRibLen + 0.01, 0.024);

  const sideRibZPositions = [-0.34, -0.11, 0.11, 0.34];

  sideRibZPositions.forEach((zPos) => {
    // Left side rib (-X)
    const leftRib = new THREE.Mesh(sideRibGeo, bodyMat);
    leftRib.rotation.z = sideRibAngle;
    leftRib.position.set(-(botX + topX) / 2 - 0.006, (botY + topY) / 2, zPos);
    leftRib.castShadow = true;
    ribGroup.add(leftRib);

    // Right side rib (+X)
    const rightRib = new THREE.Mesh(sideRibGeo, bodyMat);
    rightRib.rotation.z = -sideRibAngle;
    rightRib.position.set((botX + topX) / 2 + 0.006, (botY + topY) / 2, zPos);
    rightRib.castShadow = true;
    ribGroup.add(rightRib);

    // Rivets on left and right ribs
    [-1, 1].forEach((xSide) => {
      [0.17, 0.25, 0.33].forEach((yRivet) => {
        const t = (yRivet - botY) / dy;
        const xRivet = xSide * ((1 - t) * botX + t * topX + 0.016);
        const rivet = new THREE.Mesh(rivetGeo, rivetMat);
        rivet.position.set(xRivet, yRivet, zPos);
        ribGroup.add(rivet);
      });
    });
  });

  // End vertical angled ribs (2 per end)
  const dz = topZ - botZ; // 0.05
  const endRibLen = Math.hypot(dy, dz);
  const endRibAngle = Math.atan2(dz, dy); // ~0.201 rad
  const endRibGeo = new THREE.BoxGeometry(0.024, endRibLen + 0.01, 0.016);

  [-1, 1].forEach((zEnd) => {
    [-0.09, 0.09].forEach((xPos) => {
      const endRib = new THREE.Mesh(endRibGeo, bodyMat);
      endRib.rotation.x = -zEnd * endRibAngle;
      endRib.position.set(xPos, (botY + topY) / 2, zEnd * ((botZ + topZ) / 2 + 0.006));
      endRib.castShadow = true;
      ribGroup.add(endRib);

      // End rib rivets
      [0.18, 0.27, 0.34].forEach((yRivet) => {
        const t = (yRivet - botY) / dy;
        const zRivet = zEnd * ((1 - t) * botZ + t * topZ + 0.016);
        const rivet = new THREE.Mesh(rivetGeo, rivetMat);
        rivet.position.set(xPos, yRivet, zRivet);
        ribGroup.add(rivet);
      });
    });
  });

  // Rim corner and perimeter rivets
  sideRibZPositions.forEach((zPos) => {
    [-0.238, 0.238].forEach((xPos) => {
      const rimRivet = new THREE.Mesh(rivetGeo, rivetMat);
      rimRivet.position.set(xPos, 0.385, zPos);
      ribGroup.add(rimRivet);
    });
  });
  [-0.15, 0, 0.15].forEach((xPos) => {
    [-0.45, 0.45].forEach((zPos) => {
      const rimRivet = new THREE.Mesh(rivetGeo, rivetMat);
      rimRivet.position.set(xPos, 0.385, zPos);
      ribGroup.add(rimRivet);
    });
  });

  hopperGroup.add(ribGroup);
  cartGroup.add(hopperGroup);

  // ── 6. Coal Mound / Rocks ──
  const coalGroup = new THREE.Group();
  coalGroup.name = 'CoalMound';

  // Base coal bed filler to block see-through
  const coalBedGeo = new THREE.BoxGeometry(0.38, 0.08, 0.78);
  const coalBed = new THREE.Mesh(coalBedGeo, coalMat);
  coalBed.position.set(0, 0.34, 0);
  coalGroup.add(coalBed);

  // Deterministic faceted coal rock chunks matching reference image
  const chunkGeos = [
    new THREE.DodecahedronGeometry(0.045, 0),
    new THREE.DodecahedronGeometry(0.055, 0),
    new THREE.DodecahedronGeometry(0.038, 0),
    new THREE.IcosahedronGeometry(0.048, 0),
  ];

  // Pre-calculated seed points for consistent, realistic coal rock mound
  const coalPositions = [
    // Center ridge (highest mound)
    [0.00, 0.44, 0.00, 1.25, 0.2, 0.3],
    [-0.05, 0.43, 0.14, 1.15, 0.5, 0.8],
    [0.06, 0.43, -0.15, 1.20, 0.8, 0.4],
    [-0.03, 0.42, 0.27, 1.10, 0.1, 0.6],
    [0.04, 0.42, -0.28, 1.12, 0.7, 0.2],

    // Mid layer rocks
    [-0.10, 0.40, 0.00, 1.05, 0.4, 0.1],
    [0.10, 0.40, 0.00, 1.08, 0.9, 0.5],
    [-0.11, 0.39, 0.16, 0.98, 0.3, 0.7],
    [0.11, 0.39, -0.14, 1.02, 0.6, 0.9],
    [-0.09, 0.39, -0.17, 0.95, 0.2, 0.5],
    [0.09, 0.39, 0.18, 1.00, 0.8, 0.3],

    // Outer & end rocks filling perimeter
    [-0.10, 0.38, 0.30, 0.90, 0.4, 0.2],
    [0.10, 0.38, 0.31, 0.92, 0.1, 0.6],
    [-0.10, 0.38, -0.31, 0.90, 0.7, 0.4],
    [0.10, 0.38, -0.30, 0.95, 0.5, 0.8],
    [0.00, 0.39, 0.36, 0.92, 0.2, 0.5],
    [0.00, 0.39, -0.36, 0.94, 0.6, 0.1],
    [-0.06, 0.41, -0.06, 1.05, 0.3, 0.4],
    [0.07, 0.41, 0.07, 1.06, 0.7, 0.9],
  ];

  coalPositions.forEach(([x, y, z, scale, rotX, rotY], idx) => {
    const geo = chunkGeos[idx % chunkGeos.length];
    const chunk = new THREE.Mesh(geo, coalMat);
    chunk.position.set(x, y, z);
    chunk.rotation.set(rotX * Math.PI, rotY * Math.PI, (idx * 0.3) % Math.PI);
    chunk.scale.set(scale, scale * 0.85, scale);
    chunk.castShadow = true;
    chunk.receiveShadow = true;
    coalGroup.add(chunk);
  });

  cartGroup.add(coalGroup);

  return cartGroup;
}

/**
 * Get Coal Cart dimensions
 */
export function getCoalCartDimensions() {
  return {
    length: 1.12,
    width: 0.48,
    height: 0.49,
  };
}
