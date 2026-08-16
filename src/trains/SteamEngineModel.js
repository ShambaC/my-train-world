import * as THREE from 'three';
import { createContactPatch } from '../utils/contactPatch';

export const STEAM_COLORS = {
  cabRed: 0xb82828,        // Rich crimson red for the cab
  boilerDark: 0x222528,    // Charcoal slate for the boiler and smokestack
  brassGold: 0xdf9b24,     // Golden brass for boiler bands, domes, and window frames
  roofDark: 0x1c1e20,      // Dark slate for cab roof
  chassisDark: 0x202224,   // Off-black dark slate for chassis and couplers
  wheelDark: 0x32363a,     // Slate grey for wheel rims
  wheelHub: 0x1c1e20,      // Dark center hubcap
  windowGlass: 0x141618,   // Deep dark glossy glass
  rodMetal: 0x7c8288,      // Steel connecting side rods
  cowcatcherRed: 0xb82828, // Red pilot wedge
};

/**
 * Procedural Steam Locomotive Model matching reference sheet Row 1
 * Length: ~1.08, Width: ~0.48, Height: ~0.54
 */
export function createSteamEngine() {
  const engineGroup = new THREE.Group();
  engineGroup.name = 'SteamEngine';

  // ── Materials ──
  const redMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.cabRed, flatShading: true });
  const boilerMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.boilerDark, flatShading: true });
  const brassMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.brassGold, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.roofDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.wheelHub, flatShading: true });
  const rodMat = new THREE.MeshLambertMaterial({ color: STEAM_COLORS.rodMetal, flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({
    color: STEAM_COLORS.windowGlass,
    flatShading: true,
    emissive: 0xffa54d,
    emissiveIntensity: 0.6,
  });
  glassMat.userData = { windowGlow: true };

  // ── 1. Chassis & Undercarriage ──
  const chassisGroup = new THREE.Group();

  // Main chassis bed plate
  const chassisBedGeo = new THREE.BoxGeometry(0.44, 0.05, 0.96);
  const chassisBed = new THREE.Mesh(chassisBedGeo, chassisMat);
  chassisBed.position.set(0, 0.095, 0);
  chassisBed.castShadow = true;
  chassisBed.receiveShadow = true;
  chassisGroup.add(chassisBed);

  // Front bumper beam
  const frontBeamGeo = new THREE.BoxGeometry(0.44, 0.04, 0.06);
  const frontBeam = new THREE.Mesh(frontBeamGeo, chassisMat);
  frontBeam.position.set(0, 0.09, 0.49);
  chassisGroup.add(frontBeam);

  // Rear step platform & bumper
  const rearPlatformGeo = new THREE.BoxGeometry(0.44, 0.03, 0.12);
  const rearPlatform = new THREE.Mesh(rearPlatformGeo, chassisMat);
  rearPlatform.position.set(0, 0.095, -0.50);
  rearPlatform.castShadow = true;
  chassisGroup.add(rearPlatform);

  // Rear coupler knuckle
  const couplerBoxGeo = new THREE.BoxGeometry(0.08, 0.05, 0.08);
  const rearCoupler = new THREE.Mesh(couplerBoxGeo, chassisMat);
  rearCoupler.position.set(0, 0.08, -0.56);
  chassisGroup.add(rearCoupler);

  const couplerHeadGeo = new THREE.BoxGeometry(0.11, 0.04, 0.04);
  const rearHead = new THREE.Mesh(couplerHeadGeo, chassisMat);
  rearHead.position.set(0, 0.08, -0.60);
  chassisGroup.add(rearHead);

  // Red Cowcatcher (Wedge Pilot) in front
  const cowcatcherGroup = new THREE.Group();
  cowcatcherGroup.position.set(0, 0.065, 0.51);

  // Sloped wedge base
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-0.21, 0);
  wedgeShape.lineTo(0.21, 0);
  wedgeShape.lineTo(0.16, 0.08);
  wedgeShape.lineTo(-0.16, 0.08);
  wedgeShape.closePath();

  const wedgeExtrude = {
    steps: 1,
    depth: 0.10,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  };
  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, wedgeExtrude);
  const wedgeMesh = new THREE.Mesh(wedgeGeo, redMat);
  wedgeMesh.castShadow = true;
  cowcatcherGroup.add(wedgeMesh);

  // Grille slat bars on cowcatcher
  const slatGeo = new THREE.BoxGeometry(0.02, 0.075, 0.09);
  [-0.14, -0.07, 0, 0.07, 0.14].forEach((xSlat) => {
    const slat = new THREE.Mesh(slatGeo, redMat);
    slat.position.set(xSlat, 0.04, 0.05);
    slat.rotation.x = -0.22;
    cowcatcherGroup.add(slat);
  });

  chassisGroup.add(cowcatcherGroup);
  engineGroup.add(chassisGroup);

  // ── 2. Wheels & Connecting Side Rods ──
  const wheelGroup = new THREE.Group();
  const axleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8);
  const tireGeo = new THREE.CylinderGeometry(0.095, 0.095, 0.045, 16);
  const flangeGeo = new THREE.CylinderGeometry(0.104, 0.104, 0.01, 16);
  const hubGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.052, 12);
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.056, 8);

  const axleZPositions = [-0.22, 0.22];

  axleZPositions.forEach((zAxle) => {
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

      const pin = new THREE.Mesh(pinGeo, brassMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  // Connecting side-rods linking front and rear wheel hubs
  const sideRodGeo = new THREE.BoxGeometry(0.012, 0.022, 0.46);
  [-0.245, 0.245].forEach((xPos) => {
    const rod = new THREE.Mesh(sideRodGeo, rodMat);
    rod.position.set(xPos, 0.075, 0);
    wheelGroup.add(rod);
  });

  engineGroup.add(wheelGroup);

  // ── 3. Boiler, Bands, Domes & Smokestack ──
  const boilerGroup = new THREE.Group();

  // Horizontal boiler cylinder
  const boilerGeo = new THREE.CylinderGeometry(0.165, 0.165, 0.52, 16);
  const boiler = new THREE.Mesh(boilerGeo, boilerMat);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, 0.24, 0.12);
  boiler.castShadow = true;
  boiler.receiveShadow = true;
  boilerGroup.add(boiler);

  // Boiler front circular smokebox door
  const doorGeo = new THREE.CylinderGeometry(0.166, 0.166, 0.03, 16);
  const boilerDoor = new THREE.Mesh(doorGeo, boilerMat);
  boilerDoor.rotation.x = Math.PI / 2;
  boilerDoor.position.set(0, 0.24, 0.385);
  boilerGroup.add(boilerDoor);

  // Brass outer ring on boiler door
  const rimGeo = new THREE.TorusGeometry(0.155, 0.012, 8, 24);
  const doorRim = new THREE.Mesh(rimGeo, brassMat);
  doorRim.position.set(0, 0.24, 0.40);
  boilerGroup.add(doorRim);

  // Brass boiler bands (straps)
  const bandGeo = new THREE.TorusGeometry(0.168, 0.009, 8, 24);
  [-0.08, 0.08, 0.26].forEach((zBand) => {
    const band = new THREE.Mesh(bandGeo, brassMat);
    band.position.set(0, 0.24, zBand);
    boilerGroup.add(band);
  });

  // Brass Sand Dome (middle top)
  const domeBaseGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.04, 12);
  const domeBase = new THREE.Mesh(domeBaseGeo, brassMat);
  domeBase.position.set(0, 0.41, 0.04);
  boilerGroup.add(domeBase);

  const domeCapGeo = new THREE.SphereGeometry(0.065, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeCap = new THREE.Mesh(domeCapGeo, brassMat);
  domeCap.position.set(0, 0.43, 0.04);
  boilerGroup.add(domeCap);

  // Smokestack / Chimney (front top)
  const stackBaseGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12);
  const stackBase = new THREE.Mesh(stackBaseGeo, boilerMat);
  stackBase.position.set(0, 0.44, 0.26);
  stackBase.castShadow = true;
  boilerGroup.add(stackBase);

  const stackFlareGeo = new THREE.CylinderGeometry(0.075, 0.045, 0.07, 12);
  const stackFlare = new THREE.Mesh(stackFlareGeo, boilerMat);
  stackFlare.position.set(0, 0.52, 0.26);
  stackFlare.castShadow = true;
  boilerGroup.add(stackFlare);

  const stackRimGeo = new THREE.TorusGeometry(0.072, 0.008, 6, 16);
  const stackRim = new THREE.Mesh(stackRimGeo, roofMat);
  stackRim.rotation.x = Math.PI / 2;
  stackRim.position.set(0, 0.555, 0.26);
  boilerGroup.add(stackRim);

  // Headlight (front center on boiler door)
  const lightHousingGeo = new THREE.BoxGeometry(0.10, 0.10, 0.08);
  const lightHousing = new THREE.Mesh(lightHousingGeo, chassisMat);
  lightHousing.position.set(0, 0.24, 0.43);
  boilerGroup.add(lightHousing);

  const lightBezelGeo = new THREE.TorusGeometry(0.045, 0.008, 8, 16);
  const lightBezel = new THREE.Mesh(lightBezelGeo, brassMat);
  lightBezel.position.set(0, 0.24, 0.47);
  boilerGroup.add(lightBezel);

  const lightCoreGeo = new THREE.SphereGeometry(0.042, 10, 10);
  const lightCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, toneMapped: false });
  const lightCore = new THREE.Mesh(lightCoreGeo, lightCoreMat);
  lightCore.position.set(0, 0.24, 0.468);
  boilerGroup.add(lightCore);

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
  glowMesh.position.set(0, 0.24, 0.47);
  glowMesh.userData.lightGlow = 'glow';
  boilerGroup.add(glowMesh);

  engineGroup.add(boilerGroup);

  // ── 4. Red Cab, Windows & Curved Roof ──
  const cabGroup = new THREE.Group();

  // Cab main body block
  const cabBodyGeo = new THREE.BoxGeometry(0.42, 0.27, 0.38);
  const cabBody = new THREE.Mesh(cabBodyGeo, redMat);
  cabBody.position.set(0, 0.27, -0.21);
  cabBody.castShadow = true;
  cabBody.receiveShadow = true;
  cabGroup.add(cabBody);

  // Cab front wall filler around boiler
  const cabFrontGeo = new THREE.BoxGeometry(0.42, 0.27, 0.02);
  const cabFront = new THREE.Mesh(cabFrontGeo, redMat);
  cabFront.position.set(0, 0.27, -0.02);
  cabGroup.add(cabFront);

  // Side Windows (1 on left, 1 on right with brass trim)
  const winFrameHBarGeo = new THREE.BoxGeometry(0.02, 0.02, 0.16);
  const winFrameVBarGeo = new THREE.BoxGeometry(0.02, 0.13, 0.02);
  const winGlassGeo = new THREE.BoxGeometry(0.015, 0.10, 0.13);

  [-0.212, 0.212].forEach((xSide) => {
    const winSub = new THREE.Group();
    winSub.position.set(xSide, 0.31, -0.21);

    const topBar = new THREE.Mesh(winFrameHBarGeo, brassMat);
    topBar.position.set(0, 0.06, 0);
    winSub.add(topBar);

    const botBar = new THREE.Mesh(winFrameHBarGeo, brassMat);
    botBar.position.set(0, -0.06, 0);
    winSub.add(botBar);

    const leftBar = new THREE.Mesh(winFrameVBarGeo, brassMat);
    leftBar.position.set(0, 0, -0.075);
    winSub.add(leftBar);

    const rightBar = new THREE.Mesh(winFrameVBarGeo, brassMat);
    rightBar.position.set(0, 0, 0.075);
    winSub.add(rightBar);

    const glass = new THREE.Mesh(winGlassGeo, glassMat);
    glass.position.set(xSide > 0 ? -0.005 : 0.005, 0, 0);
    winSub.add(glass);

    cabGroup.add(winSub);
  });

  // Front cab windows (2 small square windows above boiler)
  const fWinFrameGeo = new THREE.BoxGeometry(0.09, 0.08, 0.02);
  const fWinGlassGeo = new THREE.BoxGeometry(0.07, 0.06, 0.025);
  [-0.13, 0.13].forEach((xPos) => {
    const fFrame = new THREE.Mesh(fWinFrameGeo, brassMat);
    fFrame.position.set(xPos, 0.34, -0.01);
    cabGroup.add(fFrame);

    const fGlass = new THREE.Mesh(fWinGlassGeo, glassMat);
    fGlass.position.set(xPos, 0.34, -0.01);
    cabGroup.add(fGlass);
  });

  // Curved Cab Roof with eaves overhang
  const roofEavesGeo = new THREE.BoxGeometry(0.46, 0.025, 0.44);
  const roofEaves = new THREE.Mesh(roofEavesGeo, roofMat);
  roofEaves.position.set(0, 0.41, -0.21);
  roofEaves.castShadow = true;
  cabGroup.add(roofEaves);

  const roofShape = new THREE.Shape();
  const halfW = 0.23;
  const archH = 0.065;
  roofShape.moveTo(-halfW, 0);
  roofShape.quadraticCurveTo(-halfW * 0.55, archH * 0.9, 0, archH);
  roofShape.quadraticCurveTo(halfW * 0.55, archH * 0.9, halfW, 0);
  roofShape.lineTo(halfW, -0.01);
  roofShape.lineTo(-halfW, -0.01);
  roofShape.closePath();

  const roofExtrudeSettings = {
    steps: 1,
    depth: 0.43,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.008,
    bevelSegments: 3,
  };
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, roofExtrudeSettings);
  roofGeo.translate(0, 0, -0.215);

  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.set(0, 0.42, -0.21);
  roofMesh.castShadow = true;
  cabGroup.add(roofMesh);

  engineGroup.add(cabGroup);

  // ── 5. Contact Patch ──
  const patch = createContactPatch(0.34, 0.3, -0.088);
  engineGroup.add(patch);

  return engineGroup;
}

export function getSteamEngineDimensions() {
  return { length: 1.08, width: 0.48, height: 0.54 };
}
