import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createPerson, createCargo, RIDE_OFFSET, RIDE_VISIBLE } from './propModels';
import { PLATFORM_HEIGHT } from '../stations/StationBuilder';

/**
 * Activity Renderer — renders ambient passengers and cargo piles.
 *
 * React only reconciles when the item topology (id set) changes. Per-frame
 * item motion is applied imperatively to cached THREE.Groups, matching the
 * TrainRenderer performance pattern.
 */
export default function ActivityRenderer({ activityManager, stationManager, trainManager, enabled }) {
  const nodesRef = useRef(new Map()); // itemId -> { group, type }
  const enabledRef = useRef(true);
  const [snapshot, setSnapshot] = useState(null);
  const lastSigRef = useRef('');
  enabledRef.current = enabled;

  // Topology poll — state updates only when the item set changes.
  useEffect(() => {
    const sync = () => {
      const items = activityManager.getAllItems();
      const sig = items.map((i) => i.id + i.state).join(',');
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setSnapshot({ items: items.map((i) => ({ id: i.id, type: i.type })) });
      }
    };
    sync();
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [activityManager]);

  // Animate imperatively — no React state involved.
  useFrame((state, delta) => {
    if (!enabledRef.current) return;
    activityManager.update(delta);

    const stations = stationManager.getAllStations();
    const stationById = new Map(stations.map((s) => [s.id, s]));

    for (const item of activityManager.getAllItems()) {
      let node = nodesRef.current.get(item.id);
      if (!node) {
        node = {
          group: new THREE.Group(),
          type: item.type,
          mesh: item.type === 'passenger' ? createPerson() : createCargo(item.type),
        };
        if (item.type === 'passenger') node.mesh.scale.setScalar(1.15);
        node.group.add(node.mesh);
        nodesRef.current.set(item.id, node);
      }
      const g = node.group;

      if (item.state === 'riding') {
        const train = trainManager.getTrain(item.trainId);
        const coach = train?.coaches?.find((c) => c.id === item.coachId);
        if (coach?.position) {
          if (RIDE_VISIBLE[item.type]) {
            const off = RIDE_OFFSET[item.type] || RIDE_OFFSET.passenger;
            const cos = Math.cos(coach.rotation);
            const sin = Math.sin(coach.rotation);
            g.position.set(
              coach.position.x + off.z * sin,
              coach.position.y + 0.1 + off.y + Math.sin(state.clock.elapsedTime * 2 + item.phase) * 0.008,
              coach.position.z + off.z * cos
            );
            g.rotation.y = coach.rotation;
          }
        }
      } else {
        const station = stationById.get(item.stationId);
        if (!station) continue;
        const perp = { x: -station.dir.z, z: station.dir.x };
        const bob =
          item.type === 'passenger'
            ? Math.sin(state.clock.elapsedTime * 1.4 + item.phase) * 0.008
            : 0;
        g.position.set(
          station.startWorld.x + station.dir.x * item.axial + perp.x * item.side,
          station.groundY + PLATFORM_HEIGHT + bob,
          station.startWorld.z + station.dir.z * item.axial + perp.z * item.side
        );
        g.rotation.y = item.yaw;
      }

      g.visible = (item.state === 'riding' && !RIDE_VISIBLE[item.type])
        ? false
        : item.scale > 0.01;
      g.scale.setScalar(Math.max(item.scale, 0.0001));
    }
  });

  // Remove + dispose groups that left the topology. Geometries/materials
  // are shared module-level caches in propModels — never dispose them.
  useEffect(() => {
    if (!snapshot) return;
    const ids = new Set(snapshot.items.map((i) => i.id));
    for (const [id, node] of nodesRef.current.entries()) {
      if (!ids.has(id)) {
        if (node.group.parent) node.group.parent.remove(node.group);
        nodesRef.current.delete(id);
      }
    }
  }, [snapshot]);

  return (
    <group>
      {snapshot?.items.map((item) => {
        const node = nodesRef.current.get(item.id);
        if (node) return <primitive key={item.id} object={node.group} />;
        return null;
      })}
    </group>
  );
}
