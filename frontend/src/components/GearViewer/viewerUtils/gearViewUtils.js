
import * as THREE from 'three';

const VIEW_MODES = ['assembly', 'pinion', 'gear'];

const GROUND_OFFSET = 0.02;

/**
 * Checks whether an object and all its ancestors are visible.
 */
function isEffectivelyVisible(object, root) {
  let current = object;

  while (current) {
    if (!current.visible) return false;
    if (current === root) return true;
    current = current.parent;
  }

  return false;
}

/**
 * Finds the bounding box of visible meshes, accounting for
 * visibility inherited from parent objects.
 */
export function getVisibleBounds(root) {
  if (!root) return null;

  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3();
  let foundMesh = false;

  root.traverse((object) => {
    if (!object.isMesh) return;
    if (!isEffectivelyVisible(object, root)) return;
    if (!object.geometry) return;

    if (!object.geometry.boundingBox) {
      object.geometry.computeBoundingBox();
    }

    if (!object.geometry.boundingBox) return;

    const meshBounds = object.geometry.boundingBox
      .clone()
      .applyMatrix4(object.matrixWorld);

    bounds.union(meshBounds);
    foundMesh = true;
  });

  return foundMesh ? bounds : null;
}

/**
 * Frames the camera around the supplied bounds.
 */
export function frameGearView({
  bounds,
  camera,
  controls,
  grid,
}) {
  if (!bounds || bounds.isEmpty() || !camera || !controls) {
    return;
  }

  const target = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(maxSize) || maxSize <= 0) return;

  const aspect = Math.max(camera.aspect || 1, 0.01);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);

  const horizontalFov =
    2 * Math.atan(
      Math.tan(verticalFov / 2) * aspect
    );

  const limitingFov = Math.min(verticalFov, horizontalFov);

  const distance = Math.max(
    (maxSize * 0.75) / Math.tan(limitingFov / 2),
    maxSize * 2,
    5
  );

  // Preserve the original viewing angle.
  const direction = new THREE.Vector3(0.8, 0.5, 1).normalize();

  camera.position
    .copy(target)
    .addScaledVector(direction, distance);

  controls.target.copy(target);

  camera.near = Math.max(maxSize / 1000, 0.01);
  camera.far = Math.max(maxSize * 100, 1000);
  camera.updateProjectionMatrix();

  controls.minDistance = Math.max(maxSize * 0.25, 0.1);
  controls.maxDistance = Math.max(maxSize * 100, 100);

  if (grid) {
    grid.scale.setScalar(Math.max(maxSize / 20, 0.1));
    grid.position.set(0, 0, 0);
  }

  controls.update();
  controls.saveState();
}

/**
 * Switches between Assembly, Pinion Only and Gear Only.
 *
 * The original assembly remains untouched in isolated modes.
 * The isolated copy is repositioned from its saved base position.
 */
export function setGearView({
  mode,
  assemblyRoot,
  isolatedRoot,
  isolatedPinions = [],
  isolatedGears = [],
  camera,
  controls,
  grid,
}) {
  if (!VIEW_MODES.includes(mode)) {
    console.warn(`Unknown gear view mode: ${mode}`);
    return;
  }

  if (!assemblyRoot) return;

  if (mode === 'assembly') {
    assemblyRoot.visible = true;

    if (isolatedRoot) {
      isolatedRoot.visible = false;
    }

    frameGearView({
      bounds: getVisibleBounds(assemblyRoot),
      camera,
      controls,
      grid,
    });

    return;
  }

  if (!isolatedRoot) return;

  const selectedNodes =
    mode === 'pinion' ? isolatedPinions : isolatedGears;

  const hiddenNodes =
    mode === 'pinion' ? isolatedGears : isolatedPinions;

  // If the requested component is missing, restore and reframe
  // the assembly so the camera doesn't remain on a stale view.
  if (selectedNodes.length === 0) {
    console.warn(`No nodes found for "${mode}" view.`);

    assemblyRoot.visible = true;
    isolatedRoot.visible = false;

    frameGearView({
      bounds: getVisibleBounds(assemblyRoot),
      camera,
      controls,
      grid,
    });

    return;
  }

  assemblyRoot.visible = false;
  isolatedRoot.visible = true;

  // Restore both component groups before applying the selection.
  isolatedPinions.forEach((node) => {
    node.visible = true;
  });

  isolatedGears.forEach((node) => {
    node.visible = true;
  });

  hiddenNodes.forEach((node) => {
    node.visible = false;
  });

  centreSelectedGear(isolatedRoot, selectedNodes);

  frameGearView({
    bounds: getVisibleBounds(isolatedRoot),
    camera,
    controls,
    grid,
  });
}

/**
 * Centres the selected component horizontally and places its bottom
 * above the grid. Always starts from the saved base position to prevent
 * offsets from accumulating when the user switches view modes.
 */
export function centreSelectedGear(root, selectedNodes) {
  if (!root || !selectedNodes?.length) return;

  // Save a baseline if the caller hasn't supplied one.
  if (!root.userData.basePosition) {
    root.userData.basePosition = root.position.clone();
  }

  const basePosition = root.userData.basePosition;

  // Reset every axis before recalculating the selected component's pose.
  root.position.copy(basePosition);
  root.updateMatrixWorld(true);

  const selectedBounds = new THREE.Box3();

  selectedNodes.forEach((node) => {
    const nodeBounds = new THREE.Box3().setFromObject(node);

    if (!nodeBounds.isEmpty()) {
      selectedBounds.union(nodeBounds);
    }
  });

  if (selectedBounds.isEmpty()) return;

  const center = selectedBounds.getCenter(new THREE.Vector3());

  // Centre the selected gear on the horizontal plane.
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);

  // Recalculate bounds after horizontal movement.
  const finalBounds = getVisibleBounds(root);

  if (!finalBounds) return;

  // Place the bottom at a fixed offset above the ground plane.
  root.position.y += GROUND_OFFSET - finalBounds.min.y;
  root.updateMatrixWorld(true);
}
