
import GearModelViewer from './GearModelViewer';

function SpurGearViewer({ generated = false, modelUrl = null }) {
  return (
    <GearModelViewer
      gearType="spur"
      generated={generated}
      modelUrl={modelUrl}
    />
  );
}

export default SpurGearViewer;
