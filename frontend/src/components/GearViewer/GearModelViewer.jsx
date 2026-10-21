
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import styles from './GearViewer.module.css';

const API_BASE = 'http://127.0.0.1:8000';

function GearModelViewer({
  gearType,
  generated = false,
  modelUrl = null,
}) {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#202530');

    const camera = new THREE.PerspectiveCamera(
      45,
      Math.max(mount.clientWidth, 1) /
        Math.max(mount.clientHeight, 1),
      0.01,
      100000
    );

    camera.position.set(10, 8, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.update();
    controls.saveState();

    scene.add(new THREE.AmbientLight('#ffffff', 1.5));

    const keyLight = new THREE.DirectionalLight('#ffffff', 3);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#ffffff', 2);
    fillLight.position.set(-5, 4, -6);
    scene.add(fillLight);

    const sideLight = new THREE.DirectionalLight('#ffffff', 1.5);
    sideLight.position.set(-6, 2, 4);
    scene.add(sideLight);

    const grid = new THREE.GridHelper(100, 100, '#8a9bb5', '#465266');
    scene.add(grid);

    let gearGroup = null;
    let disposed = false;
    let modelLoaded = false;

    const modelMaterial = new THREE.MeshStandardMaterial({
      color: '#4682b4',
      metalness: 0.65,
      roughness: 0.3,
    });

    const modelPath = modelUrl
      ? modelUrl.startsWith('http')
        ? modelUrl
        : `${API_BASE}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}`
      : null;

    function frameModel(model) {
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z);

      if (!Number.isFinite(maxSize) || maxSize <= 0) {
        console.error('The loaded model has invalid dimensions.');
        return;
      }

      model.position.sub(center);

      gearGroup = new THREE.Group();
      gearGroup.add(model);
      scene.add(gearGroup);

      gearGroup.rotation.x = -Math.PI / 2;
      gearGroup.updateMatrixWorld(true);

      const rotatedBounds = new THREE.Box3().setFromObject(gearGroup);
      gearGroup.position.y = -rotatedBounds.min.y + Math.max(maxSize * 0.08, 0.5);
      gearGroup.updateMatrixWorld(true);

      grid.scale.setScalar(Math.max(maxSize / 20, 0.1));
      grid.position.set(0, 0, 0);

      const finalBounds = new THREE.Box3().setFromObject(gearGroup);
      const target = finalBounds.getCenter(new THREE.Vector3());
      controls.target.copy(target);

      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov =
        2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);

      const limitingFov = Math.min(verticalFov, horizontalFov);
      const distance = Math.max(
        (maxSize * 0.65) / Math.tan(limitingFov / 2),
        maxSize * 2,
        5
      );

      camera.position.set(
        target.x + distance * 0.8,
        target.y + distance * 0.5,
        target.z + distance
      );

      camera.near = Math.max(maxSize / 1000, 0.01);
      camera.far = Math.max(maxSize * 100, 1000);
      camera.updateProjectionMatrix();

      controls.minDistance = Math.max(maxSize * 0.25, 0.1);
      controls.maxDistance = Math.max(maxSize * 100, 100);
      controls.update();
      controls.saveState();

      modelLoaded = true;
    }

    function createSpurFallback() {
      const group = new THREE.Group();
      const radius = 2;
      const thickness = 0.65;
      const toothCount = 24;

      group.add(
        new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, thickness, 96),
          modelMaterial
        )
      );

      for (let i = 0; i < toothCount; i++) {
        const angle = (i / toothCount) * Math.PI * 2;
        const tooth = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, thickness, 0.3),
          modelMaterial
        );

        tooth.position.set(
          Math.cos(angle) * (radius + 0.12),
          0,
          Math.sin(angle) * (radius + 0.12)
        );

        tooth.rotation.y = -angle;
        group.add(tooth);
      }

      const boreMaterial = new THREE.MeshStandardMaterial({
        color: '#202530',
        metalness: 0.3,
        roughness: 0.8,
      });

      group.add(
        new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, thickness + 0.1, 48),
          boreMaterial
        )
      );

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 0.2, 48),
        modelMaterial
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

    if (modelPath) {
      const loader = new GLTFLoader();

      loader.load(
        modelPath,
        (gltf) => {
          if (disposed) {
            gltf.scene.traverse((object) => {
              if (object.geometry) object.geometry.dispose();
            });
            return;
          }

          gltf.scene.traverse((child) => {
            if (!child.isMesh) return;

            if (!child.material) {
              child.material = modelMaterial;
            }

            child.castShadow = true;
            child.receiveShadow = true;
          });

          frameModel(gltf.scene);
        },
        undefined,
        (error) => {
          if (disposed) return;

          console.error(`Could not load model: ${modelPath}`, error);

          // Never display a fake spur gear in place of a helical model.
          if (gearType === 'spur') {
            frameModel(createSpurFallback());
          }
        }
      );
    }

    function resetView() {
      controls.reset();
      if (gearGroup && modelLoaded) controls.update();
    }

    viewerRef.current = { resetView };

    let animationFrame;

    function animate() {
      if (disposed) return;

      animationFrame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;

      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    });

    resizeObserver.observe(mount);

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();

      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();

        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }

      viewerRef.current = null;
    };
  }, [gearType, modelUrl]);

  return (
    <div className={styles.container}>
      <div className={styles.viewer} ref={mountRef} />

      <div className={styles.toolbar}>
        <div className={styles.modelInfo}>
          <span className={styles.statusDot} />
          {modelUrl
            ? 'Generated 3D model'
            : generated
              ? 'Design successful — model unavailable'
              : 'Waiting for generated model'}

          <span className={styles.typeLabel}>
            {gearType === 'spur' ? 'Spur' : 'Helical'}
          </span>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            onClick={() => viewerRef.current?.resetView?.()}
          >
            Reset View
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        Drag to rotate freely · Right-drag to pan · Scroll to zoom
      </p>
    </div>
  );
}

export default GearModelViewer;
