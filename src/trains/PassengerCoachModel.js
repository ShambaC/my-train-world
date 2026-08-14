import * as THREE from 'three';

export const COACH_COLORS = {
  bodyRed: 0xb82828,       // Rich crimson red for coach body and doors
  trimYellow: 0xdf9b24,    // Golden yellow for trim lines and window frames
  roofDark: 0x272a2d,      // Charcoal dark slate for roof and vents
  chassisDark: 0x202224,   // Off-black dark slate for underframe and couplers
  wheelDark: 0x32363a,     // Slate grey for wheel rim/tire
  wheelHub: 0x1c1e20,      // Dark center hubcap
  windowGlass: 0x141618,   // Deep dark glossy glass
  railingDark: 0x1e2022,   // Dark iron end railings
  accentBrass: 0xe5a328,   // Brass door handles
};

/**
 * Procedural Passenger Coach Model matching reference sheet
 * Length: ~1.12, Width: ~0.48, Height: ~0.55
 */
export function createPassengerCoach() {
  const coachGroup = new THREE.Group();
  coachGroup.name = 'PassengerCoach';

  // ── Materials ──
  const redMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.bodyRed, flatShading: true });
  const yellowMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.trimYellow, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.roofDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.wheelHub, flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({
    color: COACH_COLORS.windowGlass,
    flatShading: true,
    // Warm emissive so lit coach windows read at night without any dynamic
    // light cost; washed out by daylight, glowing after dark.
    emissive: 0xffa54d,
    emissiveIntensity: 0.6,
  });
  glassMat.userData = { windowGlow: true }; // nightness-scaled by TrainRenderer
  const railingMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.railingDark, flatShading: true });
  const brassMat = new THREE.MeshLambertMaterial({ color: COACH_COLORS.accentBrass, flatShading: true });

  // ── 1. Undercarriage & Chassis ──
  const chassisGroup = new THREE.Group();

  // Main chassis bed
  const chassisBedGeo = new THREE.BoxGeometry(0.44, 0.06, 1.04);
  const chassisBed = new THREE.Mesh(chassisBedGeo, chassisMat);
  chassisBed.position.set(0, 0.10, 0);
  chassisBed.castShadow = true;
  chassisBed.receiveShadow = true;
  chassisGroup.add(chassisBed);

  // Front and rear vestibule step platforms
  const platformGeo = new THREE.BoxGeometry(0.44, 0.03, 0.12);
  [-0.52, 0.52].forEach((zPos) => {
    const plat = new THREE.Mesh(platformGeo, chassisMat);
    plat.position.set(0, 0.115, zPos);
    plat.castShadow = true;
    plat.receiveShadow = true;
    chassisGroup.add(plat);
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

  // Side buffers
  const bufferGeo = new THREE.BoxGeometry(0.06, 0.05, 0.04);
  [-0.17, 0.17].forEach((xPos) => {
    [-0.59, 0.59].forEach((zPos) => {
      const buf = new THREE.Mesh(bufferGeo, chassisMat);
      buf.position.set(xPos, 0.09, zPos);
      chassisGroup.add(buf);
    });
  });

  // End safety railings on corner platforms
  const postGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6);
  const railSideGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.12, 6);
  const railEndGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.07, 6);

  [-1, 1].forEach((endSign) => {
    const endZ = endSign * 0.56;
    const bodyEdgeZ = endSign * 0.44;
    const midZ = endSign * 0.50;

    [-0.20, 0.20].forEach((xSide) => {
      // Vertical corner post
      const post = new THREE.Mesh(postGeo, railingMat);
      post.position.set(xSide, 0.19, endZ);
      chassisGroup.add(post);

      // Side rail connecting corner post to carriage body
      const sideRail = new THREE.Mesh(railSideGeo, railingMat);
      sideRail.rotation.x = Math.PI / 2;
      sideRail.position.set(xSide, 0.25, midZ);
      chassisGroup.add(sideRail);

      // Short transverse rail bar at the corner
      const endRail = new THREE.Mesh(railEndGeo, railingMat);
      endRail.rotation.z = Math.PI / 2;
      endRail.position.set(xSide * 0.85, 0.25, endZ);
      chassisGroup.add(endRail);
    });
  });

  coachGroup.add(chassisGroup);

  // ── 2. Wheels & Axles (2 Axles, 4 Wheels) ──
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

      // Center pin/bolt
      const pin = new THREE.Mesh(pinGeo, brassMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  coachGroup.add(wheelGroup);

  // ── 3. Carriage Body (Red Cabin Box) ──
  const bodyGroup = new THREE.Group();

  // Main body box
  const cabinBodyGeo = new THREE.BoxGeometry(0.42, 0.28, 0.88);
  const cabinBody = new THREE.Mesh(cabinBodyGeo, redMat);
  cabinBody.position.set(0, 0.27, 0);
  cabinBody.castShadow = true;
  cabinBody.receiveShadow = true;
  bodyGroup.add(cabinBody);

  // Yellow trim bands (Upper and Lower continuous horizontal stripes)
  const trimUpperGeo = new THREE.BoxGeometry(0.426, 0.018, 0.886);
  const trimUpper = new THREE.Mesh(trimUpperGeo, yellowMat);
  trimUpper.position.set(0, 0.36, 0);
  bodyGroup.add(trimUpper);

  const trimLowerGeo = new THREE.BoxGeometry(0.426, 0.018, 0.886);
  const trimLower = new THREE.Mesh(trimLowerGeo, yellowMat);
  trimLower.position.set(0, 0.17, 0);
  bodyGroup.add(trimLower);

  coachGroup.add(bodyGroup);

  // ── 4. Windows (3 on Left side, 3 on Right side) ──
  const windowGroup = new THREE.Group();
  const winFrameHBarGeo = new THREE.BoxGeometry(0.02, 0.02, 0.16);
  const winFrameVBarGeo = new THREE.BoxGeometry(0.02, 0.12, 0.02);
  const glassGeo = new THREE.BoxGeometry(0.015, 0.09, 0.12);

  [-0.26, 0, 0.26].forEach((zWin) => {
    [-0.212, 0.212].forEach((xSide) => {
      const winSub = new THREE.Group();
      winSub.position.set(xSide, 0.265, zWin);

      // Top frame bar
      const topBar = new THREE.Mesh(winFrameHBarGeo, yellowMat);
      topBar.position.set(0, 0.06, 0);
      winSub.add(topBar);

      // Bottom frame bar
      const bottomBar = new THREE.Mesh(winFrameHBarGeo, yellowMat);
      bottomBar.position.set(0, -0.06, 0);
      winSub.add(bottomBar);

      // Left frame bar
      const leftBar = new THREE.Mesh(winFrameVBarGeo, yellowMat);
      leftBar.position.set(0, 0, -0.07);
      winSub.add(leftBar);

      // Right frame bar
      const rightBar = new THREE.Mesh(winFrameVBarGeo, yellowMat);
      rightBar.position.set(0, 0, 0.07);
      winSub.add(rightBar);

      // Recessed dark glass
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(xSide > 0 ? -0.005 : 0.005, 0, 0);
      winSub.add(glass);

      windowGroup.add(winSub);
    });
  });

  coachGroup.add(windowGroup);

  // ── 5. End Doors (Front and Back Vestibules) ──
  const doorGroup = new THREE.Group();
  const doorFrameGeo = new THREE.BoxGeometry(0.16, 0.23, 0.015);
  const doorPanelGeo = new THREE.BoxGeometry(0.12, 0.20, 0.022);
  const handleGeo = new THREE.BoxGeometry(0.015, 0.025, 0.025);

  [-0.442, 0.442].forEach((zDoor) => {
    // Outer dark door frame
    const doorFrame = new THREE.Mesh(doorFrameGeo, chassisMat);
    doorFrame.position.set(0, 0.25, zDoor);
    doorGroup.add(doorFrame);

    // Inner red door panel
    const doorPanel = new THREE.Mesh(doorPanelGeo, redMat);
    doorPanel.position.set(0, 0.245, zDoor);
    doorGroup.add(doorPanel);

    // Golden brass door handle
    const handle = new THREE.Mesh(handleGeo, brassMat);
    handle.position.set(0.045, 0.24, zDoor + (zDoor > 0 ? 0.01 : -0.01));
    doorGroup.add(handle);
  });

  coachGroup.add(doorGroup);

  // ── 6. Arched Roof & Vents ──
  const roofGroup = new THREE.Group();

  // Roof eaves base trim
  const eavesGeo = new THREE.BoxGeometry(0.46, 0.025, 0.94);
  const eaves = new THREE.Mesh(eavesGeo, roofMat);
  eaves.position.set(0, 0.418, 0);
  eaves.castShadow = true;
  roofGroup.add(eaves);

  // Smooth extruded barrel arch roof
  const roofShape = new THREE.Shape();
  const halfW = 0.23;
  const archH = 0.07;
  roofShape.moveTo(-halfW, 0);
  roofShape.quadraticCurveTo(-halfW * 0.55, archH * 0.92, 0, archH);
  roofShape.quadraticCurveTo(halfW * 0.55, archH * 0.92, halfW, 0);
  roofShape.lineTo(halfW, -0.01);
  roofShape.lineTo(-halfW, -0.01);
  roofShape.closePath();

  const roofExtrudeSettings = {
    steps: 1,
    depth: 0.93,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.008,
    bevelSegments: 3,
  };
  const archGeo = new THREE.ExtrudeGeometry(roofShape, roofExtrudeSettings);
  archGeo.translate(0, 0, -0.465); // Center on Z

  const archMesh = new THREE.Mesh(archGeo, roofMat);
  archMesh.position.set(0, 0.428, 0);
  archMesh.castShadow = true;
  archMesh.receiveShadow = true;
  roofGroup.add(archMesh);

  // Roof Vents (2 rectangular vent boxes with raised caps)
  const ventBaseGeo = new THREE.BoxGeometry(0.15, 0.035, 0.13);
  const ventCapGeo = new THREE.BoxGeometry(0.13, 0.02, 0.11);

  [-0.24, 0.24].forEach((zVent) => {
    const ventBase = new THREE.Mesh(ventBaseGeo, roofMat);
    ventBase.position.set(0, 0.505, zVent);
    ventBase.castShadow = true;
    roofGroup.add(ventBase);

    const ventCap = new THREE.Mesh(ventCapGeo, chassisMat);
    ventCap.position.set(0, 0.525, zVent);
    ventCap.castShadow = true;
    roofGroup.add(ventCap);
  });

  coachGroup.add(roofGroup);

  return coachGroup;
}

/**
 * Get Passenger Coach dimensions
 */
export function getPassengerCoachDimensions() {
  return {
    length: 1.12,
    width: 0.48,
    height: 0.55,
  };
}
