import * as THREE from 'three';


function cloneSnapshot(snapshot) {
  return {
    position: [...snapshot.position],
    quaternion: [...snapshot.quaternion],
    target: [...snapshot.target],
    fov: snapshot.fov,
    viewport: [...snapshot.viewport],
    dpr: snapshot.dpr,
    timeOfDay: snapshot.timeOfDay,
    graphicsQuality: snapshot.graphicsQuality,
  };
}

export function installVisualReview({ camera, controlsRef, renderer, getTimeOfDay, getGraphicsQuality, setGraphicsQuality }) {
  if (!import.meta.env.DEV) return null;
  const snapshots = new Map();
  let paused = false;
  const api = {
    snapshots,
    capture(name = 'current') {
      const controls = controlsRef.current;
      const snapshot = {
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
        target: controls?.target.toArray() ?? [0, 0, 0],
        fov: camera.fov,
        viewport: [renderer.domElement.width, renderer.domElement.height],
        dpr: renderer.getPixelRatio(),
        timeOfDay: getTimeOfDay?.(),
        graphicsQuality: getGraphicsQuality?.(),
      };
      snapshots.set(name, snapshot);
      return cloneSnapshot(snapshot);
    },
    load(name) {
      const snapshot = snapshots.get(name);
      if (!snapshot) return false;
      camera.position.fromArray(snapshot.position);
      camera.quaternion.fromArray(snapshot.quaternion);
      camera.fov = snapshot.fov;
      camera.updateProjectionMatrix();
      controlsRef.current?.target.fromArray(snapshot.target);
      controlsRef.current?.update();
      if (snapshot.graphicsQuality) setGraphicsQuality?.(snapshot.graphicsQuality);
      if (snapshot.timeOfDay) window.dispatchEvent(new CustomEvent('mtw:visual-time', { detail: snapshot.timeOfDay }));
      return true;
    },
    list() {
      return [...snapshots.keys()];
    },
    setQuality(value) {
      setGraphicsQuality?.(value);
      window.dispatchEvent(new CustomEvent('mtw:visual-quality', { detail: value }));
    },
    setTime(value) {
      window.dispatchEvent(new CustomEvent('mtw:visual-time', { detail: value }));
    },
    setPaused(value = !paused) {
      paused = Boolean(value);
      window.__mtw.visualReviewPaused = paused;
      return paused;
    },
    stats() {
      const info = renderer.info;
      return {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        viewport: [renderer.domElement.width, renderer.domElement.height],
        dpr: renderer.getPixelRatio(),
        quality: getGraphicsQuality?.(),
      };
    },
    export() {
      return Object.fromEntries([...snapshots.entries()].map(([name, snapshot]) => [name, cloneSnapshot(snapshot)]));
    },
    import(data) {
      for (const [name, snapshot] of Object.entries(data || {})) snapshots.set(name, cloneSnapshot(snapshot));
    },
  };
  window.__mtw.visualReview = api;
  window.__mtw.visualReview.THREE = THREE;
  return api;
}
