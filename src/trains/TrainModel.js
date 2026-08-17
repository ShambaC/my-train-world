/**
 * Engine Models Factory — procedural Three.js locomotives matching engine_sheet.png.
 */
import { createSteamEngine, getSteamEngineDimensions } from './SteamEngineModel';
import { createDieselEngine, getDieselEngineDimensions } from './DieselEngineModel';
import { createElectricEngine, getElectricEngineDimensions } from './ElectricEngineModel';
import { createCheckerEngine, getCheckerEngineDimensions } from './CheckerEngineModel';
import { ENGINE_LENGTH, ENGINE_WIDTH, ENGINE_HEIGHT } from './engineTypes';

const ENGINE_KEYS = ['steam-engine', 'diesel-engine', 'electric-engine', 'checker-engine'];
const engineTemplates = new Map();

function normalizeEngineKey(typeOrColor) {
  const key = typeof typeOrColor === 'string' ? typeOrColor.toLowerCase() : 'steam-engine';
  if (key === 'diesel' || key === 'diesel-engine') return 'diesel-engine';
  if (key === 'electric' || key === 'electric-engine') return 'electric-engine';
  if (key === 'checker' || key === 'checker-engine') return 'checker-engine';
  return 'steam-engine';
}

function buildEngine(key) {
  if (key === 'diesel-engine') return createDieselEngine();
  if (key === 'electric-engine') return createElectricEngine();
  if (key === 'checker-engine') return createCheckerEngine();
  return createSteamEngine();
}

function markSharedResources(root) {
  root.traverse((child) => {
    if (child.isMesh) child.userData.sharedTrainResource = true;
  });
  return root;
}

/**
 * Create a procedural train engine based on type
 * @param {string|number} typeOrColor - engine type key (e.g. 'steam-engine', 'diesel-engine', etc.)
 */
export function createTrainEngine(typeOrColor = 'steam-engine') {
  const key = normalizeEngineKey(typeOrColor);
  let template = engineTemplates.get(key);
  if (!template) {
    template = markSharedResources(buildEngine(key));
    engineTemplates.set(key, template);
  }
  return template.clone(true);
}

export function preloadTrainEngines() {
  for (const key of ENGINE_KEYS) {
    if (!engineTemplates.has(key)) {
      engineTemplates.set(key, markSharedResources(buildEngine(key)));
    }
  }
}

/**
 * Get train dimensions
 */
export function getTrainDimensions(type = 'steam-engine') {
  if (type === 'diesel-engine') return getDieselEngineDimensions();
  if (type === 'electric-engine') return getElectricEngineDimensions();
  if (type === 'checker-engine') return getCheckerEngineDimensions();
  return getSteamEngineDimensions();
}

export {
  createSteamEngine,
  createDieselEngine,
  createElectricEngine,
  createCheckerEngine,
  ENGINE_LENGTH,
  ENGINE_WIDTH,
  ENGINE_HEIGHT,
};

export { createPassengerCoach } from './PassengerCoachModel';
export { createCoalCart } from './CoalCartModel';
export { createGasCoach } from './GasCoachModel';
export { createGoodsCoach } from './GoodsCoachModel';
export { createContainerCoach } from './ContainerCoachModel';
export { createViewdeckCoach } from './ViewdeckCoachModel';
