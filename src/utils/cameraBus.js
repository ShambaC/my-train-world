/**
 * Camera command bus — tiny pub/sub so UI (outside the Canvas) can ask the
 * in-scene camera controller to focus, frame, reset or ease the view.
 * Also mirrors the live camera position/target for world saves.
 */
const state = {
  position: null,
  target: null,
  listeners: new Set(),
};

export const cameraBus = {
  /** Written every frame by CameraCommands (cheap object reuse). */
  setState(position, target) {
    state.position = position;
    state.target = target;
  },

  /** Latest camera position/target as plain {x,y,z} (for save). */
  getState() {
    if (!state.position || !state.target) return null;
    return {
      position: { x: state.position.x, y: state.position.y, z: state.position.z },
      target: { x: state.target.x, y: state.target.y, z: state.target.z },
    };
  },

  subscribe(fn) {
    state.listeners.add(fn);
    return () => state.listeners.delete(fn);
  },

  /** Commands: {type:'focus',target,distance} | {type:'ease',maxDistance}
   *  | {type:'reset',terrainSize} | {type:'frame',terrainSize} */
  emit(command) {
    for (const fn of state.listeners) {
      try {
        fn(command);
      } catch (err) {
        console.error('cameraBus listener error:', err);
      }
    }
  },
};
