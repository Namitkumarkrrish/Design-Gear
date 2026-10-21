
import GearModelViewer from './GearModelViewer';

function HelicalGearViewer({ generated = false, modelUrl = null }) {
  return (
    <GearModelViewer
      gearType="helical"
      generated={generated}
      modelUrl={modelUrl}
    />
  );
}

export default HelicalGearViewer;
