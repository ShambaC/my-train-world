import * as THREE from 'three';
import { createContactPatch } from '../utils/contactPatch';

export const DIESEL_COLORS = {
  bodyGreen: 0x2e7041,     // Rich forest green for hood and cab
  louverDark: 0x225430,    // Darker green recessed louvers
  railYellow: 0xdf9b24,    // Bright safety yellow for handrails and trim
  stripeBlack: 0x181a1c,   // Black for hazard stripes and grille
  chassisDark: 0x202224,   // Off-black dark slate for chassis and fuel tank
  wheelDark: 0x32363a,     // Slate grey for wheels
  wheelHub: 0x1c1e20,      // Dark center hubcap
  windowGlass: 0x141618,   // Deep dark glossy glass
  roofDark: 0x245834,      // Slightly deeper green for cab roof
};

/**
 * Procedural Diesel Switcher Locomotive Model matching reference sheet Row 2
 * Length: ~1.08, Width: ~0.48, Height: ~0.52
 */
export function createDieselEngine() {
  const engineGroup = new THREE.Group();
  engineGroup.name = 'DieselEngine';

  // ── Materials ──
  const greenMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.bodyGreen, flatShading: true });
  const louverMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.louverDark, flatShading: true });
  const yellowMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.railYellow, flatShading: true });
  const blackMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.stripeBlack, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.wheelHub, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: DIESEL_COLORS.roofDark, flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({
    color: DIESEL_COLORS.windowGlass,
    flatShading: true,
    emissive: 0xffa54d,
    emissiveIntensity: 0.6,
  });
  glassMat.userData = { windowGlow: true };

  // ── 1. Chassis, Fuel Tank & Hazard Striped Pilots ──
  const chassisGroup = new THREE.Group();

  // Main chassis bed plate
  const chassisBedGeo = new THREE.BoxGeometry(0.44, 0.05, 0.98);
  const chassisBed = new THREE.Mesh(chassisBedGeo, chassisMat);
  chassisBed.position.set(0, 0.095, 0);
  chassisBed.castShadow = true;
  chassisBed.receiveShadow = true;
  chassisGroup.add(chassisBed);

  // Center underbelly fuel tank box between axles
  const fuelTankGeo = new THREE.BoxGeometry(0.36, 0.07, 0.32);
  const fuelTank = new THREE.Mesh(fuelTankGeo, chassisMat);
  fuelTank.position.set(0, 0.05, 0);
  fuelTank.castShadow = true;
  chassisGroup.add(fuelTank);

  // Front and rear bumper step decks
  const stepDeckGeo = new THREE.BoxGeometry(0.44, 0.03, 0.10);
  [-0.51, 0.51].forEach((zPos) => {
    const step = new THREE.Mesh(stepDeckGeo, chassisMat);
    step.position.set(0, 0.095, zPos);
    step.castShadow = true;
    step.receiveShadow = true;
    chassisGroup.add(step);
  });

  // Center couplers
  const couplerBoxGeo = new THREE.BoxGeometry(0.08, 0.05, 0.08);
  const couplerHeadGeo = new THREE.BoxGeometry(0.11, 0.04, 0.04);
  [-0.56, 0.56].forEach((zPos) => {
    const cBox = new THREE.Mesh(couplerBoxGeo, chassisMat);
    cBox.position.set(0, 0.08, zPos);
    chassisGroup.add(cBox);

    const cHead = new THREE.Mesh(couplerHeadGeo, chassisMat);
    cHead.position.set(0, 0.08, zPos + (zPos > 0 ? 0.04 : -0.04));
    chassisGroup.add(cHead);
  });

  // Hazard striped pilot buffer beams (Diagonal yellow & black stripes)
  [-0.49, 0.49].forEach((zPilot) => {
    const pilotGroup = new THREE.Group();
    pilotGroup.position.set(0, 0.07, zPilot);

    const beamGeo = new THREE.BoxGeometry(0.44, 0.06, 0.03);
    const beamMesh = new THREE.Mesh(beamGeo, blackMat);
    pilotGroup.add(beamMesh);

    // Diagonal chevron stripes across the beam
    const stripeCount = 6;
    const stripeW = 0.045;
    for (let i = 0; i < stripeCount; i++) {
      const xStripe = -0.18 + i * 0.072;
      const stripeGeo = new THREE.BoxGeometry(stripeW, 0.062, 0.032);
      const stripeMesh = new THREE.Mesh(stripeGeo, yellowMat);
      stripeMesh.position.set(xStripe, 0, 0);
      stripeMesh.rotation.z = xStripe < 0 ? -0.45 : 0.45;
      pilotGroup.add(stripeMesh);
    }

    chassisGroup.add(pilotGroup);
  });

  engineGroup.add(chassisGroup);

  // ── 2. Wheels & Axles (2 Axles, 4 Wheels) ──
  const wheelGroup = new THREE.Group();
  const axleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8);
  const tireGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.045, 16);
  const flangeGeo = new THREE.CylinderGeometry(0.098, 0.098, 0.01, 16);
  const hubGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.052, 12);
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.056, 8);

  [-0.26, 0.26].forEach((zAxle) => {
    const axle = new THREE.Mesh(axleGeo, chassisMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.09, zAxle);
    wheelGroup.add(axle);

    [-0.22, 0.22].forEach((xPos) => {
      const wheelSub = new THREE.Group();
      wheelSub.position.set(xPos, 0.09, zAxle);

      const tire = new THREE.Mesh(tireGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelSub.add(tire);

      const flange = new THREE.Mesh(flangeGeo, wheelMat);
      flange.rotation.z = Math.PI / 2;
      flange.position.x = xPos > 0 ? -0.015 : 0.015;
      wheelSub.add(flange);

      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2;
      wheelSub.add(hub);

      const pin = new THREE.Mesh(pinGeo, yellowMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  engineGroup.add(wheelGroup);

  // ── 3. Green Engine Hood (Front Section) ──
  const hoodGroup = new THREE.Group();

  // Long engine compartment hood
  const hoodBodyGeo = new THREE.BoxGeometry(0.30, 0.21, 0.54);
  const hoodBody = new THREE.Mesh(hoodBodyGeo, greenMat);
  hoodBody.position.set(0, 0.225, 0.14);
  hoodBody.castShadow = true;
  hoodBody.receiveShadow = true;
  hoodGroup.add(hoodBody);

  // Front nose bevel cap
  const noseCapGeo = new THREE.BoxGeometry(0.30, 0.20, 0.04);
  const noseCap = new THREE.Mesh(noseCapGeo, greenMat);
  noseCap.position.set(0, 0.22, 0.42);
  noseCap.castShadow = true;
  hoodGroup.add(noseCap);

  // Front radiator grille (vertical slats)
  const grilleFrameGeo = new THREE.BoxGeometry(0.18, 0.15, 0.02);
  const grilleFrame = new THREE.Mesh(grilleFrameGeo, yellowMat);
  grilleFrame.position.set(0, 0.21, 0.435);
  hoodGroup.add(grilleFrame);

  const grilleMeshGeo = new THREE.BoxGeometry(0.15, 0.12, 0.025);
  const grilleMesh = new THREE.Mesh(grilleMeshGeo, blackMat);
  grilleMesh.position.set(0, 0.21, 0.438);
  hoodGroup.add(grilleMesh);

  // Side Louver Vent Panels (left & right)
  const louverPanelGeo = new THREE.BoxGeometry(0.015, 0.11, 0.36);
  [-0.152, 0.152].forEach((xSide) => {
    const louver = new THREE.Mesh(louverPanelGeo, louverMat);
    louver.position.set(xSide, 0.23, 0.14);
    hoodGroup.add(louver);

    // Horizontal louver slats
    for (let s = -2; s <= 2; s++) {
      const slatGeo = new THREE.BoxGeometry(0.018, 0.012, 0.34);
      const slat = new THREE.Mesh(slatGeo, greenMat);
      slat.position.set(xSide, 0.23 + s * 0.02, 0.14);
      hoodGroup.add(slat);
    }
  });

  // Top Exhaust Stack & Radiator Vent on Hood
  const exhaustGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10);
  const exhaust = new THREE.Mesh(exhaustGeo, blackMat);
  exhaust.position.set(0, 0.35, 0.28);
  exhaust.castShadow = true;
  hoodGroup.add(exhaust);

  const topVentGeo = new THREE.BoxGeometry(0.16, 0.02, 0.14);
  const topVent = new THREE.Mesh(topVentGeo, blackMat);
  topVent.position.set(0, 0.335, 0.02);
  hoodGroup.add(topVent);

  // Front Headlight (mounted on nose)
  const lightHousingGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12);
  const lightHousing = new THREE.Mesh(lightHousingGeo, blackMat);
  lightHousing.rotation.x = Math.PI / 2;
  lightHousing.position.set(0, 0.28, 0.445);
  hoodGroup.add(lightHousing);

  const lightRimGeo = new THREE.TorusGeometry(0.042, 0.007, 8, 16);
  const lightRim = new THREE.Mesh(lightRimGeo, yellowMat);
  lightRim.position.set(0, 0.28, 0.47);
  hoodGroup.add(lightRim);

  const lightCoreGeo = new THREE.SphereGeometry(0.038, 10, 10);
  const lightCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, toneMapped: false });
  const lightCore = new THREE.Mesh(lightCoreGeo, lightCoreMat);
  lightCore.position.set(0, 0.28, 0.468);
  hoodGroup.add(lightCore);

  const glowGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glowMesh = new THREE.Mesh(glowGeo, glowMat);
  glowMesh.position.set(0, 0.28, 0.47);
  glowMesh.userData.lightGlow = 'glow';
  hoodGroup.add(glowMesh);

  engineGroup.add(hoodGroup);

  // ── 4. High-Visibility Cab (Rear Section) ──
  const cabGroup = new THREE.Group();

  // Cab main body block
  const cabBodyGeo = new THREE.BoxGeometry(0.40, 0.28, 0.34);
  const cabBody = new THREE.Mesh(cabBodyGeo, greenMat);
  cabBody.position.set(0, 0.275, -0.27);
  cabBody.castShadow = true;
  cabBody.receiveShadow = true;
  cabGroup.add(cabBody);

  // Front Windshield Windows (2 windows looking over the hood)
  const fWinGeo = new THREE.BoxGeometry(0.12, 0.10, 0.02);
  const fGlassGeo = new THREE.BoxGeometry(0.10, 0.08, 0.025);
  [-0.10, 0.10].forEach((xPos) => {
    const frame = new THREE.Mesh(fWinGeo, yellowMat);
    frame.position.set(xPos, 0.34, -0.095);
    cabGroup.add(frame);

    const glass = new THREE.Mesh(fGlassGeo, glassMat);
    glass.position.set(xPos, 0.34, -0.095);
    cabGroup.add(glass);
  });

  // Rear Cab Windows (2 windows)
  [-0.10, 0.10].forEach((xPos) => {
    const frame = new THREE.Mesh(fWinGeo, yellowMat);
    frame.position.set(xPos, 0.34, -0.445);
    cabGroup.add(frame);

    const glass = new THREE.Mesh(fGlassGeo, glassMat);
    glass.position.set(xPos, 0.34, -0.445);
    cabGroup.add(glass);
  });

  // Side Cab Windows & Doors
  const sWinGeo = new THREE.BoxGeometry(0.02, 0.11, 0.14);
  const sGlassGeo = new THREE.BoxGeometry(0.025, 0.09, 0.12);
  [-0.202, 0.202].forEach((xSide) => {
    const sWin = new THREE.Mesh(sWinGeo, yellowMat);
    sWin.position.set(xSide, 0.34, -0.27);
    cabGroup.add(sWin);

    const sGlass = new THREE.Mesh(sGlassGeo, glassMat);
    sGlass.position.set(xSide, 0.34, -0.27);
    cabGroup.add(sGlass);
  });

  // Cab Roof with rounded side contours
  const roofEavesGeo = new THREE.BoxGeometry(0.44, 0.025, 0.38);
  const roofEaves = new THREE.Mesh(roofEavesGeo, roofMat);
  roofEaves.position.set(0, 0.42, -0.27);
  roofEaves.castShadow = true;
  cabGroup.add(roofEaves);

  const roofShape = new THREE.Shape();
  const halfW = 0.22;
  const archH = 0.05;
  roofShape.moveTo(-halfW, 0);
  roofShape.quadraticCurveTo(-halfW * 0.5, archH * 0.9, 0, archH);
  roofShape.quadraticCurveTo(halfW * 0.5, archH * 0.9, halfW, 0);
  roofShape.lineTo(halfW, -0.01);
  roofShape.lineTo(-halfW, -0.01);
  roofShape.closePath();

  const roofExtrudeSettings = {
    steps: 1,
    depth: 0.37,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 3,
  };
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, roofExtrudeSettings);
  roofGeo.translate(0, 0, -0.185);

  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, 0.43, -0.27);
  roofMesh.castShadow = true;
  cabGroup.add(roofMesh);

  // Roof Horn / Vent Cap
  const hornGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 8);
  const horn = new THREE.Mesh(hornGeo, yellowMat);
  horn.rotation.x = Math.PI / 2;
  horn.position.set(0, 0.485, -0.27);
  cabGroup.add(horn);

  engineGroup.add(cabGroup);

  // ── 5. Yellow Safety Handrails (Walkways, Steps, Cab) ──
  const railGroup = new THREE.Group();
  const postGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.16, 6);
  const sideRailGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.58, 6);
  const endRailGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6);

  // Side walkway handrails along the hood
  [-0.19, 0.19].forEach((xSide) => {
    // Top horizontal handrail bar
    const sideRail = new THREE.Mesh(sideRailGeo, yellowMat);
    sideRail.rotation.x = Math.PI / 2;
    sideRail.position.set(xSide, 0.25, 0.15);
    railGroup.add(sideRail);

    // Vertical stanchion posts
    [-0.10, 0.12, 0.38, 0.46].forEach((zPost) => {
      const post = new THREE.Mesh(postGeo, yellowMat);
      post.position.set(xSide, 0.18, zPost);
      railGroup.add(post);
    });

    // Short transverse corner rail at front step
    const fEndRail = new THREE.Mesh(endRailGeo, yellowMat);
    fEndRail.rotation.z = Math.PI / 2;
    fEndRail.position.set(xSide * 0.65, 0.25, 0.46);
    railGroup.add(fEndRail);

    // Rear step posts
    const rPost = new THREE.Mesh(postGeo, yellowMat);
    rPost.position.set(xSide, 0.18, -0.47);
    railGroup.add(rPost);

    const rEndRail = new THREE.Mesh(endRailGeo, yellowMat);
    rEndRail.rotation.z = Math.PI / 2;
    rEndRail.position.set(xSide * 0.65, 0.25, -0.47);
    railGroup.add(rEndRail);
  });

  engineGroup.add(railGroup);

  // ── 6. Contact Patch ──
  const patch = createContactPatch(0.34, 0.3, -0.088);
  engineGroup.add(patch);

  return engineGroup;
}

export function getDieselEngineDimensions() {
  return { length: 1.08, width: 0.48, height: 0.52 };
}
