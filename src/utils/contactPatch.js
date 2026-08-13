import * as THREE from 'three';

/**
 * Cheap fake contact shadow: a dark circle that sits slightly above the
 * ground under trains, coaches and station platforms. Blends the object
 * into the terrain without expensive per-prop shadow casting.
 */
export function createContactPatch(radius = 0.3, opacity = 0.3, y = 0.012) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 18),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = 1;
  return mesh;
}
