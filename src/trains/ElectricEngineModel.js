import * as THREE from 'three';
import { createContactPatch } from '../utils/contactPatch';

export const ELECTRIC_COLORS = {
  bodyBlue: 0x245494,      // Rich royal blue for the boxcab body
  stripeRed: 0xb82828,     // Crimson red for lower buffer beam / sill stripe
  frameCream: 0xe4d8ba,    // Cream / warm beige for window frames
  doorSilver: 0x8a929a,    // Silver-grey for side cab doors
  roofDark: 0x24272a,      // Charcoal slate for the roof and clerestory
  pantoDark: 0x1c1e20,     // Dark iron for the pantograph frame
  chassisDark: 0x202224,   // Off-black dark slate for chassis and couplers
  wheelDark: 0x32363a,     // Slate grey for wheels
  wheelHub: 0x1c1e20,      // Dark center hubcap
  windowGlass: 0x141618,   // Deep dark glossy glass
};

/**
 * Procedural Electric Boxcab Locomotive Model matching reference sheet Row 3
 * Length: ~1.08, Width: ~0.48, Height: ~0.68 (with roof pantograph)
 */
export function createElectricEngine() {
  const engineGroup = new THREE.Group();
  engineGroup.name = 'ElectricEngine';

  // ── Materials ──
  const blueMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.bodyBlue, flatShading: true });
  const redMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.stripeRed, flatShading: true });
  const creamMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.frameCream, flatShading: true });
  const doorMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.doorSilver, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.roofDark, flatShading: true });
  const pantoMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.pantoDark, flatShading: true });
  const chassisMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.chassisDark, flatShading: true });
  const wheelMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.wheelDark, flatShading: true });
  const hubMat = new THREE.MeshLambertMaterial({ color: ELECTRIC_COLORS.wheelHub, flatShading: true });
  const glassMat = new THREE.MeshLambertMaterial({
    color: ELECTRIC_COLORS.windowGlass,
    flatShading: true,
    emissive: 0xffa54d,
    emissiveIntensity: 0.6,
  });
  glassMat.userData = { windowGlow: true };

  // ── 1. Undercarriage, Red Buffer Sills & Couplers ──
  const chassisGroup = new THREE.Group();

  // Main chassis bed plate
  const chassisBedGeo = new THREE.BoxGeometry(0.44, 0.05, 0.98);
  const chassisBed = new THREE.Mesh(chassisBedGeo, chassisMat);
  chassisBed.position.set(0, 0.095, 0);
  chassisBed.castShadow = true;
  chassisBed.receiveShadow = true;
  chassisGroup.add(chassisBed);

  // Red lower perimeter sill band
  const sillBandGeo = new THREE.BoxGeometry(0.446, 0.035, 0.986);
  const sillBand = new THREE.Mesh(sillBandGeo, redMat);
  sillBand.position.set(0, 0.13, 0);
  chassisGroup.add(sillBand);

  // Center underbody equipment / resistor box between axles
  const equipBoxGeo = new THREE.BoxGeometry(0.36, 0.07, 0.28);
  const equipBox = new THREE.Mesh(equipBoxGeo, chassisMat);
  equipBox.position.set(0, 0.055, 0);
  equipBox.castShadow = true;
  chassisGroup.add(equipBox);

  // Front & rear bumper steps
  const stepDeckGeo = new THREE.BoxGeometry(0.44, 0.025, 0.08);
  [-0.51, 0.51].forEach((zPos) => {
    const step = new THREE.Mesh(stepDeckGeo, chassisMat);
    step.position.set(0, 0.095, zPos);
    step.castShadow = true;
    chassisGroup.add(step);
  });

  // Front & rear couplers
  const couplerBoxGeo = new THREE.BoxGeometry(0.08, 0.05, 0.08);
  const couplerHeadGeo = new THREE.BoxGeometry(0.11, 0.04, 0.04);
  [-0.55, 0.55].forEach((zPos) => {
    const cBox = new THREE.Mesh(couplerBoxGeo, chassisMat);
    cBox.position.set(0, 0.08, zPos);
    chassisGroup.add(cBox);

    const cHead = new THREE.Mesh(couplerHeadGeo, chassisMat);
    cHead.position.set(0, 0.08, zPos + (zPos > 0 ? 0.04 : -0.04));
    chassisGroup.add(cHead);
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

      const pin = new THREE.Mesh(pinGeo, creamMat);
      pin.rotation.z = Math.PI / 2;
      wheelSub.add(pin);

      wheelGroup.add(wheelSub);
    });
  });

  engineGroup.add(wheelGroup);

  // ── 3. Royal Blue Boxcab Body ──
  const bodyGroup = new THREE.Group();

  // Main boxcab body block
  const bodyGeo = new THREE.BoxGeometry(0.42, 0.26, 0.94);
  const body = new THREE.Mesh(bodyGeo, blueMat);
  body.position.set(0, 0.275, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  bodyGroup.add(body);

  // Side Windows (4 windows per side with cream frames)
  const winFrameHGeo = new THREE.BoxGeometry(0.02, 0.018, 0.13);
  const winFrameVGeo = new THREE.BoxGeometry(0.02, 0.10, 0.018);
  const winGlassGeo = new THREE.BoxGeometry(0.015, 0.08, 0.10);

  const zWindowPositions = [-0.30, -0.10, 0.10, 0.30];

  zWindowPositions.forEach((zWin) => {
    [-0.212, 0.212].forEach((xSide) => {
      const winSub = new THREE.Group();
      winSub.position.set(xSide, 0.28, zWin);

      const topBar = new THREE.Mesh(winFrameHGeo, creamMat);
      topBar.position.set(0, 0.05, 0);
      winSub.add(topBar);

      const botBar = new THREE.Mesh(winFrameHGeo, creamMat);
      botBar.position.set(0, -0.05, 0);
      winSub.add(botBar);

      const leftBar = new THREE.Mesh(winFrameVGeo, creamMat);
      leftBar.position.set(0, 0, -0.06);
      winSub.add(leftBar);

      const rightBar = new THREE.Mesh(winFrameVGeo, creamMat);
      rightBar.position.set(0, 0, 0.06);
      winSub.add(rightBar);

      const glass = new THREE.Mesh(winGlassGeo, glassMat);
      glass.position.set(xSide > 0 ? -0.005 : 0.005, 0, 0);
      winSub.add(glass);

      bodyGroup.add(winSub);
    });
  });

  // Front & Rear End Windshield Windows (2 on front face, 2 on rear face)
  const endWinFrameHGeo = new THREE.BoxGeometry(0.12, 0.018, 0.02);
  const endWinFrameVGeo = new THREE.BoxGeometry(0.018, 0.10, 0.02);
  const endWinGlassGeo = new THREE.BoxGeometry(0.09, 0.08, 0.025);

  [-0.472, 0.472].forEach((zFace) => {
    [-0.10, 0.10].forEach((xPos) => {
      const winSub = new THREE.Group();
      winSub.position.set(xPos, 0.28, zFace);

      const topBar = new THREE.Mesh(endWinFrameHGeo, creamMat);
      topBar.position.set(0, 0.05, 0);
      winSub.add(topBar);

      const botBar = new THREE.Mesh(endWinFrameHGeo, creamMat);
      botBar.position.set(0, -0.05, 0);
      winSub.add(botBar);

      const leftBar = new THREE.Mesh(endWinFrameVGeo, creamMat);
      leftBar.position.set(-0.055, 0, 0);
      winSub.add(leftBar);

      const rightBar = new THREE.Mesh(endWinFrameVGeo, creamMat);
      rightBar.position.set(0.055, 0, 0);
      winSub.add(rightBar);

      const glass = new THREE.Mesh(endWinGlassGeo, glassMat);
      winSub.add(glass);

      bodyGroup.add(winSub);
    });
  });

  // Top center headlights (Front & Rear)
  [-0.472, 0.472].forEach((zFace) => {
    const isFront = zFace > 0;
    const lightHousingGeo = new THREE.BoxGeometry(0.08, 0.07, 0.06);
    const lightHousing = new THREE.Mesh(lightHousingGeo, roofMat);
    lightHousing.position.set(0, 0.38, zFace + (isFront ? 0.02 : -0.02));
    bodyGroup.add(lightHousing);

    const lightBezelGeo = new THREE.TorusGeometry(0.034, 0.006, 8, 16);
    const lightBezel = new THREE.Mesh(lightBezelGeo, creamMat);
    lightBezel.position.set(0, 0.38, zFace + (isFront ? 0.052 : -0.052));
    bodyGroup.add(lightBezel);

    const lightCoreGeo = new THREE.SphereGeometry(0.032, 10, 10);
    const lightCoreMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, toneMapped: false });
    const lightCore = new THREE.Mesh(lightCoreGeo, lightCoreMat);
    lightCore.position.set(0, 0.38, zFace + (isFront ? 0.05 : -0.05));
    bodyGroup.add(lightCore);

    if (isFront) {
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
      glowMesh.position.set(0, 0.38, zFace + 0.052);
      glowMesh.userData.lightGlow = 'glow';
      bodyGroup.add(glowMesh);
    }
  });

  engineGroup.add(bodyGroup);

  // ── 4. Clerestory Roof & Articulated Pantograph ──
  const roofGroup = new THREE.Group();

  // Main roof deck slab
  const roofSlabGeo = new THREE.BoxGeometry(0.44, 0.03, 0.96);
  const roofSlab = new THREE.Mesh(roofSlabGeo, roofMat);
  roofSlab.position.set(0, 0.415, 0);
  roofSlab.castShadow = true;
  roofGroup.add(roofSlab);

  // Raised clerestory / monitor center roof tier
  const clerestoryGeo = new THREE.BoxGeometry(0.32, 0.04, 0.76);
  const clerestory = new THREE.Mesh(clerestoryGeo, roofMat);
  clerestory.position.set(0, 0.445, 0);
  clerestory.castShadow = true;
  roofGroup.add(clerestory);

  // Roof insulator pedestals (4 corners under the pantograph)
  const insGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.03, 8);
  [-0.09, 0.09].forEach((xIns) => {
    [-0.14, 0.14].forEach((zIns) => {
      const ins = new THREE.Mesh(insGeo, creamMat);
      ins.position.set(xIns, 0.47, zIns);
      roofGroup.add(ins);
    });
  });

  // Articulated Diamond/Scissor Pantograph Frame
  const pantoGroup = new THREE.Group();
  pantoGroup.position.set(0, 0.48, 0);

  const pantoBaseGeo = new THREE.BoxGeometry(0.20, 0.015, 0.30);
  const pantoBase = new THREE.Mesh(pantoBaseGeo, pantoMat);
  pantoGroup.add(pantoBase);

  // Lower diamond arms
  const strutGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6);
  [-0.07, 0.07].forEach((xSide) => {
    // Front-leaning lower strut
    const strutF = new THREE.Mesh(strutGeo, pantoMat);
    strutF.position.set(xSide, 0.05, -0.06);
    strutF.rotation.x = 0.55;
    pantoGroup.add(strutF);

    // Rear-leaning lower strut
    const strutR = new THREE.Mesh(strutGeo, pantoMat);
    strutR.position.set(xSide, 0.05, 0.06);
    strutR.rotation.x = -0.55;
    pantoGroup.add(strutR);

    // Upper converging struts meeting at the top apex
    const uStrutF = new THREE.Mesh(strutGeo, pantoMat);
    uStrutF.position.set(xSide, 0.13, -0.06);
    uStrutF.rotation.x = -0.55;
    pantoGroup.add(uStrutF);

    const uStrutR = new THREE.Mesh(strutGeo, pantoMat);
    uStrutR.position.set(xSide, 0.13, 0.06);
    uStrutR.rotation.x = 0.55;
    pantoGroup.add(uStrutR);
  });

  // Top Collector Bow / Shoe (Horizontal bar contacting catenary wire)
  const bowBarGeo = new THREE.BoxGeometry(0.24, 0.012, 0.04);
  const bowBar = new THREE.Mesh(bowBarGeo, pantoMat);
  bowBar.position.set(0, 0.185, 0);
  pantoGroup.add(bowBar);

  const hornGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6);
  [-0.12, 0.12].forEach((xHorn) => {
    const horn = new THREE.Mesh(hornGeo, pantoMat);
    horn.rotation.z = xHorn > 0 ? -0.7 : 0.7;
    horn.position.set(xHorn, 0.19, 0);
    pantoGroup.add(horn);
  });

  roofGroup.add(pantoGroup);
  engineGroup.add(roofGroup);

  // ── 5. Contact Patch ──
  const patch = createContactPatch(0.34, 0.3, -0.088);
  engineGroup.add(patch);

  return engineGroup;
}

export function getElectricEngineDimensions() {
  return { length: 1.08, width: 0.48, height: 0.68 };
}
