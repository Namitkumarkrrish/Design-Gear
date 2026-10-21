
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createGearScene(mount) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f1eee5');

  const width = Math.max(mount.clientWidth, 1);
  const height = Math.max(mount.clientHeight, 1);

  const camera = new THREE.PerspectiveCamera(
    45,
    width / height,
    0.01,
    100000
  );

  camera.position.set(10, 8, 12);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';

  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableRotate = true;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;

  controls.zoomSpeed = 1;
  controls.panSpeed = 1;
  controls.rotateSpeed = 1;

  controls.target.set(0, 0, 0);
  controls.update();

  // Lighting
  scene.add(
    new THREE.AmbientLight('#ffffff', 1.5)
  );

  const keyLight = new THREE.DirectionalLight(
    '#ffffff',
    3
  );
  keyLight.position.set(5, 8, 6);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(
    '#ffffff',
    2
  );
  fillLight.position.set(-5, 4, -6);
  scene.add(fillLight);

  const sideLight = new THREE.DirectionalLight(
    '#ffffff',
    1.5
  );
  sideLight.position.set(-6, 2, 4);
  scene.add(sideLight);

  // Engineering grid
  const grid = new THREE.GridHelper(
    100,
    100,
    '#c8bda9',
    '#e1dacb'
  );

  scene.add(grid);

  return {
    scene,
    camera,
    renderer,
    controls,
    grid,
  };
}

export function resizeGearScene(
  camera,
  renderer,
  mount
) {
  const width = mount.clientWidth;
  const height = mount.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

export function disposeGearScene({
  scene,
  renderer,
  controls,
  mount,
}) {
  controls?.dispose();

  scene?.traverse((object) => {
    if (object.geometry) {
      object.geometry.dispose();
    }

    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      materials.forEach((material) => {
        material.dispose();
      });
    }
  });

  renderer?.dispose();

  if (
    renderer?.domElement?.parentNode === mount
  ) {
    mount.removeChild(renderer.domElement);
  }
}
