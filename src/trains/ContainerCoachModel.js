import * as THREE from 'three';

export const CONTAINER_COACH_COLORS = {
  containerOrange: 0xd65b20,  // Industrial safety orange for shipping container
  ribOrange: 0xc4501a,        // Shaded orange for corrugation ribs
  roofOrange: 0xcc551c,       // Top container roof
  lockRodSteel: 0x7c8288,     // Steel grey for door locking rods & cams
  cornerDark: 0x2e3134,       // Dark steel for corner casting fittings
  chassisDark: 0x202224,      // Off-black dark slate for flatcar deck, couplers, buffers
  wheelDark: 0x32363a,        // Slate grey for wheel tires
  wheelHub: 0x1c1e20,         // Dark center hubcap
  wheelPin: 0x4a4e52,         // Steel center bolt pin
};

/**
 * Procedural Container Coach / Intermodal Flat Wagon Model matching reference sheet
 * Length: ~1.12, Width: ~0.48, Height: ~0.48
 */
export function createContainerCoach() {
  const coachGroup = new THREE.Group();
  coachGroup.name = 'ContainerCoach';

  // ── Materials ──
  const containerMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.containerOrange, flatShading: true });
  const ribMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.ribOrange, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.roofOrange, flatShading: true });
  const rodMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.lockRodSteel, flatShading: true });
  const cornerMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.cornerDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.wheelHub, flatShading: true });
  const pinMat = new THREE.MeshLambertMaterial({ color: CONTAINER_COACH_COLORS.wheelPin, flatShading: true });

  // ── 1. Undercarriage & Flatcar Chassis ──
  const chassisGroup = new THREE.Group();

  // Main flatbed deck
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

  // Twist-lock corner guides on deck
  const lockBaseGeo = new THREE.BoxGeometry(0.03, 0.024, 0.03);
  [-0.19, 0.19].forEach((xPos) => {
    [-0.405, 0.405].forEach((zPos) => {
      const lockBase = new THREE.Mesh(lockBaseGeo, chassisMat);
      lockBase.position.set(xPos, 0.13, zPos);
      chassisGroup.add(lockBase);
    });
  });

  coachGroup.add(chassisGroup);

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

      // Center hub
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

  coachGroup.add(wheelGroup);

  // ── 3. Intermodal Shipping Container ──
  const containerGroup = new THREE.Group();

  const cWidth = 0.38;
  const cLength = 0.80;
  const cHeight = 0.255;
  const cCenterY = 0.2525; // sits on flatbed y = 0.125 to 0.380

  // Main container body box
  const boxGeo = new THREE.BoxGeometry(cWidth, cHeight, cLength);
  const boxMesh = new THREE.Mesh(boxGeo, containerMat);
  boxMesh.position.set(0, cCenterY, 0);
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;
  containerGroup.add(boxMesh);

  // Top and bottom horizontal frame rails
  const hFrameSideGeo = new THREE.BoxGeometry(0.014, 0.016, cLength + 0.004);
  [-1, 1].forEach((xDir) => {
    // Top side rail
    const topRail = new THREE.Mesh(hFrameSideGeo, containerMat);
    topRail.position.set(xDir * (cWidth / 2 + 0.005), cCenterY + cHeight / 2 - 0.008, 0);
    containerGroup.add(topRail);

    // Bottom side rail
    const botRail = new THREE.Mesh(hFrameSideGeo, containerMat);
    botRail.position.set(xDir * (cWidth / 2 + 0.005), cCenterY - cHeight / 2 + 0.008, 0);
    containerGroup.add(botRail);
  });

  // End horizontal frame rails
  const hFrameEndGeo = new THREE.BoxGeometry(cWidth + 0.004, 0.016, 0.014);
  [-1, 1].forEach((zDir) => {
    // Top end rail
    const topEnd = new THREE.Mesh(hFrameEndGeo, containerMat);
    topEnd.position.set(0, cCenterY + cHeight / 2 - 0.008, zDir * (cLength / 2 + 0.005));
    containerGroup.add(topEnd);

    // Bottom end rail
    const botEnd = new THREE.Mesh(hFrameEndGeo, containerMat);
    botEnd.position.set(0, cCenterY - cHeight / 2 + 0.008, zDir * (cLength / 2 + 0.005));
    containerGroup.add(botEnd);
  });

  // Corner post casting fittings
  const cornerPostGeo = new THREE.BoxGeometry(0.022, cHeight + 0.008, 0.022);
  const cornerCastGeo = new THREE.BoxGeometry(0.026, 0.024, 0.026);

  [-1, 1].forEach((xDir) => {
    [-1, 1].forEach((zDir) => {
      // Vertical corner post
      const post = new THREE.Mesh(cornerPostGeo, containerMat);
      post.position.set(xDir * (cWidth / 2 + 0.005), cCenterY, zDir * (cLength / 2 + 0.005));
      post.castShadow = true;
      containerGroup.add(post);

      // Top corner casting block
      const topCast = new THREE.Mesh(cornerCastGeo, cornerMat);
      topCast.position.set(xDir * (cWidth / 2 + 0.005), cCenterY + cHeight / 2 - 0.004, zDir * (cLength / 2 + 0.005));
      containerGroup.add(topCast);

      // Bottom corner casting block
      const botCast = new THREE.Mesh(cornerCastGeo, cornerMat);
      botCast.position.set(xDir * (cWidth / 2 + 0.005), cCenterY - cHeight / 2 + 0.004, zDir * (cLength / 2 + 0.005));
      containerGroup.add(botCast);
    });
  });

  // ── 4. Vertical Corrugation Fluting (Sides & Front Wall) ──
  // Side corrugated vertical ribs (~14 ribs along length)
  const sideRibGeo = new THREE.BoxGeometry(0.008, cHeight - 0.028, 0.022);
  const numSideRibs = 14;
  const sideStep = (cLength - 0.10) / (numSideRibs - 1);
  const sideZStart = -(cLength - 0.10) / 2;

  for (let i = 0; i < numSideRibs; i++) {
    const zPos = sideZStart + i * sideStep;
    // Left side rib (-X)
    const leftRib = new THREE.Mesh(sideRibGeo, ribMat);
    leftRib.position.set(-cWidth / 2 - 0.004, cCenterY, zPos);
    leftRib.castShadow = true;
    containerGroup.add(leftRib);

    // Right side rib (+X)
    const rightRib = new THREE.Mesh(sideRibGeo, ribMat);
    rightRib.position.set(cWidth / 2 + 0.004, cCenterY, zPos);
    rightRib.castShadow = true;
    containerGroup.add(rightRib);
  }

  // Front end corrugated vertical ribs (z = +cLength/2)
  const frontRibGeo = new THREE.BoxGeometry(0.022, cHeight - 0.028, 0.008);
  const numFrontRibs = 6;
  const frontStep = (cWidth - 0.08) / (numFrontRibs - 1);
  const frontXStart = -(cWidth - 0.08) / 2;

  for (let i = 0; i < numFrontRibs; i++) {
    const xPos = frontXStart + i * frontStep;
    const fRib = new THREE.Mesh(frontRibGeo, ribMat);
    fRib.position.set(xPos, cCenterY, cLength / 2 + 0.004);
    fRib.castShadow = true;
    containerGroup.add(fRib);
  }

  // Roof shallow crosswise ribs
  const roofRibGeo = new THREE.BoxGeometry(cWidth - 0.02, 0.006, 0.016);
  for (let i = 0; i < numSideRibs; i++) {
    const zPos = sideZStart + i * sideStep;
    const rRib = new THREE.Mesh(roofRibGeo, roofMat);
    rRib.position.set(0, cCenterY + cHeight / 2 + 0.003, zPos);
    containerGroup.add(rRib);
  }

  // ── 5. Rear Cargo Doors with Vertical Locking Rods (z = -cLength/2) ──
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, cCenterY, -cLength / 2 - 0.002);

  // Center vertical door split seam
  const splitSeamGeo = new THREE.BoxGeometry(0.006, cHeight - 0.028, 0.006);
  const seam = new THREE.Mesh(splitSeamGeo, chassisMat);
  seam.position.set(0, 0, 0);
  doorGroup.add(seam);

  // 4 Vertical Steel Locking Rods
  const rodGeo = new THREE.CylinderGeometry(0.005, 0.005, cHeight - 0.03, 8);
  const camGeo = new THREE.BoxGeometry(0.014, 0.018, 0.014);
  const handleGeo = new THREE.BoxGeometry(0.03, 0.008, 0.012);

  const rodPositions = [-0.115, -0.045, 0.045, 0.115];

  rodPositions.forEach((xRod, idx) => {
    // Locking bar
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.set(xRod, 0, -0.006);
    rod.castShadow = true;
    doorGroup.add(rod);

    // Top and bottom lock cams / keeper brackets
    [-1, 1].forEach((yDir) => {
      const cam = new THREE.Mesh(camGeo, rodMat);
      cam.position.set(xRod, yDir * (cHeight / 2 - 0.022), -0.006);
      doorGroup.add(cam);
    });

    // Middle hinge bracket
    const midBracket = new THREE.Mesh(camGeo, rodMat);
    midBracket.position.set(xRod, 0, -0.006);
    doorGroup.add(midBracket);

    // Door latch handles on inner locking rods
    if (idx === 1 || idx === 2) {
      const handle = new THREE.Mesh(handleGeo, rodMat);
      handle.position.set(xRod + (idx === 1 ? -0.012 : 0.012), -0.015, -0.012);
      doorGroup.add(handle);
    }
  });

  // Horizontal door seal strips
  [-0.07, 0.07].forEach((yPos) => {
    const seal = new THREE.Mesh(new THREE.BoxGeometry(cWidth - 0.06, 0.006, 0.004), ribMat);
    seal.position.set(0, yPos, -0.002);
    doorGroup.add(seal);
  });

  containerGroup.add(doorGroup);
  coachGroup.add(containerGroup);

  return coachGroup;
}

/**
 * Get Container Coach dimensions
 */
export function getContainerCoachDimensions() {
  return {
    length: 1.12,
    width: 0.48,
    height: 0.48,
  };
}
