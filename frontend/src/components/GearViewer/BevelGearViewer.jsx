
import GearModelViewer from './GearModelViewer';

function BevelGearViewer({ generated = false, modelUrl = null }) {
  return (
    <GearModelViewer
      gearType="bevel"
      generated={generated}
      modelUrl={modelUrl}
    />
  );
}

export default BevelGearViewer;
