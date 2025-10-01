import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Camera Controller with soft boundaries
 * Keeps camera within terrain bounds with gentle push-back
 */
export default function CameraController({ terrainSize, enabled = true }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!enabled) return;

    const boundaryPadding = 10; // Extra space beyond terrain
    const maxX = (terrainSize.length / 2) + boundaryPadding;
    const maxZ = (terrainSize.breadth / 2) + boundaryPadding;
    const minX = -(terrainSize.length / 2) - boundaryPadding;
    const minZ = -(terrainSize.breadth / 2) - boundaryPadding;

    const softBoundaryStrength = 0.1; // How hard to push back (0-1)
    const boundaryBuffer = 5; // Start pushing before hard limit

    const checkAndConstrainCamera = () => {
      let needsUpdate = false;
      const pos = camera.position;

      // Soft X boundaries
      if (pos.x > maxX - boundaryBuffer) {
        const overshoot = pos.x - (maxX - boundaryBuffer);
        pos.x -= overshoot * softBoundaryStrength;
        needsUpdate = true;
      } else if (pos.x < minX + boundaryBuffer) {
        const overshoot = (minX + boundaryBuffer) - pos.x;
        pos.x += overshoot * softBoundaryStrength;
        needsUpdate = true;
      }

      // Soft Z boundaries
      if (pos.z > maxZ - boundaryBuffer) {
        const overshoot = pos.z - (maxZ - boundaryBuffer);
        pos.z -= overshoot * softBoundaryStrength;
        needsUpdate = true;
      } else if (pos.z < minZ + boundaryBuffer) {
        const overshoot = (minZ + boundaryBuffer) - pos.z;
        pos.z += overshoot * softBoundaryStrength;
        needsUpdate = true;
      }

      // Hard boundaries (safety net)
      if (pos.x > maxX) pos.x = maxX;
      if (pos.x < minX) pos.x = minX;
      if (pos.z > maxZ) pos.z = maxZ;
      if (pos.z < minZ) pos.z = minZ;

      // Height constraints (don't let camera go underground or too high)
      if (pos.y < 5) pos.y = 5;
      if (pos.y > 150) pos.y = 150;

      return needsUpdate;
    };

    // Check boundaries periodically
    const interval = setInterval(() => {
      checkAndConstrainCamera();
    }, 50);

    return () => clearInterval(interval);
  }, [camera, terrainSize, enabled]);

  return null;
}
