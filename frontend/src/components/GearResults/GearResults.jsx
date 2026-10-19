
import { useState } from 'react';
import styles from './GearResults.module.css';

function GearResults({
  gearType,
  designResponse,
  loading,
  onContinue,
}) {
  const [retryValue, setRetryValue] = useState('');

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

  const result = designResponse.results;
  const checks = designResponse.checks;
  const status = designResponse.status;
  const options = designResponse.options || [];

  // Read the latest values from the backend response.
  const faceWidthFactor =
    designResponse.face_width_factor ??
    designResponse.state?.face_width_factor;

  const bhn =
    designResponse.bhn ??
    designResponse.state?.bhn;

  function format(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toFixed(2)
      : '—';
  }

  const results = [
    {
      label: 'Standard Module',
      value: format(result.module),
      unit: 'mm',
    },
    {
      label: 'Pinion Teeth',
      value: result.pinion_teeth,
      unit: '',
    },
    {
      label: 'Gear Teeth',
      value: result.gear_teeth,
      unit: '',
    },
    {
      label: 'Pinion Pitch Diameter',
      value: format(result.pinion_pitch_diameter),
      unit: 'mm',
    },
    {
      label: 'Gear Pitch Diameter',
      value: format(result.gear_pitch_diameter),
      unit: 'mm',
    },
    {
      label: 'Face Width',
      value: format(result.face_width),
      unit: 'mm',
    },
    {
      label: 'Face-Width Factor Used',
      value: format(faceWidthFactor),
      unit: '',
    },
    {
      label: 'BHN Used',
      value: format(bhn),
      unit: '',
    },
    {
      label: 'Pitch Line Velocity',
      value: format(result.velocity),
      unit: 'm/s',
    },
    {
      label: 'Tangential Force',
      value: format(result.tangential_force),
      unit: 'N',
    },
    {
      label: 'Wear Load Capacity',
      value: format(result.wear_force),
      unit: 'N',
    },
    {
      label: 'Dynamic Force',
      value: format(result.dynamic_force),
      unit: 'N',
    },
  ];

  function handleRetry(option) {
    let value = null;

    if (option.id === 1 || option.id === 2) {
      value =
        retryValue === ''
          ? Number(option.maximum)
          : Number(retryValue);

      if (
        !Number.isFinite(value) ||
        value <= option.minimum ||
        value > option.maximum
      ) {
        alert(
          `Enter a value greater than ${option.minimum} ` +
          `and at most ${option.maximum}.`
        );
        return;
      }
    }

    onContinue(option.id, value);
    setRetryValue('');
  }

  return (
    <div className={styles.resultsContent}>
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>
          GEAR CONFIGURATION
        </span>

        <h3>
          {gearType === 'spur' ? 'Spur Gear' : 'Helical Gear'}
        </h3>

        <p>
          {result.pinion_teeth} pinion teeth ·{' '}
          {result.gear_teeth} gear teeth · Module{' '}
          {result.module} mm
        </p>
      </div>

      <div className={styles.resultsGrid}>
        {results.map((item) => (
          <div className={styles.resultCard} key={item.label}>
            <span className={styles.resultLabel}>
              {item.label}
            </span>

            <div className={styles.resultValue}>
              {item.value}

              {item.unit && (
                <span className={styles.resultUnit}>
                  {item.unit}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Safety Checks</h3>

        <p>
          Bending Check:{' '}
          <strong
            style={{
              color: checks.bending_safe ? '#22c55e' : '#ef4444',
            }}
          >
            {checks.bending_safe ? 'PASSED' : 'FAILED'}
          </strong>
        </p>

        <p>
          Wear Check:{' '}
          <strong
            style={{
              color: checks.wear_safe ? '#22c55e' : '#ef4444',
            }}
          >
            {checks.wear_safe ? 'PASSED' : 'FAILED'}
          </strong>
        </p>
      </div>

      {status === 'success' && (
        <p style={{ color: '#22c55e', marginTop: '15px' }}>
          ✓ All design checks satisfied.
        </p>
      )}

      {status === 'failed' && (
        <p style={{ color: '#ef4444', marginTop: '15px' }}>
          {designResponse.message}
        </p>
      )}

      {status === 'needs_user_choice' && (
        <div style={{ marginTop: '20px' }}>
          <h3>Design Adjustment Required</h3>

          <p>{designResponse.message}</p>

          {options.map((option) => (
            <div
              key={option.id}
              style={{
                marginTop: '15px',
                padding: '15px',
                border: '1px solid #64748b',
                borderRadius: '8px',
              }}
            >
              <p>
                <strong>{option.label}</strong>
              </p>

              {(option.id === 1 || option.id === 2) && (
                <div>
                  <p>
                    Current: {option.minimum} | Maximum:{' '}
                    {option.maximum}
                  </p>

                  <input
                    type="number"
                    min={option.minimum}
                    max={option.maximum}
                    step="any"
                    value={retryValue}
                    placeholder={`Enter up to ${option.maximum}`}
                    onChange={(event) =>
                      setRetryValue(event.target.value)
                    }
                    style={{
                      width: '100%',
                      padding: '8px',
                      marginBottom: '10px',
                    }}
                  />
                </div>
              )}

              {option.id === 3 && (
                <p>
                  Next standard module: {option.next_module} mm
                </p>
              )}

              <button
                type="button"
                disabled={loading}
                onClick={() => handleRetry(option)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {loading ? 'Calculating...' : 'Apply Adjustment'}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className={styles.note}>
        Results calculated by the Python engineering backend.
        Verify the design before manufacturing.
      </p>
    </div>
  );
}

export default GearResults;
