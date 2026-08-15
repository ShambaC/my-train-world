/**
 * Procedural Voxel Pedestrian Models matching reference sheet
 * (src/assets/ModelImages/pedestrian_sheet.png)
 *
 * 21 distinct character archetypes:
 * - Station staff / conductors (navy, black, female variants)
 * - Business travelers & commuters (suit, briefcase, glasses, messenger bag)
 * - Tourists & travelers (Hawaiian shirt, fedora, rolling suitcase, trench coat)
 * - Backpackers & hikers (green/red hoodies, large backpacks, sneakers)
 * - City casuals & youths (yellow cardigan, headphones, beanies, blue/pink hoodies)
 * - Workers (construction with hardhat + high-vis vest, mechanics with overalls + wrench)
 * - Seniors (elderly gentleman with cane + mustache, tweed gentleman with flat cap)
 *
 * Built with cached low-poly geometries and palette materials.
 * Includes limb pivot groups (legL, legR, armL, armR) for walk cycle animation.
 */
import * as THREE from 'three';

// ── Shared Palette & Materials ──────────────────────────────────────────
const COLOR_PALETTE = {
  // Skin tones
  skinLight: 0xf2d6b3,
  skinTan: 0xdfa87a,
  skinWarm: 0xd89b6a,
  skinDark: 0x8a5233,
  skinPale: 0xe8d5c4,

  // Hair & Facial Hair
  hairDark: 0x1f1a17,
  hairBrown: 0x3e2723,
  hairAuburn: 0x8d4925,
  hairBlonde: 0xd4a843,
  hairGrey: 0xb0bec5,
  hairWhite: 0xe0e0e0,

  // Clothing & Uniforms
  navyUniform: 0x1a2744,
  blackSuit: 0x212529,
  darkGrey: 0x374151,
  slateGrey: 0x5d6d7e,
  beigeCoat: 0xc4a47c,
  tweedBrown: 0x5d4037,
  brownLeather: 0x4e342e,
  warmBrown: 0x6d4c41,
  tanKhaki: 0xc8b088,

  // Bright tops & jackets
  redJacket: 0xb82828,
  crimsonTie: 0x991b1b,
  greenHoodie: 0x3d6b38,
  oliveBackpack: 0x2e5329,
  tealFloral: 0x16a085,
  tealJacket: 0x1abc9c,
  blueHoodie: 0x1976d2,
  royalBlueOveralls: 0x1e56a0,
  yellowCardigan: 0xe59819,
  yellowShirt: 0xf1c40f,
  highvisOrange: 0xff6b00,
  silverReflective: 0xd5dbdb,
  purpleHoodie: 0x6c3483,
  purpleBeanie: 0x7d3c98,
  redBeanie: 0xc0392b,
  greenBeanie: 0x2e7d32,
  whiteTop: 0xf5f5f5,
  lightBlueShirt: 0x85c1e9,

  // Pants & Denims
  blueJeans: 0x2b4c7e,
  darkJeans: 0x1c2833,
  greySlacks: 0x4a5568,

  // Accents & Hardware
  goldTrim: 0xd4af37,
  strawHat: 0xecd08c,
  strawBand: 0x4a2e18,
  silverMetal: 0xbdc3c7,
  darkEyeglasses: 0x2c3e50,
  darkShoes: 0x1a1a1a,
  whiteSneaker: 0xf0f3f4,
  caneWood: 0x5c3d2e,
  hardHatYellow: 0xf39c12,
};

// Material cache
const MAT_CACHE = new Map();
function getMat(colorHex, emissiveHex = 0) {
  const key = `${colorHex}_${emissiveHex}`;
  if (!MAT_CACHE.has(key)) {
    MAT_CACHE.set(
      key,
      new THREE.MeshLambertMaterial({
        color: colorHex,
        flatShading: true,
        ...(emissiveHex ? { emissive: emissiveHex, emissiveIntensity: 0.2 } : {}),
      })
    );
  }
  return MAT_CACHE.get(key);
}

// ── Shared Geometries ───────────────────────────────────────────────────
const GEO = {
  // Head & Face
  head: new THREE.BoxGeometry(0.08, 0.08, 0.08),
  eye: new THREE.BoxGeometry(0.015, 0.015, 0.01),
  glassesFrame: new THREE.BoxGeometry(0.026, 0.022, 0.012),
  glassesBridge: new THREE.BoxGeometry(0.02, 0.008, 0.01),
  mustache: new THREE.BoxGeometry(0.045, 0.014, 0.015),

  // Hair styles
  hairTop: new THREE.BoxGeometry(0.086, 0.025, 0.086),
  hairBack: new THREE.BoxGeometry(0.086, 0.06, 0.025),
  hairSide: new THREE.BoxGeometry(0.015, 0.055, 0.08),
  ponytail: new THREE.BoxGeometry(0.03, 0.065, 0.03),
  bun: new THREE.BoxGeometry(0.035, 0.035, 0.035),

  // Hats
  capCrown: new THREE.BoxGeometry(0.088, 0.028, 0.088),
  capVisor: new THREE.BoxGeometry(0.084, 0.01, 0.035),
  capBand: new THREE.BoxGeometry(0.09, 0.01, 0.09),
  hardHatDome: new THREE.BoxGeometry(0.092, 0.035, 0.092),
  hardHatBrim: new THREE.BoxGeometry(0.102, 0.01, 0.102),
  beanieDome: new THREE.BoxGeometry(0.088, 0.045, 0.088),
  beanieCuff: new THREE.BoxGeometry(0.092, 0.018, 0.092),
  fedoraBrim: new THREE.BoxGeometry(0.12, 0.008, 0.12),
  fedoraCrown: new THREE.BoxGeometry(0.075, 0.035, 0.075),
  fedoraRibbon: new THREE.BoxGeometry(0.078, 0.01, 0.078),
  safariBrim: new THREE.BoxGeometry(0.13, 0.008, 0.13),
  flatCapTop: new THREE.BoxGeometry(0.092, 0.024, 0.098),
  flatCapBill: new THREE.BoxGeometry(0.08, 0.008, 0.028),

  // Headphones
  headphoneBand: new THREE.BoxGeometry(0.095, 0.01, 0.025),
  headphoneCup: new THREE.BoxGeometry(0.02, 0.038, 0.038),

  // Torso & Outerwear
  torso: new THREE.BoxGeometry(0.1, 0.11, 0.065),
  torsoSkirt: new THREE.BoxGeometry(0.104, 0.045, 0.07),
  trenchLower: new THREE.BoxGeometry(0.105, 0.065, 0.07),
  collar: new THREE.BoxGeometry(0.045, 0.02, 0.01),
  tie: new THREE.BoxGeometry(0.018, 0.06, 0.01),
  highvisStripe: new THREE.BoxGeometry(0.102, 0.015, 0.068),
  hoodiePocket: new THREE.BoxGeometry(0.065, 0.035, 0.012),

  // Limbs
  leg: new THREE.BoxGeometry(0.038, 0.085, 0.038),
  shoe: new THREE.BoxGeometry(0.04, 0.025, 0.05),
  arm: new THREE.BoxGeometry(0.03, 0.08, 0.03),
  hand: new THREE.BoxGeometry(0.026, 0.022, 0.026),

  // Props & Bags
  backpack: new THREE.BoxGeometry(0.08, 0.095, 0.045),
  backpackPocket: new THREE.BoxGeometry(0.065, 0.04, 0.02),
  briefcase: new THREE.BoxGeometry(0.025, 0.055, 0.075),
  briefcaseHandle: new THREE.BoxGeometry(0.015, 0.015, 0.03),
  suitcase: new THREE.BoxGeometry(0.035, 0.075, 0.09),
  rollingSuitcase: new THREE.BoxGeometry(0.055, 0.11, 0.075),
  rollingHandle: new THREE.BoxGeometry(0.01, 0.08, 0.03),
  shoulderBag: new THREE.BoxGeometry(0.03, 0.055, 0.06),
  crossStrap: new THREE.BoxGeometry(0.11, 0.012, 0.07),
  walkingCane: new THREE.CylinderGeometry(0.007, 0.007, 0.22, 5),
  caneHandle: new THREE.BoxGeometry(0.015, 0.015, 0.045),
  wrench: new THREE.BoxGeometry(0.012, 0.08, 0.025),
  wrenchHead: new THREE.BoxGeometry(0.014, 0.025, 0.038),
};

// ── 21 Archetype Presets ───────────────────────────────────────────────
export const PEDESTRIAN_TYPES = [
  'conductor_blue',
  'businessman',
  'trench_coat',
  'mechanic_yellow',
  'backpacker_green',
  'tourist_hawaiian',
  'beanie_puffer',
  'casual_girl',
  'conductor_black',
  'construction_worker',
  'elderly_gentleman',
  'backpacker_red',
  'conductor_female',
  'office_commuter',
  'traveler_purple',
  'mechanic_grey',
  'beanie_green',
  'headphones_girl',
  'safari_hiker',
  'hoodie_guy',
  'tweed_gentleman',
];

export function getRandomPedestrianType() {
  return PEDESTRIAN_TYPES[Math.floor(Math.random() * PEDESTRIAN_TYPES.length)];
}

/**
 * Procedural Pedestrian Factory
 * Height: ~0.32 units. Pivot at base (y=0), faces +Z.
 */
export function createPedestrian(type = 'conductor_blue') {
  const root = new THREE.Group();
  root.name = `pedestrian_${type}`;

  // Animation hooks for walk cycle
  const animNodes = {
    legL: null,
    legR: null,
    armL: null,
    armR: null,
    body: null,
  };

  // ── Character Configuration per Archetype ──
  const cfg = getPedestrianConfig(type);

  // ── 1. Left & Right Legs (Pivots at hip y = 0.105) ──
  const makeLeg = (isLeft) => {
    const hipPivot = new THREE.Group();
    const xPos = isLeft ? -0.024 : 0.024;
    hipPivot.position.set(xPos, 0.105, 0);

    // Upper/Lower leg mesh
    if (cfg.shorts) {
      // Shorts upper + bare skin lower
      const shortsUpper = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        getMat(cfg.pantsColor)
      );
      shortsUpper.position.set(0, -0.02, 0);
      hipPivot.add(shortsUpper);

      const bareLower = new THREE.Mesh(
        new THREE.BoxGeometry(0.034, 0.045, 0.034),
        getMat(cfg.skinColor)
      );
      bareLower.position.set(0, -0.06, 0);
      hipPivot.add(bareLower);
    } else if (cfg.skirt) {
      // Bare legs under skirt
      const legMesh = new THREE.Mesh(GEO.leg, getMat(cfg.skinColor));
      legMesh.position.set(0, -0.045, 0);
      hipPivot.add(legMesh);
    } else {
      // Regular trousers / pants
      const legMesh = new THREE.Mesh(GEO.leg, getMat(cfg.pantsColor));
      legMesh.position.set(0, -0.045, 0);
      hipPivot.add(legMesh);
    }

    // Shoe at bottom
    const shoeMesh = new THREE.Mesh(GEO.shoe, getMat(cfg.shoeColor));
    shoeMesh.position.set(0, -0.093, 0.006);
    hipPivot.add(shoeMesh);

    // Sneaker white sole accent if sneaker
    if (cfg.isSneaker) {
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.008, 0.054),
        getMat(COLOR_PALETTE.whiteSneaker)
      );
      sole.position.set(0, -0.101, 0.006);
      hipPivot.add(sole);
    }

    return hipPivot;
  };

  const legL = makeLeg(true);
  const legR = makeLeg(false);
  root.add(legL);
  root.add(legR);
  animNodes.legL = legL;
  animNodes.legR = legR;

  // ── 2. Torso & Body Details (Center y = 0.165) ──
  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0, 0.165, 0);
  root.add(bodyGroup);
  animNodes.body = bodyGroup;

  // Main Torso Mesh
  const torsoMesh = new THREE.Mesh(GEO.torso, getMat(cfg.shirtColor));
  bodyGroup.add(torsoMesh);

  // Skirt extension if applicable
  if (cfg.skirt) {
    const skirtMesh = new THREE.Mesh(GEO.torsoSkirt, getMat(cfg.pantsColor || cfg.shirtColor));
    skirtMesh.position.set(0, -0.04, 0);
    bodyGroup.add(skirtMesh);
  }

  // Trench coat lower hem
  if (cfg.isTrench) {
    const trenchHem = new THREE.Mesh(GEO.trenchLower, getMat(cfg.shirtColor));
    trenchHem.position.set(0, -0.045, 0);
    bodyGroup.add(trenchHem);
  }

  // Tie / Scarf / Collar
  if (cfg.hasTie) {
    // White shirt collar V
    const collar = new THREE.Mesh(GEO.collar, getMat(COLOR_PALETTE.whiteTop));
    collar.position.set(0, 0.042, 0.029);
    bodyGroup.add(collar);

    // Crimson tie
    const tie = new THREE.Mesh(GEO.tie, getMat(cfg.tieColor || COLOR_PALETTE.crimsonTie));
    tie.position.set(0, 0.015, 0.034);
    bodyGroup.add(tie);
  }

  // Gold buttons on conductor jackets
  if (cfg.goldButtons) {
    for (let by = -0.02; by <= 0.03; by += 0.025) {
      const btn = new THREE.Mesh(
        new THREE.BoxGeometry(0.008, 0.008, 0.004),
        getMat(COLOR_PALETTE.goldTrim)
      );
      btn.position.set(0, by, 0.033);
      bodyGroup.add(btn);
    }
  }

  // High-vis safety vest stripes
  if (cfg.isHighVis) {
    const vestMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.104, 0.112, 0.068),
      getMat(COLOR_PALETTE.highvisOrange)
    );
    bodyGroup.add(vestMesh);

    const stripeUpper = new THREE.Mesh(GEO.highvisStripe, getMat(COLOR_PALETTE.silverReflective));
    stripeUpper.position.set(0, 0.02, 0);
    bodyGroup.add(stripeUpper);

    const stripeLower = new THREE.Mesh(GEO.highvisStripe, getMat(COLOR_PALETTE.silverReflective));
    stripeLower.position.set(0, -0.025, 0);
    bodyGroup.add(stripeLower);
  }

  // Overalls bib & straps
  if (cfg.isOveralls) {
    const bib = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.07, 0.068),
      getMat(COLOR_PALETTE.royalBlueOveralls)
    );
    bib.position.set(0, -0.02, 0);
    bodyGroup.add(bib);

    // Overalls shoulder straps
    [-0.032, 0.032].forEach((sx) => {
      const strap = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.112, 0.069),
        getMat(COLOR_PALETTE.royalBlueOveralls)
      );
      strap.position.set(sx, 0, 0);
      bodyGroup.add(strap);

      // Silver buckle
      const buckle = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.01, 0.004),
        getMat(COLOR_PALETTE.silverMetal)
      );
      buckle.position.set(sx, 0.015, 0.035);
      bodyGroup.add(buckle);
    });
  }

  // Hoodie front pouch pocket
  if (cfg.hasPouch) {
    const pouch = new THREE.Mesh(GEO.hoodiePocket, getMat(cfg.shirtColor));
    pouch.position.set(0, -0.025, 0.034);
    bodyGroup.add(pouch);
  }

  // Hawaiian floral pattern micro dots
  if (cfg.isHawaiian) {
    const flowerMats = [getMat(COLOR_PALETTE.yellowShirt), getMat(COLOR_PALETTE.whiteTop)];
    const flowerOffsets = [
      [-0.03, 0.02, 0.033],
      [0.025, 0.03, 0.033],
      [-0.015, -0.02, 0.033],
      [0.03, -0.025, 0.033],
      [-0.03, 0.01, -0.033],
      [0.02, -0.01, -0.033],
    ];
    flowerOffsets.forEach(([fx, fy, fz], idx) => {
      const dot = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, 0.004),
        flowerMats[idx % flowerMats.length]
      );
      dot.position.set(fx, fy, fz);
      bodyGroup.add(dot);
    });
  }

  // Backpack on back (-Z)
  if (cfg.hasBackpack) {
    const bpGroup = new THREE.Group();
    bpGroup.position.set(0, 0.005, -0.045);

    const bpMain = new THREE.Mesh(GEO.backpack, getMat(cfg.backpackColor || COLOR_PALETTE.oliveBackpack));
    bpGroup.add(bpMain);

    const bpPocket = new THREE.Mesh(GEO.backpackPocket, getMat(cfg.backpackPocketColor || cfg.backpackColor || COLOR_PALETTE.oliveBackpack));
    bpPocket.position.set(0, -0.02, -0.025);
    bpGroup.add(bpPocket);

    // Top bedroll / flap
    const bpRoll = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.02, 0.035),
      getMat(cfg.backpackPocketColor || COLOR_PALETTE.darkGrey)
    );
    bpRoll.position.set(0, 0.05, 0);
    bpGroup.add(bpRoll);

    bodyGroup.add(bpGroup);
  }

  // Crossbody bag / messenger bag
  if (cfg.hasCrossbodyBag) {
    // Diagonal strap across torso
    const strap = new THREE.Mesh(GEO.crossStrap, getMat(cfg.bagColor || COLOR_PALETTE.brownLeather));
    strap.rotation.z = Math.PI / 4;
    bodyGroup.add(strap);

    // Bag pouch at side hip
    const pouch = new THREE.Mesh(GEO.shoulderBag, getMat(cfg.bagColor || COLOR_PALETTE.brownLeather));
    pouch.position.set(0.062, -0.04, 0);
    bodyGroup.add(pouch);
  }

  // ── 3. Arms (Pivots at shoulder y = 0.205, x = ±0.062) ──
  const makeArm = (isLeft) => {
    const shoulderPivot = new THREE.Group();
    const xPos = isLeft ? -0.062 : 0.062;
    shoulderPivot.position.set(xPos, 0.205, 0);

    // Sleeve (top part)
    const sleeveGeo = new THREE.BoxGeometry(0.03, 0.055, 0.03);
    const sleeveMesh = new THREE.Mesh(sleeveGeo, getMat(cfg.sleeveColor || cfg.shirtColor));
    sleeveMesh.position.set(0, -0.028, 0);
    shoulderPivot.add(sleeveMesh);

    // Lower arm (bare skin or long sleeve)
    const lowerColor = cfg.shortSleeves ? cfg.skinColor : (cfg.sleeveColor || cfg.shirtColor);
    const lowerGeo = new THREE.BoxGeometry(0.026, 0.03, 0.026);
    const lowerMesh = new THREE.Mesh(lowerGeo, getMat(lowerColor));
    lowerMesh.position.set(0, -0.06, 0);
    shoulderPivot.add(lowerMesh);

    // Hand (bare skin)
    const handMesh = new THREE.Mesh(GEO.hand, getMat(cfg.skinColor));
    handMesh.position.set(0, -0.08, 0);
    shoulderPivot.add(handMesh);

    return shoulderPivot;
  };

  const armL = makeArm(true);
  const armR = makeArm(false);
  root.add(armL);
  root.add(armR);
  animNodes.armL = armL;
  animNodes.armR = armR;

  // ── 4. Held Items / Attachments ──
  if (cfg.heldItem === 'briefcase') {
    const bcGroup = new THREE.Group();
    bcGroup.position.set(0, -0.09, 0);
    const bcMesh = new THREE.Mesh(GEO.briefcase, getMat(COLOR_PALETTE.brownLeather));
    bcGroup.add(bcMesh);
    const handle = new THREE.Mesh(GEO.briefcaseHandle, getMat(COLOR_PALETTE.darkShoes));
    handle.position.set(0, 0.035, 0);
    bcGroup.add(handle);
    armR.add(bcGroup);
  } else if (cfg.heldItem === 'suitcase') {
    const scGroup = new THREE.Group();
    scGroup.position.set(0, -0.09, 0);
    const scMesh = new THREE.Mesh(GEO.suitcase, getMat(COLOR_PALETTE.warmBrown));
    scGroup.add(scMesh);
    const handle = new THREE.Mesh(GEO.briefcaseHandle, getMat(COLOR_PALETTE.darkShoes));
    handle.position.set(0, 0.045, 0);
    scGroup.add(handle);
    armR.add(scGroup);
  } else if (cfg.heldItem === 'rolling_suitcase') {
    const rollGroup = new THREE.Group();
    rollGroup.position.set(0.09, 0.065, -0.06);
    const rollMesh = new THREE.Mesh(GEO.rollingSuitcase, getMat(COLOR_PALETTE.purpleHoodie));
    rollGroup.add(rollMesh);

    const handle = new THREE.Mesh(GEO.rollingHandle, getMat(COLOR_PALETTE.silverMetal));
    handle.position.set(0, 0.06, 0);
    rollGroup.add(handle);

    // Wheels at bottom
    [-0.02, 0.02].forEach((wx) => {
      const wheel = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.015, 0.015),
        getMat(COLOR_PALETTE.darkShoes)
      );
      wheel.position.set(wx, -0.06, 0);
      rollGroup.add(wheel);
    });
    root.add(rollGroup);
  } else if (cfg.heldItem === 'cane') {
    const caneGroup = new THREE.Group();
    caneGroup.position.set(0.005, -0.11, 0.04);
    const shaft = new THREE.Mesh(GEO.walkingCane, getMat(COLOR_PALETTE.caneWood));
    caneGroup.add(shaft);
    const handle = new THREE.Mesh(GEO.caneHandle, getMat(COLOR_PALETTE.caneWood));
    handle.position.set(0, 0.11, 0.015);
    caneGroup.add(handle);
    armR.add(caneGroup);
  } else if (cfg.heldItem === 'wrench') {
    const wrenchGroup = new THREE.Group();
    wrenchGroup.position.set(0, -0.08, 0.02);
    wrenchGroup.rotation.x = Math.PI / 3;
    const wrenchShaft = new THREE.Mesh(GEO.wrench, getMat(COLOR_PALETTE.silverMetal));
    wrenchGroup.add(wrenchShaft);
    const wrenchHead = new THREE.Mesh(GEO.wrenchHead, getMat(COLOR_PALETTE.silverMetal));
    wrenchHead.position.set(0, 0.045, 0);
    wrenchGroup.add(wrenchHead);
    armR.add(wrenchGroup);
  }

  // ── 5. Head, Face & Hair / Headwear (Center y = 0.265) ──
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.265, 0);
  root.add(headGroup);

  // Skull / Skin Face
  const headMesh = new THREE.Mesh(GEO.head, getMat(cfg.skinColor));
  headGroup.add(headMesh);

  // Eyes (+Z face)
  [-0.022, 0.022].forEach((ex) => {
    const eye = new THREE.Mesh(GEO.eye, getMat(COLOR_PALETTE.darkShoes));
    eye.position.set(ex, 0.004, 0.041);
    headGroup.add(eye);
  });

  // Eyeglasses
  if (cfg.hasGlasses) {
    [-0.022, 0.022].forEach((gx) => {
      const frame = new THREE.Mesh(GEO.glassesFrame, getMat(COLOR_PALETTE.darkEyeglasses));
      frame.position.set(gx, 0.004, 0.042);
      headGroup.add(frame);
    });
    const bridge = new THREE.Mesh(GEO.glassesBridge, getMat(COLOR_PALETTE.darkEyeglasses));
    bridge.position.set(0, 0.006, 0.042);
    headGroup.add(bridge);
  }

  // Mustache
  if (cfg.hasMustache) {
    const stache = new THREE.Mesh(GEO.mustache, getMat(cfg.hairColor || COLOR_PALETTE.hairGrey));
    stache.position.set(0, -0.016, 0.042);
    headGroup.add(stache);
  }

  // Hair Base Mesh (Top, Back, Sides)
  if (!cfg.isBald) {
    const hairTop = new THREE.Mesh(GEO.hairTop, getMat(cfg.hairColor));
    hairTop.position.set(0, 0.038, 0);
    headGroup.add(hairTop);

    const hairBack = new THREE.Mesh(GEO.hairBack, getMat(cfg.hairColor));
    hairBack.position.set(0, 0.01, -0.038);
    headGroup.add(hairBack);

    [-0.038, 0.038].forEach((hx) => {
      const hairSide = new THREE.Mesh(GEO.hairSide, getMat(cfg.hairColor));
      hairSide.position.set(hx, 0.012, 0);
      headGroup.add(hairSide);
    });
  } else {
    // Balding elderly: hair only on sides & back
    const hairBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.086, 0.035, 0.02),
      getMat(cfg.hairColor)
    );
    hairBack.position.set(0, -0.01, -0.038);
    headGroup.add(hairBack);

    [-0.038, 0.038].forEach((hx) => {
      const hairSide = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.035, 0.06),
        getMat(cfg.hairColor)
      );
      hairSide.position.set(hx, -0.01, 0);
      headGroup.add(hairSide);
    });
  }

  // Ponytail attachment
  if (cfg.hasPonytail) {
    const pony = new THREE.Mesh(GEO.ponytail, getMat(cfg.hairColor));
    pony.position.set(0, -0.015, -0.055);
    pony.rotation.x = Math.PI / 12;
    headGroup.add(pony);
  }

  // ── 6. Hats & Headwear ──
  if (cfg.hat === 'conductor_cap') {
    const capCrown = new THREE.Mesh(GEO.capCrown, getMat(cfg.hatColor || COLOR_PALETTE.navyUniform));
    capCrown.position.set(0, 0.048, 0);
    headGroup.add(capCrown);

    const capBand = new THREE.Mesh(GEO.capBand, getMat(COLOR_PALETTE.goldTrim));
    capBand.position.set(0, 0.036, 0);
    headGroup.add(capBand);

    const capVisor = new THREE.Mesh(GEO.capVisor, getMat(COLOR_PALETTE.darkShoes));
    capVisor.position.set(0, 0.032, 0.048);
    capVisor.rotation.x = Math.PI / 10;
    headGroup.add(capVisor);
  } else if (cfg.hat === 'hardhat') {
    const dome = new THREE.Mesh(GEO.hardHatDome, getMat(COLOR_PALETTE.hardHatYellow));
    dome.position.set(0, 0.052, 0);
    headGroup.add(dome);

    const brim = new THREE.Mesh(GEO.hardHatBrim, getMat(COLOR_PALETTE.hardHatYellow));
    brim.position.set(0, 0.036, 0);
    headGroup.add(brim);
  } else if (cfg.hat === 'beanie') {
    const cuff = new THREE.Mesh(GEO.beanieCuff, getMat(cfg.hatColor || COLOR_PALETTE.redBeanie));
    cuff.position.set(0, 0.038, 0);
    headGroup.add(cuff);

    const dome = new THREE.Mesh(GEO.beanieDome, getMat(cfg.hatColor || COLOR_PALETTE.redBeanie));
    dome.position.set(0, 0.058, 0);
    headGroup.add(dome);
  } else if (cfg.hat === 'fedora') {
    const brim = new THREE.Mesh(GEO.fedoraBrim, getMat(COLOR_PALETTE.strawHat));
    brim.position.set(0, 0.04, 0);
    headGroup.add(brim);

    const crown = new THREE.Mesh(GEO.fedoraCrown, getMat(COLOR_PALETTE.strawHat));
    crown.position.set(0, 0.058, 0);
    headGroup.add(crown);

    const ribbon = new THREE.Mesh(GEO.fedoraRibbon, getMat(COLOR_PALETTE.strawBand));
    ribbon.position.set(0, 0.044, 0);
    headGroup.add(ribbon);
  } else if (cfg.hat === 'safari') {
    const brim = new THREE.Mesh(GEO.safariBrim, getMat(COLOR_PALETTE.strawHat));
    brim.position.set(0, 0.038, 0);
    headGroup.add(brim);

    const crown = new THREE.Mesh(GEO.fedoraCrown, getMat(COLOR_PALETTE.strawHat));
    crown.position.set(0, 0.056, 0);
    headGroup.add(crown);
  } else if (cfg.hat === 'flat_cap') {
    const capTop = new THREE.Mesh(GEO.flatCapTop, getMat(cfg.hatColor || COLOR_PALETTE.tweedBrown));
    capTop.position.set(0, 0.046, 0.005);
    capTop.rotation.x = Math.PI / 18;
    headGroup.add(capTop);

    const capBill = new THREE.Mesh(GEO.flatCapBill, getMat(cfg.hatColor || COLOR_PALETTE.tweedBrown));
    capBill.position.set(0, 0.035, 0.048);
    headGroup.add(capBill);
  } else if (cfg.hat === 'work_cap') {
    const crown = new THREE.Mesh(GEO.capCrown, getMat(cfg.hatColor || COLOR_PALETTE.royalBlueOveralls));
    crown.position.set(0, 0.046, 0);
    headGroup.add(crown);

    const visor = new THREE.Mesh(GEO.capVisor, getMat(cfg.hatColor || COLOR_PALETTE.royalBlueOveralls));
    visor.position.set(0, 0.034, 0.045);
    headGroup.add(visor);
  }

  // Headphones
  if (cfg.hasHeadphones) {
    const band = new THREE.Mesh(GEO.headphoneBand, getMat(COLOR_PALETTE.whiteTop));
    band.position.set(0, 0.052, 0);
    headGroup.add(band);

    [-0.046, 0.046].forEach((hx) => {
      const cup = new THREE.Mesh(GEO.headphoneCup, getMat(COLOR_PALETTE.whiteTop));
      cup.position.set(hx, 0.008, 0);
      headGroup.add(cup);
    });
  }

  root.userData.animNodes = animNodes;
  root.userData.pedestrianType = type;

  return root;
}

/**
 * Detailed configuration for each of the 21 character archetypes
 */
function getPedestrianConfig(type) {
  const P = COLOR_PALETTE;

  switch (type) {
    case 'conductor_blue':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairDark,
        shirtColor: P.navyUniform,
        pantsColor: P.navyUniform,
        shoeColor: P.darkShoes,
        hat: 'conductor_cap',
        hatColor: P.navyUniform,
        hasTie: true,
        tieColor: P.crimsonTie,
        goldButtons: true,
      };

    case 'businessman':
      return {
        skinColor: P.skinWarm,
        hairColor: P.hairBrown,
        shirtColor: P.blackSuit,
        pantsColor: P.blackSuit,
        shoeColor: P.darkShoes,
        hasTie: true,
        tieColor: P.crimsonTie,
        heldItem: 'briefcase',
      };

    case 'trench_coat':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairBrown,
        shirtColor: P.beigeCoat,
        pantsColor: P.crimsonTie,
        shoeColor: P.brownLeather,
        isTrench: true,
        hasTie: true,
        tieColor: P.crimsonTie,
        hasCrossbodyBag: true,
        bagColor: P.crimsonTie,
      };

    case 'mechanic_yellow':
      return {
        skinColor: P.skinTan,
        hairColor: P.hairDark,
        shirtColor: P.yellowShirt,
        pantsColor: P.royalBlueOveralls,
        shoeColor: P.darkShoes,
        isOveralls: true,
        hat: 'work_cap',
        hatColor: P.royalBlueOveralls,
        heldItem: 'wrench',
      };

    case 'backpacker_green':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairBrown,
        shirtColor: P.greenHoodie,
        pantsColor: P.blueJeans,
        shoeColor: P.redJacket,
        isSneaker: true,
        hasBackpack: true,
        backpackColor: P.oliveBackpack,
        backpackPocketColor: P.darkGrey,
        hasPouch: true,
      };

    case 'tourist_hawaiian':
      return {
        skinColor: P.skinTan,
        hairColor: P.hairDark,
        shirtColor: P.tealFloral,
        pantsColor: P.tanKhaki,
        shoeColor: P.brownLeather,
        shorts: true,
        shortSleeves: true,
        isHawaiian: true,
        hat: 'fedora',
        heldItem: 'suitcase',
      };

    case 'beanie_puffer':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairDark,
        shirtColor: P.darkGrey,
        pantsColor: P.blueJeans,
        shoeColor: P.darkShoes,
        hat: 'beanie',
        hatColor: P.redBeanie,
      };

    case 'casual_girl':
      return {
        skinColor: P.skinWarm,
        hairColor: P.hairDark,
        shirtColor: P.yellowCardigan,
        pantsColor: P.darkJeans,
        shoeColor: P.brownLeather,
        skirt: true,
        hasPonytail: true,
        hasCrossbodyBag: true,
        bagColor: P.brownLeather,
      };

    case 'conductor_black':
      return {
        skinColor: P.skinWarm,
        hairColor: P.hairDark,
        shirtColor: P.darkGrey,
        pantsColor: P.darkGrey,
        shoeColor: P.darkShoes,
        hat: 'conductor_cap',
        hatColor: P.darkGrey,
        hasTie: true,
        tieColor: P.crimsonTie,
        goldButtons: true,
      };

    case 'construction_worker':
      return {
        skinColor: P.skinTan,
        hairColor: P.hairDark,
        shirtColor: P.royalBlueOveralls,
        pantsColor: P.royalBlueOveralls,
        shoeColor: P.brownLeather,
        hat: 'hardhat',
        isHighVis: true,
      };

    case 'elderly_gentleman':
      return {
        skinColor: P.skinPale,
        hairColor: P.hairGrey,
        shirtColor: P.greenHoodie,
        pantsColor: P.tweedBrown,
        shoeColor: P.brownLeather,
        isBald: true,
        hasGlasses: true,
        hasMustache: true,
        heldItem: 'cane',
      };

    case 'backpacker_red':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairDark,
        shirtColor: P.redJacket,
        pantsColor: P.darkJeans,
        shoeColor: P.darkShoes,
        hasBackpack: true,
        backpackColor: P.blackSuit,
      };

    case 'conductor_female':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairAuburn,
        shirtColor: P.navyUniform,
        pantsColor: P.navyUniform,
        shoeColor: P.darkShoes,
        skirt: true,
        hasPonytail: true,
        hat: 'conductor_cap',
        hatColor: P.navyUniform,
        hasTie: true,
        tieColor: P.crimsonTie,
        goldButtons: true,
      };

    case 'office_commuter':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairBrown,
        shirtColor: P.lightBlueShirt,
        pantsColor: P.greySlacks,
        shoeColor: P.darkShoes,
        hasTie: true,
        tieColor: P.navyUniform,
        hasGlasses: true,
        hasCrossbodyBag: true,
        bagColor: P.brownLeather,
      };

    case 'traveler_purple':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairAuburn,
        shirtColor: P.purpleHoodie,
        pantsColor: P.blueJeans,
        shoeColor: P.darkShoes,
        shorts: true,
        hasPouch: true,
        heldItem: 'rolling_suitcase',
      };

    case 'mechanic_grey':
      return {
        skinColor: P.skinTan,
        hairColor: P.hairDark,
        shirtColor: P.slateGrey,
        pantsColor: P.royalBlueOveralls,
        shoeColor: P.darkShoes,
        isOveralls: true,
        hat: 'work_cap',
        hatColor: P.royalBlueOveralls,
        heldItem: 'wrench',
      };

    case 'beanie_green':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairBrown,
        shirtColor: P.tweedBrown,
        pantsColor: P.blueJeans,
        shoeColor: P.darkShoes,
        hat: 'beanie',
        hatColor: P.greenBeanie,
      };

    case 'headphones_girl':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairDark,
        shirtColor: P.tealJacket,
        pantsColor: P.darkJeans,
        shoeColor: P.whiteSneaker,
        skirt: true,
        hasHeadphones: true,
      };

    case 'safari_hiker':
      return {
        skinColor: P.skinTan,
        hairColor: P.hairBrown,
        shirtColor: P.yellowCardigan,
        pantsColor: P.greenHoodie,
        shoeColor: P.brownLeather,
        hat: 'safari',
        hasBackpack: true,
        backpackColor: P.oliveBackpack,
      };

    case 'hoodie_guy':
      return {
        skinColor: P.skinLight,
        hairColor: P.hairBlonde,
        shirtColor: P.blueHoodie,
        pantsColor: P.darkJeans,
        shoeColor: P.redJacket,
        isSneaker: true,
        hasPouch: true,
      };

    case 'tweed_gentleman':
    default:
      return {
        skinColor: P.skinPale,
        hairColor: P.hairGrey,
        shirtColor: P.tweedBrown,
        pantsColor: P.darkGrey,
        shoeColor: P.brownLeather,
        hat: 'flat_cap',
        hatColor: P.tweedBrown,
        hasMustache: true,
        hasCrossbodyBag: true,
        bagColor: P.brownLeather,
      };
  }
}
