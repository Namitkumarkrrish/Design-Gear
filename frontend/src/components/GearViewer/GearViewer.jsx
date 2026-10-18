
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import styles from './GearViewer.module.css';

function GearViewer({ gearType, generated }) {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#202530');

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      Math.max(mount.clientWidth, 1) /
        Math.max(mount.clientHeight, 1),
      0.01,
      100000
    );

    camera.position.set(10, 8, 12);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(
      mount.clientWidth,
      mount.clientHeight
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    mount.appendChild(renderer.domElement);

    // 4. CAD-style camera controls
    const controls = new OrbitControls(
      camera,
      renderer.domElement
    );

    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    // Allow complete rotation, including top and bottom views.
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;

    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;

    controls.zoomSpeed = 1;
    controls.panSpeed = 1;
    controls.rotateSpeed = 1;

    controls.target.set(0, 0, 0);
    controls.update();
    controls.saveState();

    // 5. Lighting
    scene.add(new THREE.AmbientLight('#ffffff', 1.5));

    const keyLight = new THREE.DirectionalLight('#ffffff', 3);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#ffffff', 2);
    fillLight.position.set(-5, 4, -6);
    scene.add(fillLight);

    const sideLight = new THREE.DirectionalLight(
      '#ffffff',
      1.5
    );
    sideLight.position.set(-6, 2, 4);
    scene.add(sideLight);

    // 6. Background grid
    const grid = new THREE.GridHelper(
      100,
      100,
      '#8a9bb5',
      '#465266'
    );
    scene.add(grid);

    // 7. Model group
    let gearGroup = null;
    let disposed = false;
    let modelLoaded = false;

    const modelMaterial = new THREE.MeshStandardMaterial({
      color: '#4682b4',
      metalness: 0.65,
      roughness: 0.3,
    });

    const modelPath =
      gearType === 'helical'
        ? '/models/helical_gear.glb'
        : '/models/spur_gear.glb';

    // Keep the camera and gear positioned around a common target.
    function frameModel(model) {
      const originalBounds = new THREE.Box3().setFromObject(model);
      const center = originalBounds.getCenter(
        new THREE.Vector3()
      );
      const originalSize = originalBounds.getSize(
        new THREE.Vector3()
      );

      const maxSize = Math.max(
        originalSize.x,
        originalSize.y,
        originalSize.z
      );

      if (!Number.isFinite(maxSize) || maxSize <= 0) {
        console.error('The loaded gear has invalid dimensions.');
        return;
      }

      // Center the model.
      model.position.sub(center);

      gearGroup = new THREE.Group();
      gearGroup.add(model);
      scene.add(gearGroup);

      // Match the orientation from the Gear-test viewer.
      gearGroup.rotation.x = -Math.PI / 2;
      gearGroup.updateMatrixWorld(true);

      const rotatedBounds = new THREE.Box3().setFromObject(
        gearGroup
      );

      // Place the model just above the grid.
      const gap = Math.max(maxSize * 0.08, 0.5);
      gearGroup.position.y = -rotatedBounds.min.y + gap;
      gearGroup.updateMatrixWorld(true);

      // Scale the grid to the model.
      grid.scale.setScalar(Math.max(maxSize / 20, 0.1));
      grid.position.set(0, 0, 0);

      // Aim the camera at the gear's center.
      const modelBounds = new THREE.Box3().setFromObject(
        gearGroup
      );
      const target = modelBounds.getCenter(
        new THREE.Vector3()
      );

      controls.target.copy(target);

      // Fit the entire model inside the viewer.
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(
        Math.tan(verticalFov / 2) * camera.aspect
      );

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

    // 8. Fallback gear if the requested GLB is unavailable.
    function createFallbackGear() {
      const group = new THREE.Group();
      const material = modelMaterial;

      const radius = 2;
      const thickness = 0.65;
      const toothCount = 24;

      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(
          radius,
          radius,
          thickness,
          96
        ),
        material
      );
      group.add(body);

      for (let i = 0; i < toothCount; i++) {
        const angle = (i / toothCount) * Math.PI * 2;

        const tooth = new THREE.Mesh(
          new THREE.BoxGeometry(0.48, thickness, 0.3),
          material
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
          new THREE.CylinderGeometry(
            0.45,
            0.45,
            thickness + 0.1,
            48
          ),
          boreMaterial
        )
      );

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.72,
          0.72,
          0.2,
          48
        ),
        material
      );

      hub.position.y = thickness / 2 + 0.08;
      group.add(hub);

      const hubBore = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.45,
          0.45,
          0.4,
          48
        ),
        boreMaterial
      );

      hubBore.position.y = hub.position.y;
      group.add(hubBore);

      return group;
    }

    // 9. Load the actual GLB model.
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

        const model = gltf.scene;

        model.traverse((child) => {
          if (!child.isMesh) return;

          child.material = modelMaterial;
          child.castShadow = true;
          child.receiveShadow = true;
        });

        frameModel(model);
      },
      undefined,
      (error) => {
        if (disposed) return;

        console.warn(
          `Could not load ${modelPath}; using the placeholder model.`,
          error
        );

        frameModel(createFallbackGear());
      }
    );

    // 10. Reset view.
    function resetView() {
      controls.reset();

      if (gearGroup && modelLoaded) {
        // Reset camera only: the gear geometry remains unchanged.
        controls.update();
      }
    }

    viewerRef.current = { resetView, controls };

    // 11. Render loop.
    let animationFrame;

    function animate() {
      animationFrame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // 12. Responsive resizing.
    const resizeObserver = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;

      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(
        mount.clientWidth,
        mount.clientHeight
      );
    });

    resizeObserver.observe(mount);

    // 13. Cleanup.
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();

      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();

        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => {
              material.dispose();
            });
          } else {
            object.material.dispose();
          }
        }
      });

      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }

      viewerRef.current = null;
    };
  }, [gearType]);

  function resetView() {
    viewerRef.current?.resetView?.();
  }

  return (
    <div className={styles.container}>
      <div className={styles.viewer} ref={mountRef} />

      <div className={styles.toolbar}>
        <div className={styles.modelInfo}>
          <span className={styles.statusDot} />

          {generated ? 'Preview generated' : 'Sample model'}

          <span className={styles.typeLabel}>
            {gearType === 'spur' ? 'Spur' : 'Helical'}
          </span>
        </div>

        <div className={styles.controls}>
          <button type="button" onClick={resetView}>
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

export default GearViewer;
