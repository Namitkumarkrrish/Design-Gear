
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const API_BASE = 'http://127.0.0.1:8000';

const MODEL_PATHS = {
  spur: '/models/spur_gear.glb',
  helical: '/models/helical_gear.glb',
};

function resolveModelUrl(gearType = 'spur', modelUrl = null) {
  const path = modelUrl || MODEL_PATHS[gearType] || MODEL_PATHS.spur;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (modelUrl) {
    return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  return path;
}

export function getModelPath(gearType = 'spur', modelUrl = null) {
  return resolveModelUrl(gearType, modelUrl);
}

export function loadGearModel({
  gearType = 'spur',
  modelUrl = null,
  onLoad,
  onError,
}) {
  const loader = new GLTFLoader();
  let cancelled = false;

  loader.load(
    getModelPath(gearType, modelUrl),
    (gltf) => {
      if (cancelled) {
        disposeObject(gltf.scene);
        return;
      }

      const model = gltf.scene;
      const { pinions, gears } = identifyGearNodes(model);

      onLoad?.({
        model,
        pinions,
        gears,
        gltf,
        isFallback: false,
      });
    },
    undefined,
    (error) => {
      if (cancelled) return;

      console.error('Could not load the gear GLB:', error);

      // Keep the viewer useful even if the default GLB is unavailable.
      const fallback = createFallbackGear();

      onLoad?.({
        model: fallback,
        pinions: [fallback],
        gears: [],
        gltf: null,
        isFallback: true,
      });

      onError?.(error);
    }
  );

  return () => {
    cancelled = true;
  };
}

function createFallbackGear() {
  const group = new THREE.Group();
  group.name = 'Pinion';

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: '#b66b42',
    metalness: 0.45,
    roughness: 0.4,
  });

  const boreMaterial = new THREE.MeshStandardMaterial({
    color: '#e1dacb',
    metalness: 0.2,
    roughness: 0.8,
  });

  const radius = 2;
  const thickness = 0.65;
  const toothCount = 24;

  group.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, thickness, 96),
      bodyMaterial
    )
  );

  for (let i = 0; i < toothCount; i++) {
    const angle = (i / toothCount) * Math.PI * 2;

    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, thickness, 0.3),
      bodyMaterial
    );

    tooth.position.set(
      Math.cos(angle) * (radius + 0.12),
      0,
      Math.sin(angle) * (radius + 0.12)
    );

    tooth.rotation.y = -angle;
    group.add(tooth);
  }

  group.add(
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, thickness + 0.1, 48),
      boreMaterial
    )
  );

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.2, 48),
    bodyMaterial
  );

  hub.position.y = thickness / 2 + 0.08;
  group.add(hub);

  const hubBore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 0.4, 48),
    boreMaterial
  );

  hubBore.position.y = hub.position.y;
  group.add(hubBore);

  return group;
}

export function prepareGearModel(model, root) {
  if (!model || !root) {
    throw new Error(
      'prepareGearModel requires both a model and a root group.'
    );
  }

  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);

  if (bounds.isEmpty()) {
    throw new Error('The loaded gear model contains no geometry.');
  }

  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(center);

  root.add(model);
  root.rotation.x = -Math.PI / 2;
  root.updateMatrixWorld(true);

  const rotatedBounds = new THREE.Box3().setFromObject(root);

  if (!rotatedBounds.isEmpty()) {
    root.position.y = -rotatedBounds.min.y + 0.02;
  }

  root.updateMatrixWorld(true);
  root.userData.basePosition = root.position.clone();

  const finalBounds = new THREE.Box3().setFromObject(root);
  const size = finalBounds.getSize(new THREE.Vector3());

  return {
    bounds: finalBounds,
    size,
    maxSize: Math.max(size.x, size.y, size.z),
  };
}

export function identifyGearNodes(model) {
  const pinions = [];
  const gears = [];

  if (!model) return { pinions, gears };

  model.traverse((child) => {
    if (!child.isMesh && !child.isGroup) return;

    const name = child.name?.trim().toLowerCase();

    if (name?.includes('gear_design_studio')) return;

    if (name === 'pinion' || name === 'helical_pinion') {
      pinions.push(child);
    } else if (name === 'gear' || name === 'helical_gear') {
      gears.push(child);
    }
  });

  return { pinions, gears };
}

export function disposeObject(object) {
  if (!object) return;

  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  object.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);

    const list = Array.isArray(child.material)
      ? child.material
      : child.material
        ? [child.material]
        : [];

    list.forEach((material) => {
      materials.add(material);

      Object.values(material).forEach((value) => {
        if (value?.isTexture) textures.add(value);
      });
    });
  });

  textures.forEach((texture) => texture.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
