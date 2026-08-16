/**
 * Engine Models Factory — procedural Three.js locomotives matching engine_sheet.png.
 */
import { createSteamEngine, getSteamEngineDimensions } from './SteamEngineModel';
import { createDieselEngine, getDieselEngineDimensions } from './DieselEngineModel';
import { createElectricEngine, getElectricEngineDimensions } from './ElectricEngineModel';
import { createCheckerEngine, getCheckerEngineDimensions } from './CheckerEngineModel';
import { ENGINE_LENGTH, ENGINE_WIDTH, ENGINE_HEIGHT } from './engineTypes';

/**
 * Create a procedural train engine based on type
 * @param {string|number} typeOrColor - engine type key (e.g. 'steam-engine', 'diesel-engine', etc.)
 */
export function createTrainEngine(typeOrColor = 'steam-engine') {
  const key = typeof typeOrColor === 'string' ? typeOrColor.toLowerCase() : 'steam-engine';

  if (key === 'diesel-engine' || key === 'diesel') {
    return createDieselEngine();
  }
  if (key === 'electric-engine' || key === 'electric') {
    return createElectricEngine();
  }
  if (key === 'checker-engine' || key === 'checker') {
    return createCheckerEngine();
  }
  // Default to Steam Engine
  return createSteamEngine();
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
