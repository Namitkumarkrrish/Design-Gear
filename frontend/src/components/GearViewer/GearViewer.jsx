
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

import useFullscreen from './viewerUtils/useFullscreen';

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
  const {
    containerRef,
    isFullscreen,
    toggleFullscreen,
  } = useFullscreen();

  const mountRef = useRef(null);
  const viewerRef = useRef(null);
  const viewModeRef = useRef('assembly');

  const [viewMode, setViewMode] = useState('assembly');

  const resetView = useCallback(() => {
    viewerRef.current?.resetView?.();
  }, []);

  // Keep the active viewing mode synchronized with the 3D scene.
  useEffect(() => {
    viewModeRef.current = viewMode;
    viewerRef.current?.setViewMode?.(viewMode);
  }, [viewMode]);

  // Reset to Assembly when the requested model changes.
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

      isolatedRoot.rotation.x = -Math.PI / 2;
      isolatedRoot.updateMatrixWorld(true);

      const bounds = new THREE.Box3().setFromObject(isolatedRoot);

      if (!bounds.isEmpty()) {
        const center = bounds.getCenter(new THREE.Vector3());

        isolatedRoot.position.x -= center.x;
        isolatedRoot.position.z -= center.z;
        isolatedRoot.updateMatrixWorld(true);

        const updatedBounds = new THREE.Box3().setFromObject(
          isolatedRoot
        );

        isolatedRoot.position.y =
          -updatedBounds.min.y + 0.02;
      }

      isolatedRoot.updateMatrixWorld(true);

      isolatedRoot.userData.basePosition =
        isolatedRoot.position.clone();

      const nodes = identifyGearNodes(isolatedModel);

      isolatedPinions = nodes.pinions;
      isolatedGears = nodes.gears;

      if (isFallback && isolatedPinions.length === 0) {
        isolatedPinions = [isolatedModel];
        isolatedGears = [];
      }
    }

    function handleModelLoaded({
      model,
      isFallback = false,
    }) {
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

    // Automatically resize and reframe the model when the viewer
    // changes size, including when entering or leaving fullscreen.
    const resizeObserver = new ResizeObserver(() => {
      if (!mount.clientWidth || !mount.clientHeight) return;

      resizeGearScene(camera, renderer, mount);

      if (modelLoaded) {
        fitCurrentView(viewModeRef.current);
      }
    });

    resizeObserver.observe(mount);

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

  // Reframe the current view after fullscreen changes its dimensions.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      resetView();
    });

    return () => cancelAnimationFrame(frame);
  }, [isFullscreen, resetView]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${
        isFullscreen ? styles.fullscreenContainer : ''
      }`}
    >
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

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen
                ? 'Exit fullscreen viewer'
                : 'Expand viewer'
            }
            aria-pressed={isFullscreen}
          >
            {isFullscreen
              ? 'Exit Full Screen ⤢'
              : 'Expand ⛶'}
          </button>
        </div>
      </div>

      <p className={styles.hint}>
        Drag to rotate · Right-drag to pan · Scroll to zoom
        {isFullscreen && ' · Press Esc to exit full screen'}
      </p>
    </div>
  );
}

export default GearModelViewer;
