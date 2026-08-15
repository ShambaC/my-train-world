/**
 * Procedural Voxel Vehicle Models matching reference sheet
 * (src/assets/ModelImages/vehicles_sheet.png)
 *
 * Archetypes:
 * 1. Compact Sedan / Hatchback Cars (Red, Blue, Yellow, Green, White, Black)
 * 2. Box Delivery Trucks (White, Blue with arrow, Yellow with arrow)
 * 3. City Transit Buses (Red #07, Blue #12, Green #24)
 * 4. Pickup Trucks (Orange, Blue, Beige)
 * 5. Utility Flatbed Trucks with wooden rail sides (Teal, Yellow, Green)
 * 6. Vintage Motor Scooters (Cream, Red)
 * 7. City Bicycles with front wicker basket (Blue, Yellow, Green)
 *
 * All models face local +X (front = +X, rear = -X, sides = ±Z).
 * Headlamp glow meshes are tagged with userData.headlamp = true.
 */
import * as THREE from 'three';

// ── Shared Palette ──────────────────────────────────────────────────────
const COLOR_PALETTE = {
  // Vehicle Body Colors
  redCar: 0xb82828,
  blueCar: 0x2270b6,
  yellowCar: 0xe5b824,
  greenCar: 0x438a3e,
  whiteCar: 0xf0f0f0,
  blackCar: 0x202020,

  truckWhite: 0xe8e8e8,
  truckBlue: 0x1e6091,
  truckYellow: 0xe6a117,
  truckCabBlue: 0x184e77,
  truckCabYellow: 0xd98218,

  busRed: 0xb82828,
  busBlue: 0x2270b6,
  busGreen: 0x438a3e,
  busRoof: 0x34495e,

  pickupOrange: 0xd35400,
  pickupBlue: 0x2980b9,
  pickupBeige: 0xd5c4a1,

  flatbedTeal: 0x16a085,
  flatbedYellow: 0xd4ac0d,
  flatbedGreen: 0x588157,
  woodRail: 0x785338,
  woodBed: 0x5c3d28,

  scooterCream: 0xedd8b4,
  scooterRed: 0xc0392b,
  scooterSeat: 0x3d271d,

  bikeBlue: 0x2980b9,
  bikeYellow: 0xf1c40f,
  bikeGreen: 0x27ae60,
  wickerBasket: 0x8d6e63,

  // Common Trim & Hardware
  bumperDark: 0x212529,
  bumperGrey: 0x495057,
  grilleDark: 0x1a1a1a,
  windowGlass: 0x141e28,
  windowFrame: 0x1c1c1c,
  tireBlack: 0x181818,
  rimSilver: 0x8a959e,
  plateWhite: 0xf8f9fa,
  taillightRed: 0xd90429,
  indicatorAmber: 0xf39c12,
  graphicWhite: 0xffffff,
  routeLedDark: 0x111111,
  routeLedAmber: 0xffaa00,
};

// Material cache
const MAT_CACHE = new Map();
function getMat(colorHex, isGlowing = false) {
  const key = `${colorHex}_${isGlowing ? 1 : 0}`;
  if (!MAT_CACHE.has(key)) {
    MAT_CACHE.set(
      key,
      new THREE.MeshLambertMaterial({
        color: colorHex,
        flatShading: true,
        ...(isGlowing
          ? {
              emissive: colorHex,
              emissiveIntensity: 0.8,
            }
          : {}),
      })
    );
  }
  return MAT_CACHE.get(key);
}

// Headlamp shared material with night-glow support
const HEADLAMP_MAT = new THREE.MeshBasicMaterial({
  color: 0xfff2c0,
  transparent: true,
  opacity: 0.1,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
HEADLAMP_MAT.userData = { nightGlow: true, baseOpacity: 0.85 };

// ── Shared Geometries ───────────────────────────────────────────────────
const GEO = {
  // Wheels
  wheelTire: new THREE.CylinderGeometry(0.046, 0.046, 0.024, 10),
  wheelRim: new THREE.CylinderGeometry(0.028, 0.028, 0.026, 8),
  truckWheelTire: new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10),
  truckWheelRim: new THREE.CylinderGeometry(0.032, 0.032, 0.032, 8),
  scooterWheel: new THREE.CylinderGeometry(0.035, 0.035, 0.018, 8),
  bikeWheel: new THREE.CylinderGeometry(0.055, 0.055, 0.012, 10),

  // Lights & Plates
  headlampLens: new THREE.BoxGeometry(0.012, 0.024, 0.028),
  headlampRound: new THREE.SphereGeometry(0.02, 6, 6),
  taillight: new THREE.BoxGeometry(0.01, 0.02, 0.026),
  licensePlate: new THREE.BoxGeometry(0.008, 0.02, 0.045),

  // Common Bumpers
  carBumperFront: new THREE.BoxGeometry(0.03, 0.035, 0.19),
  carBumperRear: new THREE.BoxGeometry(0.03, 0.035, 0.19),
  grilleMesh: new THREE.BoxGeometry(0.01, 0.03, 0.12),
};

// ── Vehicle Variant Definitions ─────────────────────────────────────────
export const VEHICLE_VARIANTS = {
  car: ['car_red', 'car_blue', 'car_yellow', 'car_green', 'car_white', 'car_black'],
  truck: ['truck_white', 'truck_blue_arrow', 'truck_yellow_arrow'],
  bus: ['bus_red_07', 'bus_blue_12', 'bus_green_24'],
  pickup: ['pickup_orange', 'pickup_blue', 'pickup_beige'],
  cart: ['flatbed_teal', 'flatbed_yellow', 'flatbed_green'],
  scooter: ['scooter_cream', 'scooter_red'],
  bike: ['bike_blue', 'bike_yellow', 'bike_green'],
};

export const HEADLAMP_X = {
  car: 0.19,
  truck: 0.22,
  bus: 0.28,
  pickup: 0.20,
  cart: 0.18,
  scooter: 0.13,
  bike: 0.12,
};

export function getRandomVehicleVariant(type) {
  const list = VEHICLE_VARIANTS[type] || VEHICLE_VARIANTS.car;
  return list[Math.floor(Math.random() * list.length)];
}

// ── Helper: Attach Wheels ──
function attachCarWheels(group, x1, x2, z1, z2, isTruck = false) {
  const tireGeo = isTruck ? GEO.truckWheelTire : GEO.wheelTire;
  const rimGeo = isTruck ? GEO.truckWheelRim : GEO.wheelRim;
  const tireMat = getMat(COLOR_PALETTE.tireBlack);
  const rimMat = getMat(COLOR_PALETTE.rimSilver);
  const yPos = isTruck ? 0.052 : 0.046;

  for (const x of [x1, x2]) {
    for (const z of [z1, z2]) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, yPos, z);

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.x = Math.PI / 2;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      wheelGroup.add(rim);

      group.add(wheelGroup);
    }
  }
}

// ── Helper: Attach Headlamps & Taillights ──
function attachVehicleLights(group, frontX, rearX, zOffset, lampY = 0.12, isRound = false) {
  for (const z of [-zOffset, zOffset]) {
    // Front glowing headlamp
    const lamp = new THREE.Mesh(
      isRound ? GEO.headlampRound : GEO.headlampLens,
      HEADLAMP_MAT
    );
    lamp.position.set(frontX, lampY, z);
    lamp.userData.headlamp = true;
    group.add(lamp);

    // Rear taillight
    if (rearX !== null) {
      const tail = new THREE.Mesh(GEO.taillight, getMat(COLOR_PALETTE.taillightRed, true));
      tail.position.set(rearX, lampY, z);
      group.add(tail);
    }
  }

  // Front & Rear license plates
  const frontPlate = new THREE.Mesh(GEO.licensePlate, getMat(COLOR_PALETTE.plateWhite));
  frontPlate.position.set(frontX + 0.002, lampY - 0.03, 0);
  group.add(frontPlate);

  if (rearX !== null) {
    const rearPlate = new THREE.Mesh(GEO.licensePlate, getMat(COLOR_PALETTE.plateWhite));
    rearPlate.position.set(rearX - 0.002, lampY - 0.03, 0);
    group.add(rearPlate);
  }
}

// ── 1. Compact Sedan / Hatchback Car Builder ─────────────────────────────
function buildCar(variant = 'car_red') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const colorMap = {
    car_red: P.redCar,
    car_blue: P.blueCar,
    car_yellow: P.yellowCar,
    car_green: P.greenCar,
    car_white: P.whiteCar,
    car_black: P.blackCar,
  };
  const bodyColor = colorMap[variant] || P.redCar;
  const bodyMat = getMat(bodyColor);
  const darkMat = getMat(P.bumperDark);
  const glassMat = getMat(P.windowGlass);

  // Lower chassis & bumpers
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.18), darkMat);
  chassis.position.set(0, 0.065, 0);
  g.add(chassis);

  // Lower Main Body (fenders, hood, trunk)
  const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(0.37, 0.07, 0.19), bodyMat);
  bodyLower.position.set(0, 0.115, 0);
  g.add(bodyLower);

  // Front Hood & Grille
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.18), bodyMat);
  hood.position.set(0.12, 0.145, 0);
  g.add(hood);

  const grille = new THREE.Mesh(GEO.grilleMesh, getMat(P.grilleDark));
  grille.position.set(0.186, 0.115, 0);
  g.add(grille);

  // Cabin / Greenhouse (windshield, roof, side windows)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.08, 0.165), bodyMat);
  cabin.position.set(-0.035, 0.18, 0);
  g.add(cabin);

  // Front Windshield (slanted glass)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.065, 0.155), glassMat);
  windshield.position.set(0.062, 0.175, 0);
  windshield.rotation.z = -Math.PI / 10;
  g.add(windshield);

  // Rear Window (slanted glass)
  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.065, 0.155), glassMat);
  rearWindow.position.set(-0.132, 0.175, 0);
  rearWindow.rotation.z = Math.PI / 10;
  g.add(rearWindow);

  // Side Windows (left & right)
  [-0.084, 0.084].forEach((zSide) => {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.055, 0.01), glassMat);
    sideGlass.position.set(-0.035, 0.18, zSide);
    g.add(sideGlass);

    // Center B-pillar
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.055, 0.012), bodyMat);
    pillar.position.set(-0.035, 0.18, zSide);
    g.add(pillar);
  });

  // Roof cap
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.165), bodyMat);
  roof.position.set(-0.035, 0.222, 0);
  g.add(roof);

  // Wheels
  attachCarWheels(g, -0.11, 0.11, -0.092, 0.092);

  // Lights & Plates
  attachVehicleLights(g, 0.186, -0.186, 0.065, 0.115);

  return g;
}

// ── 2. Box Delivery Truck Builder ────────────────────────────────────────
function buildTruck(variant = 'truck_white') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const isBlue = variant === 'truck_blue_arrow';
  const isYellow = variant === 'truck_yellow_arrow';

  const cabColor = isBlue ? P.truckCabBlue : isYellow ? P.truckCabYellow : P.truckWhite;
  const boxColor = isBlue ? P.truckBlue : isYellow ? P.truckYellow : P.truckWhite;

  const cabMat = getMat(cabColor);
  const boxMat = getMat(boxColor);
  const darkMat = getMat(P.bumperDark);
  const glassMat = getMat(P.windowGlass);

  // Heavy truck chassis frame
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.17), darkMat);
  chassis.position.set(0, 0.065, 0);
  g.add(chassis);

  // Front Cab (y: 0.09 to 0.26)
  const cabLower = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.10, 0.18), cabMat);
  cabLower.position.set(0.13, 0.13, 0);
  g.add(cabLower);

  const cabUpper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.175), cabMat);
  cabUpper.position.set(0.12, 0.21, 0);
  g.add(cabUpper);

  // Front Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.155), glassMat);
  windshield.position.set(0.182, 0.21, 0);
  g.add(windshield);

  // Cab Side Windows
  [-0.089, 0.089].forEach((zSide) => {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.055, 0.01), glassMat);
    sideGlass.position.set(0.125, 0.215, zSide);
    g.add(sideGlass);

    // Side mirror
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.015), darkMat);
    mirror.position.set(0.17, 0.20, zSide + (zSide > 0 ? 0.012 : -0.012));
    g.add(mirror);
  });

  // Front Grille & Bumper
  const grille = new THREE.Mesh(GEO.grilleMesh, getMat(P.grilleDark));
  grille.position.set(0.201, 0.13, 0);
  g.add(grille);

  // Cargo Box (Rear)
  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.20, 0.20), boxMat);
  cargoBox.position.set(-0.07, 0.18, 0);
  g.add(cargoBox);

  // Arrow graphic on box sides (+Z and -Z)
  if (isBlue || isYellow) {
    const arrowMat = getMat(P.graphicWhite);
    [-0.102, 0.102].forEach((zSide) => {
      // Shaft
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.005), arrowMat);
      shaft.position.set(-0.08, 0.18, zSide);
      g.add(shaft);

      // Arrow head pointing forward (+X)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.005), arrowMat);
      head.position.set(-0.01, 0.18, zSide);
      g.add(head);
    });
  }

  // Cargo Box Rear Door line
  const doorLine = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.18, 0.005),
    getMat(P.bumperDark)
  );
  doorLine.position.set(-0.206, 0.18, 0);
  g.add(doorLine);

  // Wheels
  attachCarWheels(g, -0.13, 0.13, -0.095, 0.095, true);

  // Lights & Plates
  attachVehicleLights(g, 0.202, -0.206, 0.07, 0.11);

  return g;
}

// ── 3. City Transit Bus Builder ──────────────────────────────────────────
function buildBus(variant = 'bus_red_07') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const isBlue = variant === 'bus_blue_12';
  const isGreen = variant === 'bus_green_24';
  const busColor = isBlue ? P.busBlue : isGreen ? P.busGreen : P.busRed;

  const bodyMat = getMat(busColor);
  const darkMat = getMat(P.bumperDark);
  const glassMat = getMat(P.windowGlass);
  const ledMat = getMat(P.routeLedAmber, true);

  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.19), darkMat);
  chassis.position.set(0, 0.065, 0);
  g.add(chassis);

  // Lower Body skirt
  const lowerSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.205), bodyMat);
  lowerSkirt.position.set(0, 0.12, 0);
  g.add(lowerSkirt);

  // Upper Body / Pillars & Roof
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.205), bodyMat);
  roof.position.set(0, 0.24, 0);
  g.add(roof);

  // Front Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.08, 0.18), glassMat);
  windshield.position.set(0.276, 0.185, 0);
  g.add(windshield);

  // Destination Route Display Screen (Front + Rear)
  const routeBox = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.028, 0.12), getMat(P.routeLedDark));
  routeBox.position.set(0.276, 0.235, 0);
  g.add(routeBox);

  // LED Route Number box
  const ledNum = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.05), ledMat);
  ledNum.position.set(0.276, 0.235, 0);
  g.add(ledNum);

  // Rear Window & Destination screen
  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.07, 0.17), glassMat);
  rearWindow.position.set(-0.276, 0.19, 0);
  g.add(rearWindow);

  // Side Panoramic Windows & Doors
  [-0.103, 0.103].forEach((zSide) => {
    // Side glass band
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.01), glassMat);
    sideGlass.position.set(0, 0.19, zSide);
    g.add(sideGlass);

    // Pillars dividing windows
    for (let px = -0.16; px <= 0.16; px += 0.08) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.072, 0.012), bodyMat);
      p.position.set(px, 0.19, zSide);
      g.add(p);
    }
  });

  // Wheels
  attachCarWheels(g, -0.17, 0.17, -0.098, 0.098, true);

  // Lights & Plates
  attachVehicleLights(g, 0.276, -0.276, 0.078, 0.11);

  return g;
}

// ── 4. Pickup Truck Builder ──────────────────────────────────────────────
function buildPickup(variant = 'pickup_orange') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const isBlue = variant === 'pickup_blue';
  const isBeige = variant === 'pickup_beige';
  const bodyColor = isBlue ? P.pickupBlue : isBeige ? P.pickupBeige : P.pickupOrange;

  const bodyMat = getMat(bodyColor);
  const darkMat = getMat(P.bumperDark);
  const glassMat = getMat(P.windowGlass);

  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.18), darkMat);
  chassis.position.set(0, 0.065, 0);
  g.add(chassis);

  // Lower Body
  const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.07, 0.19), bodyMat);
  bodyLower.position.set(0, 0.12, 0);
  g.add(bodyLower);

  // Front Hood & Grille
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.18), bodyMat);
  hood.position.set(0.13, 0.155, 0);
  g.add(hood);

  const grille = new THREE.Mesh(GEO.grilleMesh, getMat(P.grilleDark));
  grille.position.set(0.196, 0.12, 0);
  g.add(grille);

  // Front Cab (Windshield, Roof, Windows)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.17), bodyMat);
  cab.position.set(0.015, 0.185, 0);
  g.add(cab);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.065, 0.155), glassMat);
  windshield.position.set(0.09, 0.185, 0);
  windshield.rotation.z = -Math.PI / 10;
  g.add(windshield);

  // Side windows
  [-0.087, 0.087].forEach((zSide) => {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.055, 0.01), glassMat);
    sideGlass.position.set(0.015, 0.185, zSide);
    g.add(sideGlass);
  });

  // Open Rear Bed (Bed floor + sidewalls + tailgate)
  const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.17), darkMat);
  bedFloor.position.set(-0.10, 0.14, 0);
  g.add(bedFloor);

  [-0.087, 0.087].forEach((zSide) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.015), bodyMat);
    wall.position.set(-0.10, 0.17, zSide);
    g.add(wall);
  });

  const tailgate = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.18), bodyMat);
  tailgate.position.set(-0.19, 0.17, 0);
  g.add(tailgate);

  // Wheels
  attachCarWheels(g, -0.11, 0.11, -0.092, 0.092);

  // Lights & Plates
  attachVehicleLights(g, 0.196, -0.196, 0.065, 0.12);

  return g;
}

// ── 5. Utility Flatbed Truck with Wood Rails Builder ────────────────────
function buildFlatbed(variant = 'flatbed_teal') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const isYellow = variant === 'flatbed_yellow';
  const isGreen = variant === 'flatbed_green';
  const cabColor = isYellow ? P.flatbedYellow : isGreen ? P.flatbedGreen : P.flatbedTeal;

  const cabMat = getMat(cabColor);
  const darkMat = getMat(P.bumperDark);
  const glassMat = getMat(P.windowGlass);
  const woodMat = getMat(P.woodRail);

  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.16), darkMat);
  chassis.position.set(0, 0.065, 0);
  g.add(chassis);

  // Compact Single Cab (Front)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 0.17), cabMat);
  cab.position.set(0.11, 0.145, 0);
  g.add(cab);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.15), glassMat);
  windshield.position.set(0.172, 0.165, 0);
  g.add(windshield);

  // Cab Side Windows
  [-0.087, 0.087].forEach((zSide) => {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.01), glassMat);
    sideGlass.position.set(0.11, 0.165, zSide);
    g.add(sideGlass);
  });

  // Flatbed Deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.02, 0.17), getMat(P.woodBed));
  deck.position.set(-0.06, 0.12, 0);
  g.add(deck);

  // Wooden slatted side rails (3 horizontal slats per side + posts)
  [-0.086, 0.086].forEach((zSide) => {
    for (let sy = 0.14; sy <= 0.18; sy += 0.02) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.01, 0.008), woodMat);
      slat.position.set(-0.06, sy, zSide);
      g.add(slat);
    }
    // Vertical corner posts
    [-0.16, 0.04].forEach((px) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.01), woodMat);
      post.position.set(px, 0.155, zSide);
      g.add(post);
    });
  });

  // Rear wooden rail gate
  for (let sy = 0.14; sy <= 0.18; sy += 0.02) {
    const rearSlat = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.17), woodMat);
    rearSlat.position.set(-0.166, sy, 0);
    g.add(rearSlat);
  }

  // Wheels
  attachCarWheels(g, -0.10, 0.10, -0.082, 0.082);

  // Lights & Plates
  attachVehicleLights(g, 0.172, -0.166, 0.06, 0.10);

  return g;
}

// ── 6. Vintage Motor Scooter Builder ─────────────────────────────────────
function buildScooter(variant = 'scooter_cream') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const isRed = variant === 'scooter_red';
  const bodyColor = isRed ? P.scooterRed : P.scooterCream;
  const bodyMat = getMat(bodyColor);
  const darkMat = getMat(P.scooterSeat);
  const chromeMat = getMat(P.rimSilver);

  // Curved Front Leg Shield
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.11), bodyMat);
  shield.position.set(0.06, 0.12, 0);
  shield.rotation.z = -Math.PI / 16;
  g.add(shield);

  // Handlebars & Stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6), chromeMat);
  stem.position.set(0.055, 0.17, 0);
  g.add(stem);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.12), chromeMat);
  bar.position.set(0.055, 0.20, 0);
  g.add(bar);

  // Center Headlamp on Handlebar
  const lamp = new THREE.Mesh(GEO.headlampRound, HEADLAMP_MAT);
  lamp.position.set(0.075, 0.195, 0);
  lamp.userData.headlamp = true;
  g.add(lamp);

  // Floorboard (Step-through)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.08), bodyMat);
  floor.position.set(0, 0.06, 0);
  g.add(floor);

  // Bulbous Rear Body & Engine Cowl
  const rearCowl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.09), bodyMat);
  rearCowl.position.set(-0.06, 0.11, 0);
  g.add(rearCowl);

  // Contoured Dual Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.07), darkMat);
  seat.position.set(-0.04, 0.165, 0);
  g.add(seat);

  // Rear Taillight
  const tail = new THREE.Mesh(GEO.taillight, getMat(P.taillightRed, true));
  tail.position.set(-0.122, 0.12, 0);
  g.add(tail);

  // Two Wheels (Front & Rear along X)
  [-0.07, 0.07].forEach((wx) => {
    const tire = new THREE.Mesh(GEO.scooterWheel, getMat(P.tireBlack));
    tire.rotation.x = Math.PI / 2;
    tire.position.set(wx, 0.038, 0);
    g.add(tire);
  });

  return g;
}

// ── 7. City Bicycle with Front Basket Builder ────────────────────────────
function buildBike(variant = 'bike_blue') {
  const g = new THREE.Group();
  const P = COLOR_PALETTE;

  const isYellow = variant === 'bike_yellow';
  const isGreen = variant === 'bike_green';
  const frameColor = isYellow ? P.bikeYellow : isGreen ? P.bikeGreen : P.bikeBlue;

  const frameMat = getMat(frameColor);
  const darkMat = getMat(P.scooterSeat);
  const chromeMat = getMat(P.rimSilver);
  const basketMat = getMat(P.wickerBasket);

  // Frame Tubes (Diamond frame)
  const topTube = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.015, 0.015), frameMat);
  topTube.position.set(0, 0.135, 0);
  g.add(topTube);

  const downTube = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.014), frameMat);
  downTube.position.set(0.01, 0.09, 0);
  downTube.rotation.z = Math.PI / 6;
  g.add(downTube);

  const seatTube = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.10, 0.014), frameMat);
  seatTube.position.set(-0.04, 0.10, 0);
  seatTube.rotation.z = -Math.PI / 14;
  g.add(seatTube);

  // Seat / Saddle
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.035), darkMat);
  saddle.position.set(-0.05, 0.155, 0);
  g.add(saddle);

  // Fork & Handlebars
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.12, 0.014), frameMat);
  fork.position.set(0.065, 0.11, 0);
  fork.rotation.z = -Math.PI / 14;
  g.add(fork);

  const handlebars = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.10), chromeMat);
  handlebars.position.set(0.06, 0.175, 0);
  g.add(handlebars);

  // Front Wicker Basket on Handlebars
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.075), basketMat);
  basket.position.set(0.09, 0.155, 0);
  g.add(basket);

  // Front Headlamp on basket
  const lamp = new THREE.Mesh(GEO.headlampRound, HEADLAMP_MAT);
  lamp.position.set(0.118, 0.145, 0);
  lamp.userData.headlamp = true;
  g.add(lamp);

  // Rear Reflector
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.015, 0.015),
    getMat(P.taillightRed, true)
  );
  tail.position.set(-0.095, 0.095, 0);
  g.add(tail);

  // Two Wheels (Front & Rear along X)
  [-0.09, 0.09].forEach((wx) => {
    const tire = new THREE.Mesh(GEO.bikeWheel, getMat(P.tireBlack));
    tire.rotation.x = Math.PI / 2;
    tire.position.set(wx, 0.055, 0);
    g.add(tire);
  });

  return g;
}

// ── Master Factory Function ─────────────────────────────────────────────
export function createVehicle(type = 'car', variant) {
  const chosenVariant = variant || getRandomVehicleVariant(type);

  let vehicle;
  switch (type) {
    case 'truck':
      vehicle = buildTruck(chosenVariant);
      break;
    case 'bus':
      vehicle = buildBus(chosenVariant);
      break;
    case 'pickup':
      vehicle = buildPickup(chosenVariant);
      break;
    case 'cart':
      vehicle = buildFlatbed(chosenVariant);
      break;
    case 'scooter':
      vehicle = buildScooter(chosenVariant);
      break;
    case 'bike':
      vehicle = buildBike(chosenVariant);
      break;
    case 'car':
    default:
      vehicle = buildCar(chosenVariant);
      break;
  }

  vehicle.name = `vehicle_${type}_${chosenVariant}`;
  vehicle.userData.type = type;
  vehicle.userData.variant = chosenVariant;
  vehicle.userData.headlampX = HEADLAMP_X[type] || 0.19;

  return vehicle;
}
