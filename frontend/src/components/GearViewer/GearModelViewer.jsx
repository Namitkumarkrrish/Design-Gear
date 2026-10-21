
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import styles from './GearViewer.module.css';

import {
  createGearScene,
  resizeGearScene,
  disposeGearScene,
} from './viewerUtils/gearScene';

import {
  loadGearModel,
  prepareGearModel,
  identifyGearNodes,
  disposeObject,
} from './viewerUtils/gearModel';

import {
  getVisibleBounds,
  frameGearView,
  setGearView,
} from './viewerUtils/gearViewUtils';

const VIEW_MODES = {
  assembly: 'Assembly',
  pinion: 'Pinion Only',
  gear: 'Gear Only',
};

function GearModelViewer({
  gearType = 'spur',
  generated = false,
  modelUrl = null,
}) {
  const mountRef = useRef(null);
  const viewerRef = useRef(null);
  const viewModeRef = useRef('assembly');

  const [viewMode, setViewMode] = useState('assembly');

  const resetView = useCallback(() => {
    viewerRef.current?.resetView?.();
  }, []);

  // Keep the current mode available to resize and reset callbacks.
  useEffect(() => {
    viewModeRef.current = viewMode;
    viewerRef.current?.setViewMode?.(viewMode);
  }, [viewMode]);

  // Return to Assembly when a different gear model is requested.
  useEffect(() => {
    setViewMode('assembly');
  }, [gearType, modelUrl]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const viewer = createGearScene(mount);
    const { scene, camera, renderer, controls, grid } = viewer;

    let disposed = false;
    let animationFrame = null;
    let modelLoaded = false;
    let cancelModelLoad = null;

    let assemblyRoot = null;
    let isolatedRoot = null;
    let isolatedPinions = [];
    let isolatedGears = [];

    function fitCurrentView(mode = viewModeRef.current) {
      if (!modelLoaded) return;

      const root =
        mode === 'assembly' ? assemblyRoot : isolatedRoot;

      frameGearView({
        bounds: getVisibleBounds(root),
        camera,
        controls,
        grid,
      });
    }

    function applyCurrentView(mode) {
      if (!modelLoaded || !assemblyRoot) return;

      setGearView({
        mode,
        assemblyRoot,
        isolatedRoot,
        isolatedPinions,
        isolatedGears,
        camera,
        controls,
        grid,
      });
    }

    function createIsolatedCopy(sourceModel, isFallback = false) {
      const isolatedModel = sourceModel.clone(true);

      isolatedRoot = new THREE.Group();
      isolatedRoot.add(isolatedModel);
      scene.add(isolatedRoot);

      // Match the orientation of the assembly.
      isolatedRoot.rotation.x = -Math.PI / 2;
      isolatedRoot.updateMatrixWorld(true);

      // Centre the copied model horizontally.
      const bounds = new THREE.Box3().setFromObject(isolatedRoot);

      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());

        isolatedRoot.position.x -= center.x;
        isolatedRoot.position.z -= center.z;
        isolatedRoot.updateMatrixWorld(true);

        // Place the bottom of the copy above the ground plane.
        const updatedBounds = new THREE.Box3().setFromObject(
          isolatedRoot
        );

        isolatedRoot.position.y = -updatedBounds.min.y + 0.02;
      }

      isolatedRoot.updateMatrixWorld(true);

      // Store the initial position to prevent movement accumulating
      // when switching between Pinion Only and Gear Only.
      isolatedRoot.userData.basePosition =
        isolatedRoot.position.clone();

      const nodes = identifyGearNodes(isolatedModel);

      isolatedPinions = nodes.pinions;
      isolatedGears = nodes.gears;

      // A fallback is one illustrative gear, not a gear pair.
      if (isFallback && isolatedPinions.length === 0) {
        isolatedPinions = [isolatedModel];
        isolatedGears = [];
      }
    }

    function handleModelLoaded({ model, isFallback = false }) {
      if (disposed) {
        disposeObject(model);
        return;
      }

      try {
        model.traverse((object) => {
          if (!object.isMesh) return;

          object.castShadow = true;
          object.receiveShadow = true;
        });

        assemblyRoot = new THREE.Group();
        scene.add(assemblyRoot);

        prepareGearModel(model, assemblyRoot);
        createIsolatedCopy(model, isFallback);

        modelLoaded = true;

        // Start with the full assembly visible.
        assemblyRoot.visible = true;
        isolatedRoot.visible = false;

        fitCurrentView('assembly');
      } catch (error) {
        console.error('Could not prepare gear model:', error);
      }
    }

    cancelModelLoad = loadGearModel({
      gearType,
      modelUrl,
      onLoad: handleModelLoaded,
      onError: (error) => {
        if (!disposed) {
          console.error('Gear model loading failed:', error);
        }
      },
    });

    function resetCamera() {
      if (!modelLoaded) {
        controls.reset();
        return;
      }

      fitCurrentView(viewModeRef.current);
    }

    viewerRef.current = {
      resetView: resetCamera,
      setViewMode: applyCurrentView,
    };

    // Resize the renderer when its container changes size.
    const resizeObserver = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;

      resizeGearScene(camera, renderer, mount);

      if (modelLoaded) {
        fitCurrentView(viewModeRef.current);
      }
    });

    resizeObserver.observe(mount);

    // Render loop.
    function animate() {
      if (disposed) return;

      animationFrame = requestAnimationFrame(animate);

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    return () => {
      disposed = true;

      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }

      cancelModelLoad?.();
      resizeObserver.disconnect();

      disposeGearScene({
        scene,
        renderer,
        controls,
        mount,
      });

      viewerRef.current = null;
    };
  }, [gearType, modelUrl]);

  return (
    <div className={styles.container}>
      <div
        className={styles.viewModes}
        aria-label="Gear viewing mode"
      >
        {Object.entries(VIEW_MODES).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={`${styles.modeButton} ${
              viewMode === mode
                ? styles.modeButtonActive
                : ''
            }`}
            aria-pressed={viewMode === mode}
            onClick={() => setViewMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.viewer} ref={mountRef} />

      <div className={styles.toolbar}>
        <div className={styles.modelInfo}>
          <span className={styles.statusDot} />

          {modelUrl
            ? 'Generated 3D model'
            : generated
              ? 'Design successful'
              : 'Sample model'}

          <span className={styles.typeLabel}>
            {gearType === 'spur' ? 'Spur' : 'Helical'}
          </span>

          <span className={styles.viewLabel}>
            {VIEW_MODES[viewMode]}
          </span>
        </div>

        <div className={styles.controls}>
          <button type="button" onClick={resetView}>
            Reset View
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        Drag to rotate · Right-drag to pan · Scroll to zoom
      </p>
    </div>
  );
}

export default GearModelViewer;
