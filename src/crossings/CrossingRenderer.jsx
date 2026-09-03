import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildCrossingMesh } from './crossingModels.js';

/**
 * Crossings Renderer — renders + animates all rail/road crossings.
 *
 * Crossings are rebuilt whenever the track layout or road layout changes
 * (signature poll). Per-frame gate/lamp animation is imperative.
 */
export default function CrossingRenderer({
  crossingManager,
  trackManager,
  enabled = true,
  simulationPaused = false,
  trainManager,
  roadManager,
  lighting,
}) {
  const rootRef = useRef();
  const nodesRef = useRef(new Map()); // crossingId -> THREE.Group
  const lastSigRef = useRef('');
  const enabledRef = useRef(enabled);
  const [snapshot, setSnapshot] = useState(null);
  enabledRef.current = enabled;

  // Topology poll — rebuild crossings + meshes when tracks/roads change.
  useEffect(() => {
    if (!crossingManager) return;
    const layoutSigRef = { current: '' };
    const sync = () => {
      // Rebuild only when the underlying layout changed — rebuilding every
      // poll would reset every crossing's gate state each 500ms.
      const layoutSig =
        trackManager
          .getAllTracks()
          .map((t) => t.id)
          .sort()
          .join(',') +
        '|r' +
        (roadManager?.version ?? -1);
      if (layoutSig !== layoutSigRef.current) {
        layoutSigRef.current = layoutSig;
        crossingManager.rebuild();
      }
      const crossings = crossingManager.getCrossings();
      const sig = crossings.map((c) => `${c.id}:${c.trackId}:${c.roadId}`).join(',');
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setSnapshot({ crossings: crossings.map((c) => ({ id: c.id, roadWidth: c.roadWidth })) });
      }
    };
    sync();
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [crossingManager, trackManager, roadManager]);

  // Per-frame animation.
  useFrame((state, delta) => {
    if (!enabledRef.current || !crossingManager) return;
    if (!simulationPaused) crossingManager.update(delta, trainManager);
    const nightness = lighting ? lighting.nightness : 0.6;
    const t = state.clock.elapsedTime;
    const blinking = new Set(
      crossingManager
        .getCrossings()
        .filter((c) => c.state === 'warning' || c.state === 'closing' || c.state === 'closed')
        .map((c) => c.id)
    );

    for (const crossing of crossingManager.getCrossings()) {
      const node = nodesRef.current.get(crossing.id);
      if (!node) continue;
      const ud = node.userData;
      // Crossing asset's native axis is perpendicular to road tangent.
      node.rotation.y = Math.atan2(crossing.roadTangent.x, crossing.roadTangent.z) + Math.PI / 2;

      // Gate arms: 0 = vertical (open), 1 = horizontal (closed).
      for (const a of ud.arms) {
        a.gate.rotation.x = -Math.PI / 2 * (1 - crossing.anim);
      }

      // Warning lamps: alternating flash while active, off otherwise.
      const flash = Math.sin(t * 7) > 0;
      for (let i = 0; i < ud.lamps.length; i++) {
        const [lampA, lampB] = ud.lamps[i];
        const on = blinking.has(crossing.id);
        const aLit = on && flash;
        const bLit = on && !flash;
        lampA.core.material.opacity = aLit ? 0.25 + nightness * 0.75 : 0.04 + nightness * 0.06;
        lampA.halo.material.opacity = aLit ? 0.1 + nightness * 0.26 : 0;
        lampB.core.material.opacity = bLit ? 0.25 + nightness * 0.75 : 0.04 + nightness * 0.06;
        lampB.halo.material.opacity = bLit ? 0.1 + nightness * 0.26 : 0;
      }
    }
  });

  // Remove nodes that left the topology.
  useEffect(() => {
    if (!snapshot) return;
    const ids = new Set(snapshot.crossings.map((c) => c.id));
    for (const [id, node] of nodesRef.current.entries()) {
      if (!ids.has(id)) {
        if (node.parent) node.parent.remove(node);
        nodesRef.current.delete(id);
      }
    }
  }, [snapshot]);

  return (
    <group ref={rootRef}>
      {snapshot?.crossings.map((c) => {
        if (!nodesRef.current.has(c.id)) {
          const node = buildCrossingMesh(c.roadWidth);
          nodesRef.current.set(c.id, node);
        }
        const node = nodesRef.current.get(c.id);
        const crossing = crossingManager?.getCrossings().find((x) => x.id === c.id);
        return (
          <primitive
            key={c.id}
            object={node}
            position={crossing ? [crossing.position.x, crossing.position.y, crossing.position.z] : undefined}
            rotation={crossing ? [0, Math.atan2(crossing.roadTangent.x, crossing.roadTangent.z) + Math.PI / 2, 0] : undefined}
            visible={enabled}
          />
        );
      })}
    </group>
  );
}
