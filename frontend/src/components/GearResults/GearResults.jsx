
import { calculateGearGeometry } from '../../utils/gearCalculations';
import styles from './GearResults.module.css';

function GearResults({ gearType, gearData, generated }) {
  if (!generated) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>⚙</span>
        <h3>No design generated yet</h3>
        <p>
          Enter your gear parameters and click Generate Gear
          to view the design results.
        </p>
      </div>
    );
  }

  const result = calculateGearGeometry(gearType, gearData);

  if (!result.success) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>!</span>
        <h3>Check your inputs</h3>
        {Object.values(result.errors).map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    );
  }

  const { geometry, transmission } = result;

  const format = (value) =>
    Number.isFinite(value) ? value.toFixed(2) : '—';

  const results = [
    {
      label: 'Pitch Diameter',
      value: format(geometry.pitchDiameter),
      unit: 'mm',
    },
    {
      label: 'Addendum Diameter',
      value: format(geometry.addendumDiameter),
      unit: 'mm',
    },
    {
      label: 'Dedendum Diameter',
      value: format(geometry.dedendumDiameter),
      unit: 'mm',
    },
    {
      label: 'Base Diameter',
      value: format(geometry.baseDiameter),
      unit: 'mm',
    },
    {
      label: 'Speed Ratio',
      value: format(transmission.speedRatio),
      unit: '',
    },
    {
      label: 'Input Torque',
      value: format(transmission.inputTorque),
      unit: 'N·m',
    },
  ];

  const teeth = Number(gearData.teeth);
  const module = Number(gearData.module);
  const helixAngle = Number(gearData.helixAngle || 0);

  return (
    <div className={styles.resultsContent}>
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>GEAR CONFIGURATION</span>
        <h3>{gearType === 'spur' ? 'Spur Gear' : 'Helical Gear'}</h3>
        <p>
          {teeth} teeth · Module {module} mm
          {gearType === 'helical' ? ` · Helix ${helixAngle}°` : ''}
        </p>
      </div>

      <div className={styles.resultsGrid}>
        {results.map((item) => (
          <div className={styles.resultCard} key={item.label}>
            <span className={styles.resultLabel}>{item.label}</span>
            <div className={styles.resultValue}>
              {item.value}
              {item.unit && (
                <span className={styles.resultUnit}>{item.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className={styles.note}>{result.notice}</p>
    </div>
  );
}

export default GearResults;
