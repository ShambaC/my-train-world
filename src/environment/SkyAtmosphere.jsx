import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import cloudLargeA from '../assets/art-source/painterly-diorama/cropped/style-cloud-large-a.png';
import cloudMediumA from '../assets/art-source/painterly-diorama/cropped/style-cloud-medium-a.png';
import cloudWisp from '../assets/art-source/painterly-diorama/cropped/style-cloud-wisp.png';

export const SKYBOX_TIMES = ['dawn', 'day', 'dusk', 'night'];
export const SKYBOX_COUNT = 1;
const cloudSources = [cloudLargeA, cloudMediumA, cloudWisp];
const cloudCache = new Map();
const cloudPromises = new Map();

function loadCloudTexture(source) {
  if (cloudCache.has(source)) return cloudCache.get(source);
  let texture;
  let resolveTexture;
  let rejectTexture;
  const ready = new Promise((resolve, reject) => {
    resolveTexture = resolve;
    rejectTexture = reject;
  });
  texture = new THREE.TextureLoader().load(source, () => resolveTexture(texture), undefined, rejectTexture);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  cloudCache.set(source, texture);
  cloudPromises.set(source, ready);
  return texture;
}

export function preloadSkyboxes(onProgress) {
  let loaded = 0;
  return Promise.all(cloudSources.map((source) => loadCloudTexture(source) && cloudPromises.get(source).then(() => {
    loaded += 1;
    onProgress?.(loaded / cloudSources.length);
  })));
}

const SkyShader = {
  uniforms: {
    uTop: { value: new THREE.Color(0x77b1c7) },
    uHorizon: { value: new THREE.Color(0xd7e4d1) },
    uGround: { value: new THREE.Color(0xc7d3bb) },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uGround;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y;
      float horizon = smoothstep(-0.16, 0.22, h);
      float zenith = smoothstep(0.18, 0.92, h);
      vec3 color = mix(uGround, uHorizon, horizon);
      color = mix(color, uTop, zenith);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

function createClouds(layerCount) {
  const group = new THREE.Group();
  group.userData.visualOnly = true;
  group.name = 'visualCloudLayers';
  for (let layer = 0; layer < layerCount; layer += 1) {
    const texture = loadCloudTexture(cloudSources[layer % cloudSources.length]);
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.34 - layer * 0.05,
      depthWrite: false,
      depthTest: true,
      premultipliedAlpha: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.userData.visualOnly = true;
    sprite.position.set((layer - 1) * 18, 28 + layer * 8, -70 - layer * 22);
    sprite.scale.set(70 - layer * 12, 25 - layer * 3, 1);
    sprite.renderOrder = -5 + layer;
    group.add(sprite);
  }
  return group;
}

export default function SkyAtmosphere({ timeOfDay = 'day', cloudLayers = 2, lighting }) {
  const { scene } = useThree();
  const skyMaterial = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      ...SkyShader,
      uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    material.userData.visualOnly = true;
    return material;
  }, []);
  const clouds = useMemo(() => createClouds(cloudLayers), [cloudLayers]);

  useEffect(() => {
    scene.background = new THREE.Color(0x87aabd);
    return () => {
      scene.background = null;
      skyMaterial.dispose();
      clouds.traverse((child) => child.material?.dispose());
    };
  }, [clouds, scene, skyMaterial]);

  useEffect(() => {
    skyMaterial.uniforms.uTop.value.set(lighting?.skyTop ?? 0x77b1c7);
    skyMaterial.uniforms.uHorizon.value.set(lighting?.skyHorizon ?? 0xd7e4d1);
    skyMaterial.uniforms.uGround.value.set(lighting?.skyGround ?? 0xc7d3bb);
  }, [lighting, skyMaterial, timeOfDay]);

  useFrame((state) => {
    if (lighting) {
      skyMaterial.uniforms.uTop.value.copy(lighting.skyTop);
      skyMaterial.uniforms.uHorizon.value.copy(lighting.skyHorizon);
      skyMaterial.uniforms.uGround.value.copy(lighting.skyGround);
      clouds.traverse((child) => {
        if (child.isSprite) child.material.color.copy(lighting.cloudLight);
      });
    }
    clouds.position.x = Math.sin(state.clock.elapsedTime * 0.006) * 3;
    clouds.position.z = Math.cos(state.clock.elapsedTime * 0.004) * 2;
  });

  return (
    <>
      <mesh scale={[180, 180, 180]} userData={{ visualOnly: true }} raycast={() => null}>
        <sphereGeometry args={[1, 32, 16]} />
        <primitive object={skyMaterial} attach="material" />
      </mesh>
      <primitive object={clouds} />
    </>
  );
}

export function getLightingForTime(timeOfDay) {
  const presets = {
    dawn: { ambient: { intensity: 0.68, color: 0x9db8d8 }, directional: { intensity: 1.1, color: 0xffa05a, position: [40, 14, 32] }, fog: { color: 0xffc9a3, density: 0.009 }, skyTint: 0xffc9a0, sunTint: 0xff9a56, waterDeep: 0x1f6f82, waterShallow: 0x5ba9ad, waterFoam: 0xd1ebe0, waterSand: 0xb99b68, nightness: 0.15, shadowRadius: 6 },
    day: { ambient: { intensity: 0.84, color: 0xdfeefc }, directional: { intensity: 1.45, color: 0xfff4e0, position: [50, 60, 30] }, fog: { color: 0xd4e8f7, density: 0.005 }, skyTint: 0x87ceeb, sunTint: 0xfff8e0, waterDeep: 0x145b70, waterShallow: 0x347f8d, waterFoam: 0xaed6d4, waterSand: 0x9c8354, nightness: 0, shadowRadius: 4 },
    dusk: { ambient: { intensity: 0.56, color: 0x6b6bd6 }, directional: { intensity: 1.0, color: 0xff6a2a, position: [28, 10, -38] }, fog: { color: 0xff8c6e, density: 0.01 }, skyTint: 0xff9777, sunTint: 0xff8c47, waterDeep: 0x1e5e82, waterShallow: 0x4d88ac, waterFoam: 0xc7d9dc, waterSand: 0x9f805c, nightness: 0.45, shadowRadius: 5 },
    night: { ambient: { intensity: 0.58, color: 0x41618f }, directional: { intensity: 0.4, color: 0x9fb8ff, position: [-25, 35, -20] }, fog: { color: 0x1b2745, density: 0.014 }, skyTint: 0x2b3a5f, sunTint: 0xa8c0ff, waterDeep: 0x153f66, waterShallow: 0x3f7196, waterFoam: 0x94b8db, waterSand: 0x445875, nightness: 1, shadowRadius: 2 },
  };
  return presets[timeOfDay] || presets.day;
}
