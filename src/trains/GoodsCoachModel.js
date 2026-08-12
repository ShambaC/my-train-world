import * as THREE from 'three';

export const GOODS_COACH_COLORS = {
  bodyBlue: 0x2270b6,     // Cobalt blue for wooden boxcar body
  doorBlue: 0x277ec9,     // Defined blue for sliding door frames & X-braces
  doorRail: 0x565c63,     // Dark steel top door sliding rail
  roofDark: 0x282b2e,     // Charcoal dark slate for arched roof & eaves
  chassisDark: 0x202224,   // Off-black dark slate for chassis, steps, couplers, ladder
  wheelDark: 0x32363a,     // Slate grey for wheel tires
  wheelHub: 0x1c1e20,      // Dark center hubcap
  wheelPin: 0x4a4e52,      // Steel center bolt pin
};

/**
 * Procedural Goods Coach / Boxcar / Freight Van Model matching reference sheet
 * Length: ~1.12, Width: ~0.48, Height: ~0.49
 */
export function createGoodsCoach() {
  const coachGroup = new THREE.Group();
  coachGroup.name = 'GoodsCoach';

  // ── Materials ──
  const bodyMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.bodyBlue, flatShading: true });
  const doorMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.doorBlue, flatShading: true });
  const railMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.doorRail, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.roofDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.wheelHub, flatShading: true });
  const pinMat = new THREE.MeshLambertMaterial({ color: GOODS_COACH_COLORS.wheelPin, flatShading: true });

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

  // ── 3. Boxcar Body (Cobalt Blue Enclosed Cabin) ──
  const bodyGroup = new THREE.Group();

  const bodyWidth = 0.42;
  const bodyLength = 0.88;
  const bodyHeight = 0.255;
  const bodyY = 0.2525; // center from y = 0.125 to 0.380

  const mainBodyGeo = new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyLength);
  const mainBody = new THREE.Mesh(mainBodyGeo, bodyMat);
  mainBody.position.set(0, bodyY, 0);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  bodyGroup.add(mainBody);

  // Corner vertical post trims
  const cornerPostGeo = new THREE.BoxGeometry(0.016, bodyHeight + 0.005, 0.016);
  [-1, 1].forEach((xDir) => {
    [-1, 1].forEach((zDir) => {
      const post = new THREE.Mesh(cornerPostGeo, bodyMat);
      post.position.set(xDir * (bodyWidth / 2 + 0.004), bodyY, zDir * (bodyLength / 2 + 0.004));
      post.castShadow = true;
      bodyGroup.add(post);
    });
  });

  // Horizontal wooden plank slats / grooves on sides and ends
  const plankGrooveY = [0.16, 0.20, 0.24, 0.28, 0.32, 0.36];
  const sidePlankGeo = new THREE.BoxGeometry(0.006, 0.006, bodyLength);
  const endPlankGeo = new THREE.BoxGeometry(bodyWidth, 0.006, 0.006);
  const grooveMat = new THREE.MeshLambertMaterial({ color: 0x195c96, flatShading: true });

  plankGrooveY.forEach((yPos) => {
    // Side grooves
    [-1, 1].forEach((xDir) => {
      const groove = new THREE.Mesh(sidePlankGeo, grooveMat);
      groove.position.set(xDir * (bodyWidth / 2 + 0.002), yPos, 0);
      bodyGroup.add(groove);
    });

    // End grooves
    [-1, 1].forEach((zDir) => {
      const groove = new THREE.Mesh(endPlankGeo, grooveMat);
      groove.position.set(0, yPos, zDir * (bodyLength / 2 + 0.002));
      bodyGroup.add(groove);
    });
  });

  // ── 4. Sliding Cargo Doors with X-Bracing (Left & Right Sides) ──
  const doorWidth = 0.34;
  const doorHeight = 0.22;
  const doorThickness = 0.012;

  // Door slide runner rails (top steel bars)
  const railGeo = new THREE.BoxGeometry(0.012, 0.014, 0.82);
  [-1, 1].forEach((xDir) => {
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(xDir * (bodyWidth / 2 + 0.014), 0.375, 0);
    rail.castShadow = true;
    bodyGroup.add(rail);

    // Rail end brackets
    [-0.39, 0.39].forEach((zPos) => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.016), chassisMat);
      bracket.position.set(xDir * (bodyWidth / 2 + 0.012), 0.375, zPos);
      bodyGroup.add(bracket);
    });
  });

  // Function to build the framed sliding cargo door with X-braces
  const createSlidingDoor = (xPos, isRightSide) => {
    const dGroup = new THREE.Group();
    dGroup.position.set(xPos, 0.245, 0);

    // Door back panel
    const panelGeo = new THREE.BoxGeometry(doorThickness, doorHeight, doorWidth);
    const panel = new THREE.Mesh(panelGeo, doorMat);
    panel.castShadow = true;
    dGroup.add(panel);

    // Frame borders
    const frameBorderThick = 0.016;
    const hBarGeo = new THREE.BoxGeometry(frameBorderThick, 0.018, doorWidth);
    const vBarGeo = new THREE.BoxGeometry(frameBorderThick, doorHeight, 0.018);

    // Top & Bottom frame bars
    const topBar = new THREE.Mesh(hBarGeo, doorMat);
    topBar.position.set(0, doorHeight / 2 - 0.009, 0);
    dGroup.add(topBar);

    const botBar = new THREE.Mesh(hBarGeo, doorMat);
    botBar.position.set(0, -doorHeight / 2 + 0.009, 0);
    dGroup.add(botBar);

    // Left & Right outer frame bars
    const leftBar = new THREE.Mesh(vBarGeo, doorMat);
    leftBar.position.set(0, 0, -doorWidth / 2 + 0.009);
    dGroup.add(leftBar);

    const rightBar = new THREE.Mesh(vBarGeo, doorMat);
    rightBar.position.set(0, 0, doorWidth / 2 - 0.009);
    dGroup.add(rightBar);

    // Center vertical dividing strut
    const centerBar = new THREE.Mesh(vBarGeo, doorMat);
    centerBar.position.set(0, 0, 0);
    dGroup.add(centerBar);

    // X-Braces in Left half and Right half of door
    const halfWidth = doorWidth / 2;
    const diagLen = Math.hypot(doorHeight - 0.03, halfWidth - 0.02);
    const diagAngle = Math.atan2(halfWidth - 0.02, doorHeight - 0.03);
    const diagGeo = new THREE.BoxGeometry(frameBorderThick * 0.9, diagLen, 0.012);

    [-halfWidth / 2, halfWidth / 2].forEach((zCenter) => {
      // Diagonal 1 (\)
      const d1 = new THREE.Mesh(diagGeo, doorMat);
      d1.rotation.x = diagAngle;
      d1.position.set(0, 0, zCenter);
      dGroup.add(d1);

      // Diagonal 2 (/)
      const d2 = new THREE.Mesh(diagGeo, doorMat);
      d2.rotation.x = -diagAngle;
      d2.position.set(0, 0, zCenter);
      dGroup.add(d2);
    });

    // Bottom door runner guides
    const guideGeo = new THREE.BoxGeometry(0.02, 0.016, 0.02);
    [-0.14, 0.14].forEach((zGuide) => {
      const guide = new THREE.Mesh(guideGeo, chassisMat);
      guide.position.set(0, -doorHeight / 2 - 0.008, zGuide);
      dGroup.add(guide);
    });

    return dGroup;
  };

  // Attach left and right sliding doors
  bodyGroup.add(createSlidingDoor(-bodyWidth / 2 - 0.006, false));
  bodyGroup.add(createSlidingDoor(bodyWidth / 2 + 0.006, true));

  // ── 5. End Walls Details (Vertical Battens, End Ladder, Brake Handle) ──
  // Vertical center reinforcing battens on front and rear ends
  const endBattenGeo = new THREE.BoxGeometry(0.018, bodyHeight, 0.012);
  [-1, 1].forEach((zDir) => {
    const batten = new THREE.Mesh(endBattenGeo, bodyMat);
    batten.position.set(0, bodyY, zDir * (bodyLength / 2 + 0.005));
    batten.castShadow = true;
    bodyGroup.add(batten);
  });

  // End Access Ladder on Rear End (z = -0.44, left side x = -0.10)
  const ladderGroup = new THREE.Group();
  const ladderRailGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.28, 6);
  const ladderRungGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.065, 6);

  [-0.13, -0.07].forEach((xRail) => {
    const rail = new THREE.Mesh(ladderRailGeo, chassisMat);
    rail.position.set(xRail, 0.265, -bodyLength / 2 - 0.018);
    rail.castShadow = true;
    ladderGroup.add(rail);
  });

  [0.15, 0.20, 0.25, 0.30, 0.35, 0.39].forEach((yRung) => {
    const rung = new THREE.Mesh(ladderRungGeo, chassisMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(-0.10, yRung, -bodyLength / 2 - 0.018);
    rung.castShadow = true;
    ladderGroup.add(rung);
  });

  // Center brake lever / grab iron on rear end
  const handleGeo = new THREE.BoxGeometry(0.04, 0.015, 0.015);
  const handle = new THREE.Mesh(handleGeo, chassisMat);
  handle.position.set(0.05, 0.26, -bodyLength / 2 - 0.016);
  ladderGroup.add(handle);

  bodyGroup.add(ladderGroup);
  coachGroup.add(bodyGroup);

  // ── 6. Arched Curved Roof with Eaves Trim ──
  const roofShape = new THREE.Shape();
  const halfRoofW = 0.23;
  const roofBaseY = 0.375;
  const roofApexY = 0.445;
  const roofThick = 0.024;

  // Outer arched profile
  roofShape.moveTo(-halfRoofW, roofBaseY);
  roofShape.quadraticCurveTo(0, roofApexY, halfRoofW, roofBaseY);
  roofShape.lineTo(halfRoofW, roofBaseY - roofThick);
  roofShape.quadraticCurveTo(0, roofApexY - roofThick, -halfRoofW, roofBaseY - roofThick);
  roofShape.closePath();

  const roofLength = 0.94; // Overhangs body (0.88) by 0.03 at each end
  const extrudeSettings = {
    steps: 1,
    depth: roofLength,
    bevelEnabled: false,
  };

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
  // Center extrusion along Z
  roofGeo.translate(0, 0, -roofLength / 2);

  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  coachGroup.add(roofMesh);

  // Front and rear arched end fascia caps
  const capShape = new THREE.Shape();
  capShape.moveTo(-halfRoofW, roofBaseY - roofThick);
  capShape.quadraticCurveTo(0, roofApexY, halfRoofW, roofBaseY - roofThick);
  capShape.lineTo(halfRoofW, roofBaseY - roofThick - 0.015);
  capShape.lineTo(-halfRoofW, roofBaseY - roofThick - 0.015);
  capShape.closePath();

  const capGeo = new THREE.ExtrudeGeometry(capShape, { depth: 0.016, bevelEnabled: false });
  [-1, 1].forEach((dir) => {
    const cap = new THREE.Mesh(capGeo, roofMat);
    cap.position.set(0, 0, dir * (roofLength / 2) - (dir > 0 ? 0.016 : 0));
    cap.castShadow = true;
    coachGroup.add(cap);
  });

  return coachGroup;
}

/**
 * Get Goods Coach dimensions
 */
export function getGoodsCoachDimensions() {
  return {
    length: 1.12,
    width: 0.48,
    height: 0.49,
  };
}
