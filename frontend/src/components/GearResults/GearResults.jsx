
import styles from './GearResults.module.css';
import SpurgearResult from './SpurgearResult';
import HelicalgearResult from './HelicalgearResult';

function GearResults({ gearType, designResponse, loading, onContinue }) {
  if (!designResponse) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚙</span>
        <h3>No design generated yet</h3>
        <p>
          Enter your gear parameters and click Generate Gear
          to view the design results.
        </p>
        {loading && <p>Calculating gear design...</p>}
      </div>
    );
  }

  const props = {
    designResponse,
    loading,
    onContinue,
  };

  if (gearType === 'helical') {
    return <HelicalgearResult {...props} />;
  }

  return <SpurgearResult {...props} />;
}

export default GearResults;
