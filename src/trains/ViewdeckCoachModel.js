import * as THREE from 'three';

export const VIEWDECK_COACH_COLORS = {
  bodyYellow: 0xdfa428,     // Rich warm mustard yellow body
  frameOchre: 0xa86c18,     // Darker ochre / wood trim for window frames
  roofCrimson: 0xba1e25,    // Deep carmine / crimson red for arched roof & cupola roof
  doorWood: 0x6b4629,       // Warm chestnut brown for end doors
  windowGlass: 0x1e262c,    // Dark tinted glass for windows
  railingDark: 0x202224,    // Dark slate for end platform safety railings
  chassisDark: 0x202224,    // Off-black dark slate for chassis, steps, couplers, buffers
  wheelDark: 0x32363a,      // Slate grey for wheel tires
  wheelHub: 0x1c1e20,       // Dark center hubcap
  wheelPin: 0x4a4e52,       // Steel center bolt pin
};

/**
 * Procedural Viewdeck Coach / Caboose / Observation Car Model matching reference sheet
 * Length: ~1.12, Width: ~0.48, Height: ~0.50
 */
export function createViewdeckCoach() {
  const coachGroup = new THREE.Group();
  coachGroup.name = 'ViewdeckCoach';

  // ── Materials ──
  const bodyMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.bodyYellow, flatShading: true });
  const frameMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.frameOchre, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.roofCrimson, flatShading: true });
  const doorMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.doorWood, flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.windowGlass, flatShading: true });
  const railMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.railingDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.wheelHub, flatShading: true });
  const pinMat = new THREE.MeshLambertMaterial({ color: VIEWDECK_COACH_COLORS.wheelPin, flatShading: true });

  // ── 1. Undercarriage & Platform Chassis ──
  const chassisGroup = new THREE.Group();

  // Main chassis bed
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

  // ── Open End Platform Safety Railings (Front & Rear) ──
  const railingGroup = new THREE.Group();
  const railPostGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6);
  const railTopEndGeo = new THREE.BoxGeometry(0.12, 0.01, 0.01);
  const railSideGeo = new THREE.BoxGeometry(0.01, 0.01, 0.15);

  [-1, 1].forEach((zDir) => {
    const zPlatformEnd = zDir * 0.51;
    const zBodyEdge = zDir * 0.36;

    // Left & Right corner vertical posts
    [-0.20, 0.20].forEach((xPos) => {
      // Outer corner post
      const post1 = new THREE.Mesh(railPostGeo, railMat);
      post1.position.set(xPos, 0.18, zPlatformEnd);
      post1.castShadow = true;
      railingGroup.add(post1);

      // Body-side post
      const post2 = new THREE.Mesh(railPostGeo, railMat);
      post2.position.set(xPos, 0.18, zBodyEdge);
      post2.castShadow = true;
      railingGroup.add(post2);

      // Side return top bar
      const sideBar = new THREE.Mesh(railSideGeo, railMat);
      sideBar.position.set(xPos, 0.235, zDir * 0.435);
      railingGroup.add(sideBar);
    });

    // Inner gate posts near center opening
    [-0.08, 0.08].forEach((xPos) => {
      const gatePost = new THREE.Mesh(railPostGeo, railMat);
      gatePost.position.set(xPos, 0.18, zPlatformEnd);
      railingGroup.add(gatePost);
    });

    // End top rail bars (Left segment & Right segment with center gap for door entrance)
    const leftEndBar = new THREE.Mesh(railTopEndGeo, railMat);
    leftEndBar.position.set(-0.14, 0.235, zPlatformEnd);
    railingGroup.add(leftEndBar);

    const rightEndBar = new THREE.Mesh(railTopEndGeo, railMat);
    rightEndBar.position.set(0.14, 0.235, zPlatformEnd);
    railingGroup.add(rightEndBar);
  });

  chassisGroup.add(railingGroup);
  coachGroup.add(chassisGroup);

  // ── 2. Wheels & Axles (2 Axles, 4 Wheels matching train scale) ──
  const wheelGroup = new THREE.Group();
  const axleGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8);
  const tireGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.04, 16);
  const flangeGeo = new THREE.CylinderGeometry(0.098, 0.098, 0.01, 16);
  const hubGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.048, 12);
  const pinGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.052, 8);

  [-0.28, 0.28].forEach((zAxle) => {
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

      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  coachGroup.add(wheelGroup);

  // ── 3. Main Cabin Body (Warm Mustard Yellow) ──
  const bodyGroup = new THREE.Group();

  const cabinWidth = 0.38;
  const cabinLength = 0.72;
  const cabinHeight = 0.22;
  const cabinCenterY = 0.235; // sits on y = 0.125 to 0.345

  const mainBoxGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
  const mainBox = new THREE.Mesh(mainBoxGeo, bodyMat);
  mainBox.position.set(0, cabinCenterY, 0);
  mainBox.castShadow = true;
  mainBox.receiveShadow = true;
  bodyGroup.add(mainBox);

  // Corner vertical edge post trims
  const cornerTrimGeo = new THREE.BoxGeometry(0.014, cabinHeight + 0.004, 0.014);
  [-1, 1].forEach((xDir) => {
    [-1, 1].forEach((zDir) => {
      const post = new THREE.Mesh(cornerTrimGeo, frameMat);
      post.position.set(xDir * (cabinWidth / 2 + 0.003), cabinCenterY, zDir * (cabinLength / 2 + 0.003));
      post.castShadow = true;
      bodyGroup.add(post);
    });
  });

  // ── 4. Windows (3 Large Square Windows per side) ──
  const winW = 0.10;
  const winH = 0.10;
  const winZPositions = [-0.22, 0, 0.22];

  const glassPaneGeo = new THREE.BoxGeometry(0.004, winH, winW);
  const frameHGeo = new THREE.BoxGeometry(0.012, 0.014, winW + 0.024);
  const frameVGeo = new THREE.BoxGeometry(0.012, winH + 0.004, 0.014);

  winZPositions.forEach((zPos) => {
    [-1, 1].forEach((xDir) => {
      const winSub = new THREE.Group();
      const xPos = xDir * (cabinWidth / 2 + 0.004);
      winSub.position.set(xPos, 0.24, zPos);

      // Dark glass pane
      const glass = new THREE.Mesh(glassPaneGeo, glassMat);
      winSub.add(glass);

      // Outer Frame
      const topFrame = new THREE.Mesh(frameHGeo, frameMat);
      topFrame.position.set(0, winH / 2 + 0.004, 0);
      winSub.add(topFrame);

      const botFrame = new THREE.Mesh(frameHGeo, frameMat);
      botFrame.position.set(0, -winH / 2 - 0.004, 0);
      winSub.add(botFrame);

      const leftFrame = new THREE.Mesh(frameVGeo, frameMat);
      leftFrame.position.set(0, 0, -winW / 2 - 0.004);
      winSub.add(leftFrame);

      const rightFrame = new THREE.Mesh(frameVGeo, frameMat);
      rightFrame.position.set(0, 0, winW / 2 + 0.004);
      winSub.add(rightFrame);

      bodyGroup.add(winSub);
    });
  });

  // ── 5. End Doors (Front & Rear Centered with Window Pane) ──
  const doorW = 0.11;
  const doorH = 0.18;
  const doorPanelGeo = new THREE.BoxGeometry(doorW, doorH, 0.012);
  const doorFrameHGeo = new THREE.BoxGeometry(doorW + 0.024, 0.014, 0.016);
  const doorFrameVGeo = new THREE.BoxGeometry(0.014, doorH, 0.016);
  const doorGlassGeo = new THREE.BoxGeometry(0.065, 0.065, 0.014);

  [-1, 1].forEach((zDir) => {
    const doorSub = new THREE.Group();
    const zPos = zDir * (cabinLength / 2 + 0.004);
    doorSub.position.set(0, 0.215, zPos);

    // Wooden door body
    const dPanel = new THREE.Mesh(doorPanelGeo, doorMat);
    dPanel.castShadow = true;
    doorSub.add(dPanel);

    // Door glass window
    const dGlass = new THREE.Mesh(doorGlassGeo, glassMat);
    dGlass.position.set(0, 0.035, 0);
    doorSub.add(dGlass);

    // Dark door frame
    const topDF = new THREE.Mesh(doorFrameHGeo, railMat);
    topDF.position.set(0, doorH / 2 + 0.004, 0);
    doorSub.add(topDF);

    const leftDF = new THREE.Mesh(doorFrameVGeo, railMat);
    leftDF.position.set(-doorW / 2 - 0.004, 0, 0);
    doorSub.add(leftDF);

    const rightDF = new THREE.Mesh(doorFrameVGeo, railMat);
    rightDF.position.set(doorW / 2 + 0.004, 0, 0);
    doorSub.add(rightDF);

    bodyGroup.add(doorSub);
  });

  coachGroup.add(bodyGroup);

  // ── 6. Main Arched Roof (Crimson Red with Eaves Overhang) ──
  const mainRoofShape = new THREE.Shape();
  const halfMainRoofW = 0.22;
  const mainRoofBaseY = 0.345;
  const mainRoofApexY = 0.395;
  const mainRoofThick = 0.022;

  mainRoofShape.moveTo(-halfMainRoofW, mainRoofBaseY);
  mainRoofShape.quadraticCurveTo(0, mainRoofApexY, halfMainRoofW, mainRoofBaseY);
  mainRoofShape.lineTo(halfMainRoofW, mainRoofBaseY - mainRoofThick);
  mainRoofShape.quadraticCurveTo(0, mainRoofApexY - mainRoofThick, -halfMainRoofW, mainRoofBaseY - mainRoofThick);
  mainRoofShape.closePath();

  const mainRoofLen = 0.84; // Overhangs platform ends (cabin is 0.72)
  const mainRoofGeo = new THREE.ExtrudeGeometry(mainRoofShape, { depth: mainRoofLen, bevelEnabled: false });
  mainRoofGeo.translate(0, 0, -mainRoofLen / 2);

  const mainRoofMesh = new THREE.Mesh(mainRoofGeo, roofMat);
  mainRoofMesh.castShadow = true;
  mainRoofMesh.receiveShadow = true;
  coachGroup.add(mainRoofMesh);

  // ── 7. Top Cupola / Lookout Observation Deck ──
  const cupolaGroup = new THREE.Group();

  const cupolaW = 0.26;
  const cupolaL = 0.32;
  const cupolaH = 0.075;
  const cupolaCenterY = 0.415; // sits from y = 0.380 to 0.455

  // Cupola yellow walls
  const cupolaBoxGeo = new THREE.BoxGeometry(cupolaW, cupolaH, cupolaL);
  const cupolaBox = new THREE.Mesh(cupolaBoxGeo, bodyMat);
  cupolaBox.position.set(0, cupolaCenterY, 0);
  cupolaBox.castShadow = true;
  cupolaBox.receiveShadow = true;
  cupolaGroup.add(cupolaBox);

  // Cupola side windows (2 rectangular windows per side)
  const cWinW = 0.065;
  const cWinH = 0.045;
  const cGlassSideGeo = new THREE.BoxGeometry(0.004, cWinH, cWinW);
  const cFrameSideGeo = new THREE.BoxGeometry(0.010, cWinH + 0.010, cWinW + 0.010);

  [-0.065, 0.065].forEach((zPos) => {
    [-1, 1].forEach((xDir) => {
      const xPos = xDir * (cupolaW / 2 + 0.003);
      // Frame
      const cFrame = new THREE.Mesh(cFrameSideGeo, frameMat);
      cFrame.position.set(xPos, cupolaCenterY, zPos);
      cupolaGroup.add(cFrame);
      // Glass
      const cGlass = new THREE.Mesh(cGlassSideGeo, glassMat);
      cGlass.position.set(xPos + xDir * 0.001, cupolaCenterY, zPos);
      cupolaGroup.add(cGlass);
    });
  });

  // Cupola front and rear windows (2 rectangular windows on front & rear)
  const cGlassEndGeo = new THREE.BoxGeometry(cWinW, cWinH, 0.004);
  const cFrameEndGeo = new THREE.BoxGeometry(cWinW + 0.010, cWinH + 0.010, 0.010);

  [-0.05, 0.05].forEach((xPos) => {
    [-1, 1].forEach((zDir) => {
      const zPos = zDir * (cupolaL / 2 + 0.003);
      // Frame
      const cFrame = new THREE.Mesh(cFrameEndGeo, frameMat);
      cFrame.position.set(xPos, cupolaCenterY, zPos);
      cupolaGroup.add(cFrame);
      // Glass
      const cGlass = new THREE.Mesh(cGlassEndGeo, glassMat);
      cGlass.position.set(xPos, cupolaCenterY, zPos + zDir * 0.001);
      cupolaGroup.add(cGlass);
    });
  });

  // Cupola Arched Curved Roof (Crimson Red)
  const cupolaRoofShape = new THREE.Shape();
  const halfCRoofW = 0.15;
  const cRoofBaseY = 0.450;
  const cRoofApexY = 0.490;
  const cRoofThick = 0.018;

  cupolaRoofShape.moveTo(-halfCRoofW, cRoofBaseY);
  cupolaRoofShape.quadraticCurveTo(0, cRoofApexY, halfCRoofW, cRoofBaseY);
  cupolaRoofShape.lineTo(halfCRoofW, cRoofBaseY - cRoofThick);
  cupolaRoofShape.quadraticCurveTo(0, cRoofApexY - cRoofThick, -halfCRoofW, cRoofBaseY - cRoofThick);
  cupolaRoofShape.closePath();

  const cRoofLen = 0.38; // Overhangs cupola body (0.32) by 0.03 each end
  const cRoofGeo = new THREE.ExtrudeGeometry(cupolaRoofShape, { depth: cRoofLen, bevelEnabled: false });
  cRoofGeo.translate(0, 0, -cRoofLen / 2);

  const cRoofMesh = new THREE.Mesh(cRoofGeo, roofMat);
  cRoofMesh.castShadow = true;
  cRoofMesh.receiveShadow = true;
  cupolaGroup.add(cRoofMesh);

  coachGroup.add(cupolaGroup);

  return coachGroup;
}

/**
 * Get Viewdeck Coach dimensions
 */
export function getViewdeckCoachDimensions() {
  return {
    length: 1.12,
    width: 0.48,
    height: 0.50,
  };
}
