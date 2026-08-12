import * as THREE from 'three';

export const GAS_COACH_COLORS = {
  tankGreen: 0x3c7c44,     // Forest olive green for main cylinder tank
  strapGreen: 0x306637,    // Darker accent green for tank straps/bands
  chassisDark: 0x202224,   // Off-black dark slate for chassis, saddles, dome, ladder
  hazardRed: 0xc92a2a,     // Vibrant hazard diamond red
  hazardWhite: 0xe8e4db,   // Off-white/cream diamond border
  wheelDark: 0x32363a,     // Slate grey for wheels
  wheelHub: 0x1c1e20,      // Dark center hubcap
  wheelPin: 0x4a4e52,      // Steel center bolt pin
};

/**
 * Procedural Gas Tank Coach / Oil Tanker Model matching reference sheet
 * Length: ~1.12, Width: ~0.48, Height: ~0.53
 */
export function createGasCoach() {
  const coachGroup = new THREE.Group();
  coachGroup.name = 'GasCoach';

  // ── Materials ──
  const tankMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.tankGreen, flatShading: true });
  const strapMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.strapGreen, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.wheelHub, flatShading: true });
  const pinMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.wheelPin, flatShading: true });
  const redMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.hazardRed, flatShading: true });
  const whiteMat = new THREE.MeshLambertMaterial({ color: GAS_COACH_COLORS.hazardWhite, flatShading: true });

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

  coachGroup.add(chassisGroup);

  // ── 2. Wheels & Axles (2 Axles, 4 Wheels matching train scale) ──
  const wheelGroup = new THREE.Group();
  const axleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8);
  const tireGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16);
  const flangeGeo = new THREE.CylinderGeometry(0.098, 0.098, 0.01, 16);
  const hubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.048, 12);
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.052, 8);

  [-0.28, 0.28].forEach((zAxle) => {
    // Axle crossbar
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

      // Center pin
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  coachGroup.add(wheelGroup);

  // ── 3. Tank Support Saddles / Cradles ──
  const saddleGroup = new THREE.Group();
  const saddleGeo = new THREE.BoxGeometry(0.07, 0.065, 0.08);

  [-0.16, 0.16].forEach((zPos) => {
    [-0.10, 0.10].forEach((xPos) => {
      const saddle = new THREE.Mesh(saddleGeo, chassisMat);
      saddle.position.set(xPos, 0.155, zPos);
      saddle.castShadow = true;
      saddleGroup.add(saddle);
    });
  });

  coachGroup.add(saddleGroup);

  // ── 4. Main Cylindrical Gas Tank ──
  const tankGroup = new THREE.Group();
  const tankRadius = 0.168;
  const tankLength = 0.80;
  const tankY = 0.31;

  // Horizontal cylinder
  const tankGeo = new THREE.CylinderGeometry(tankRadius, tankRadius, tankLength, 16);
  const tankMesh = new THREE.Mesh(tankGeo, tankMat);
  tankMesh.rotation.x = Math.PI / 2;
  tankMesh.position.set(0, tankY, 0);
  tankMesh.castShadow = true;
  tankMesh.receiveShadow = true;
  tankGroup.add(tankMesh);

  // Rounded / chamfered end caps on front and rear
  const capGeo = new THREE.CylinderGeometry(tankRadius * 0.94, tankRadius, 0.03, 16);
  [-1, 1].forEach((dir) => {
    const cap = new THREE.Mesh(capGeo, tankMat);
    cap.rotation.x = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    cap.position.set(0, tankY, dir * (tankLength / 2 + 0.015));
    cap.castShadow = true;
    tankGroup.add(cap);
  });

  // Raised circumferential tank straps / reinforcing bands
  const strapGeo = new THREE.CylinderGeometry(tankRadius + 0.008, tankRadius + 0.008, 0.04, 16);
  [-0.16, 0.16].forEach((zPos) => {
    const strap = new THREE.Mesh(strapGeo, strapMat);
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0, tankY, zPos);
    strap.castShadow = true;
    tankGroup.add(strap);
  });

  // ── 5. Top Dome / Manhole Hatch ──
  const domeGroup = new THREE.Group();

  // Dome neck
  const domeNeckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.045, 12);
  const domeNeck = new THREE.Mesh(domeNeckGeo, chassisMat);
  domeNeck.position.set(0, tankY + tankRadius + 0.018, 0);
  domeNeck.castShadow = true;
  domeGroup.add(domeNeck);

  // Dome top lid
  const domeLidGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.02, 12);
  const domeLid = new THREE.Mesh(domeLidGeo, chassisMat);
  domeLid.position.set(0, tankY + tankRadius + 0.045, 0);
  domeLid.castShadow = true;
  domeGroup.add(domeLid);

  tankGroup.add(domeGroup);

  // ── 6. Side Access Ladder ──
  const ladderGroup = new THREE.Group();
  const railGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.35, 6);
  const rungGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.065, 6);

  // Left side ladder (x = -0.178)
  [-0.032, 0.032].forEach((zRail) => {
    const rail = new THREE.Mesh(railGeo, chassisMat);
    rail.position.set(-0.178, 0.305, zRail);
    rail.castShadow = true;
    ladderGroup.add(rail);
  });

  [0.17, 0.25, 0.33, 0.41, 0.46].forEach((yRung) => {
    const rung = new THREE.Mesh(rungGeo, chassisMat);
    rung.rotation.x = Math.PI / 2;
    rung.position.set(-0.178, yRung, 0);
    rung.castShadow = true;
    ladderGroup.add(rung);
  });

  tankGroup.add(ladderGroup);

  // ── 7. Hazard Diamond Placards ──
  // Helper to create a layered diamond placard (Red diamond with white inner rim)
  const createHazardPlacard = () => {
    const pGroup = new THREE.Group();

    // Outer Red Diamond
    const outerGeo = new THREE.BoxGeometry(0.075, 0.075, 0.006);
    const outer = new THREE.Mesh(outerGeo, redMat);
    outer.rotation.z = Math.PI / 4;
    pGroup.add(outer);

    // Inner White Border Diamond
    const innerGeo = new THREE.BoxGeometry(0.058, 0.058, 0.008);
    const inner = new THREE.Mesh(innerGeo, whiteMat);
    inner.rotation.z = Math.PI / 4;
    pGroup.add(inner);

    // Center Red Diamond
    const centerGeo = new THREE.BoxGeometry(0.044, 0.044, 0.010);
    const center = new THREE.Mesh(centerGeo, redMat);
    center.rotation.z = Math.PI / 4;
    pGroup.add(center);

    return pGroup;
  };

  // End Placards (Front z = +0.435, Rear z = -0.435)
  const frontPlacard = createHazardPlacard();
  frontPlacard.position.set(0, tankY, 0.435);
  tankGroup.add(frontPlacard);

  const rearPlacard = createHazardPlacard();
  rearPlacard.position.set(0, tankY, -0.435);
  rearPlacard.rotation.y = Math.PI;
  tankGroup.add(rearPlacard);

  // Side Placards (Left x = -0.172, Right x = +0.172)
  const leftPlacard = createHazardPlacard();
  leftPlacard.rotation.y = -Math.PI / 2;
  leftPlacard.position.set(-0.172, tankY, 0.26);
  tankGroup.add(leftPlacard);

  const rightPlacard = createHazardPlacard();
  rightPlacard.rotation.y = Math.PI / 2;
  rightPlacard.position.set(0.172, tankY, 0.26);
  tankGroup.add(rightPlacard);

  coachGroup.add(tankGroup);

  return coachGroup;
}

/**
 * Get Gas Coach dimensions
 */
export function getGasCoachDimensions() {
  return {
    length: 1.12,
    width: 0.48,
    height: 0.53,
  };
}
