import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildSignalMesh } from './signalModels.js';

/**
 * Signals Renderer — renders all lineside signals (user + auto).
 *
 * React reconciles only when the signal topology changes (polled).
 * Per-frame lamp states are applied imperatively to cached groups.
 */
export default function SignalsRenderer({ signalManager, trainManager, lighting, enabled = true }) {
  const rootRef = useRef();
  const nodesRef = useRef(new Map()); // signalId -> THREE.Group
  const lastSigRef = useRef('');
  const enabledRef = useRef(enabled);
  const [snapshot, setSnapshot] = useState(null);
  enabledRef.current = enabled;

  // Topology poll — rebuild when signals appear/disappear.
  useEffect(() => {
    if (!signalManager) return;
    const sync = () => {
      const sigs = signalManager.getSignals();
      const sig = sigs.map((s) => `${s.id}:${s.type}`).join(',');
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setSnapshot({ signals: sigs.map((s) => ({ id: s.id, type: s.type })) });
      }
    };
    sync();
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [signalManager]);

  // Per-frame state + lamp animation.
  useFrame((_, delta) => {
    if (!enabledRef.current || !signalManager) return;
    signalManager.update(trainManager, delta);
    const nightness = lighting ? lighting.nightness : 0.6;

    for (const sig of signalManager.getSignals()) {
      const node = nodesRef.current.get(sig.id);
      if (!node) continue;
      const lamps = node.userData.signalLamps || [];
      for (const lamp of lamps) {
        const lit = lamp.key === sig.litLamp;
        if (lamp.lit !== lit) lamp.lit = lit;
        // Day: lit lamps stay faintly readable; night: full glow.
        lamp.core.material.opacity = lit ? 0.3 + nightness * 0.7 : 0.05 + nightness * 0.04;
        lamp.halo.material.opacity = lit ? 0.12 + nightness * 0.3 : 0;
      }
    }
  });

  // Remove nodes that left the topology.
  useEffect(() => {
    if (!snapshot) return;
    const ids = new Set(snapshot.signals.map((s) => s.id));
    for (const [id, node] of nodesRef.current.entries()) {
      if (!ids.has(id)) {
        if (node.parent) node.parent.remove(node);
        nodesRef.current.delete(id);
      }
    }
  }, [snapshot]);

  return (
    <group ref={rootRef}>
      {snapshot?.signals.map((sig) => {
        if (!nodesRef.current.has(sig.id)) {
          const node = buildSignalMesh(sig.type);
          nodesRef.current.set(sig.id, node);
        }
        const node = nodesRef.current.get(sig.id);
        const signal = signalManager?.getSignals().find((s) => s.id === sig.id);
        return (
          <primitive
            key={sig.id}
            object={node}
            position={signal ? [signal.position.x, signal.position.y, signal.position.z] : undefined}
            rotation={signal ? [0, signal.rotation, 0] : undefined}
            visible={enabled}
          />
        );
      })}
    </group>
  );
}
