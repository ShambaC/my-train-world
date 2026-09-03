import { useEffect } from 'react';
import * as THREE from 'three';

export const REVIEW_SNAPSHOTS = {
  sunny_meadow: {
    name: 'Sunny Meadow',
    position: [12, 6, 14],
    target: [0, 2, 0],
    fov: 50,
    timeOfDay: 'day',
  },
  raised_bridge_dusk: {
    name: 'Raised Bridge (Dusk)',
    position: [-16, 8, 12],
    target: [-2, 3, 0],
    fov: 45,
    timeOfDay: 'dusk',
  },
  blue_hour_station: {
    name: 'Blue Hour Station',
    position: [6, 4, 10],
    target: [0, 1.5, 0],
    fov: 45,
    timeOfDay: 'night',
  },
  dense_forest: {
    name: 'Dense Forest Edge',
    position: [18, 5, -12],
    target: [4, 2, -4],
    fov: 40,
    timeOfDay: 'day',
  },
  overview: {
    name: 'High-Angle Railway Overview',
    position: [28, 32, 28],
    target: [0, 1, 0],
    fov: 42,
    timeOfDay: 'day',
  },
  close_rail: {
    name: 'Close Rail & Consist',
    position: [3.5, 1.8, 4.0],
    target: [0, 1.2, 0],
    fov: 38,
    timeOfDay: 'day',
  },
  water_shore: {
    name: 'Water Shoreline & Bridge',
    position: [-10, 4, 16],
    target: [-1, 1, 4],
    fov: 45,
    timeOfDay: 'dawn',
  },
};

export default function VisualReviewHarness({ camera, orbitRef, setTimeOfDay, setQualityTier }) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;

    window.__mtw = window.__mtw || {};
    window.__mtw.visualReview = {
      snapshots: REVIEW_SNAPSHOTS,
      applySnapshot: (key) => {
        const snap = REVIEW_SNAPSHOTS[key];
        if (!snap) {
          console.warn(`[VisualReview] Unknown snapshot: ${key}`);
          return;
        }
        if (camera) {
          camera.position.set(...snap.position);
          if (snap.fov && camera.fov !== snap.fov) {
            camera.fov = snap.fov;
            camera.updateProjectionMatrix();
          }
        }
        if (orbitRef?.current) {
          orbitRef.current.target.set(...snap.target);
          orbitRef.current.update();
        }
        if (setTimeOfDay && snap.timeOfDay) {
          setTimeOfDay(snap.timeOfDay);
        }
        console.log(`[VisualReview] Applied snapshot: ${snap.name} (${key})`);
      },
      setTime: (time) => {
        setTimeOfDay?.(time);
      },
      setQuality: (tier) => {
        setQualityTier?.(tier);
      },
      getStats: () => {
        const gl = window.__mtw.renderer;
        if (!gl) return null;
        return {
          calls: gl.info?.render?.calls,
          triangles: gl.info?.render?.triangles,
          geometries: gl.info?.memory?.geometries,
          textures: gl.info?.memory?.textures,
          programs: gl.info?.programs?.length,
        };
      },
    };
  }, [camera, orbitRef, setTimeOfDay, setQualityTier]);

  return null;
}
