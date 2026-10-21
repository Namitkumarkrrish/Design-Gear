
import { useState } from 'react';
import styles from './GearResults.module.css';

const MAX_BHN = 400;
const MAX_FACE_WIDTH_FACTOR = 15;
const MAX_STANDARD_MODULE = 50;

function SpurgearResult({ designResponse, loading, onContinue }) {
  const [retryValues, setRetryValues] = useState({});
  const [adjustmentMessage, setAdjustmentMessage] = useState('');

  const result = designResponse.results || {};
  const checks = designResponse.checks || {};
  const status = designResponse.status;
  const options = designResponse.options || [];

  const currentBhn = Number(result.bhn ?? designResponse.bhn);
  const currentFaceWidthFactor = Number(
    result.face_width_factor ?? designResponse.face_width_factor
  );
  const currentModule = Number(result.module ?? designResponse.module);

  const wearFailed = checks.wear_safe === false;
  const bendingFailed = checks.bending_safe === false;
  const designFailed =
    status === 'failed' || status === 'needs_user_choice';

  const bhnMaximumReached =
    designFailed &&
    wearFailed &&
    Number.isFinite(currentBhn) &&
    currentBhn >= MAX_BHN;

  const faceWidthMaximumReached =
    designFailed &&
    Number.isFinite(currentFaceWidthFactor) &&
    currentFaceWidthFactor >= MAX_FACE_WIDTH_FACTOR &&
    (wearFailed || bendingFailed);

  const moduleMaximumReached =
    designFailed &&
    Number.isFinite(currentModule) &&
    currentModule >= MAX_STANDARD_MODULE &&
    (wearFailed || bendingFailed);

  function format(value) {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : '—';
  }

  const moduleValue = result.module ?? designResponse.module;

  const resultItems = [
    {
      label: 'Module',
      value: format(moduleValue),
      unit: 'mm',
    },
    {
      label: 'Pinion Teeth',
      value: result.pinion_teeth ?? designResponse.pinion_teeth,
      unit: '',
    },
    {
      label: 'Gear Teeth',
      value: result.gear_teeth ?? designResponse.gear_teeth,
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
      label: 'Face-Width Factor',
      value: format(
        result.face_width_factor ?? designResponse.face_width_factor
      ),
      unit: '',
    },
    {
      label: 'BHN Used',
      value: format(result.bhn ?? designResponse.bhn),
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
      value: format(result.actual_wear_force ?? result.wear_force),
      unit: 'N',
    },
    {
      label: 'Required Wear Force',
      value: format(result.required_wear_force),
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

    if (
      (option.id === 1 || option.id === 2) &&
      option.minimum !== undefined &&
      option.maximum !== undefined
    ) {
      const entered = retryValues[option.id];

      value =
        entered === undefined || entered === ''
          ? Number(option.maximum)
          : Number(entered);

      if (!Number.isFinite(value)) {
        setAdjustmentMessage('Enter a valid numeric value.');
        return;
      }

      if (option.id === 1) {
        if (value <= Number(option.minimum)) {
          setAdjustmentMessage(
            `Face-width factor must be greater than ${option.minimum}.`
          );
          return;
        }

        if (value > MAX_FACE_WIDTH_FACTOR) {
          setAdjustmentMessage(
            `Maximum face-width factor (${MAX_FACE_WIDTH_FACTOR}) has been reached. Enter a value no greater than ${MAX_FACE_WIDTH_FACTOR}.`
          );
          return;
        }
      }

      if (option.id === 2) {
        if (value <= Number(option.minimum)) {
          setAdjustmentMessage(
            `BHN must be greater than ${option.minimum}.`
          );
          return;
        }

        if (value > MAX_BHN) {
          setAdjustmentMessage(
            `Maximum BHN (${MAX_BHN}) has been reached. Enter a value no greater than ${MAX_BHN}.`
          );
          return;
        }
      }
    }

    if (option.id === 3) {
      if (
        Number(option.next_module) >= MAX_STANDARD_MODULE &&
        currentModule >= MAX_STANDARD_MODULE
      ) {
        setAdjustmentMessage(
          `Maximum standard module (${MAX_STANDARD_MODULE} mm) has been reached.`
        );
        return;
      }
    }

    setAdjustmentMessage('');
    onContinue(option.id, value);
    setRetryValues({});
  }

  function checkRow(label, passed) {
    const isKnown = typeof passed === 'boolean';

    return (
      <p key={label}>
        {label}:{' '}
        <strong
          style={{
            color: !isKnown
              ? '#94a3b8'
              : passed
                ? '#22c55e'
                : '#ef4444',
          }}
        >
          {!isKnown ? 'NOT PROVIDED' : passed ? 'PASSED' : 'FAILED'}
        </strong>
      </p>
    );
  }

  function limitNotice(message) {
    return (
      <p
        role="status"
        style={{
          marginTop: '10px',
          padding: '10px 12px',
          borderRadius: '6px',
          border: '1px solid #f59e0b',
          color: '#fbbf24',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        }}
      >
        ⚠ {message}
      </p>
    );
  }

  return (
    <div className={styles.resultsContent}>
      <div className={styles.summary}>
        <span className={styles.summaryLabel}>GEAR CONFIGURATION</span>
        <h3>Spur Gear</h3>
        <p>
          {result.pinion_teeth ?? designResponse.pinion_teeth} pinion teeth
          {' · '}
          {result.gear_teeth ?? designResponse.gear_teeth} gear teeth
          {' · '}
          Module {format(moduleValue)} mm
        </p>
      </div>

      <div className={styles.resultsGrid}>
        {resultItems.map((item) => (
          <div className={styles.resultCard} key={item.label}>
            <span className={styles.resultLabel}>{item.label}</span>
            <div className={styles.resultValue}>
              {item.value ?? '—'}
              {item.unit && (
                <span className={styles.resultUnit}>{item.unit}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Safety Checks</h3>
        {checkRow('Face-Width Check', checks.face_width_safe)}
        {checkRow('Bending Check', checks.bending_safe)}
        {checkRow('Wear Check', checks.wear_safe)}

        {checks.all_safe !== undefined &&
          checkRow('Overall Design', checks.all_safe)}
      </div>

      {status === 'success' && (
        <p style={{ color: '#22c55e', marginTop: '15px' }}>
          ✓ {designResponse.message || 'All implemented design checks passed.'}
        </p>
      )}

      {status === 'failed' && (
        <p style={{ color: '#ef4444', marginTop: '15px' }}>
          {designResponse.message || 'The design failed its checks.'}
        </p>
      )}

      {bhnMaximumReached &&
        limitNotice(
          `Maximum BHN (${MAX_BHN}) has been reached, but the wear check still fails. Try another available adjustment.`
        )}

      {faceWidthMaximumReached &&
        limitNotice(
          `Maximum face-width factor (${MAX_FACE_WIDTH_FACTOR}) has been reached, but the design still fails a safety check. Try another available adjustment.`
        )}

      {moduleMaximumReached &&
        limitNotice(
          `Maximum standard module (${MAX_STANDARD_MODULE} mm) has been reached, but the design still fails a safety check. No higher standard module is available.`
        )}

      {status === 'needs_user_choice' && (
        <div style={{ marginTop: '20px' }}>
          <h3>Available Design Adjustments</h3>

          <p>
            {designResponse.message ||
              'Choose an available adjustment to recalculate the design.'}
          </p>

          {options.length > 1 && (
            <p>
              Choose any one of these adjustments. You do not need to
              apply the other options first.
            </p>
          )}

          {adjustmentMessage && (
            <p role="alert" style={{ color: '#fbbf24', marginTop: '10px' }}>
              ⚠ {adjustmentMessage}
            </p>
          )}

          {options.length === 0 && (
            <p style={{ color: '#ef4444' }}>
              No further adjustment options are available.
            </p>
          )}

          {options.map((option) => {
            const needsRangeInput =
              (option.id === 1 || option.id === 2) &&
              option.minimum !== undefined &&
              option.maximum !== undefined;

            return (
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

                {needsRangeInput && (
                  <>
                    <p>
                      Current/minimum: {option.minimum}
                      {' · '}
                      Maximum: {option.maximum}
                    </p>

                    <label htmlFor={`spur-retry-value-${option.id}`}>
                      {option.id === 1 ? 'Face-width factor' : 'BHN value'}
                    </label>

                    <input
                      id={`spur-retry-value-${option.id}`}
                      type="number"
                      min={option.minimum}
                      max={option.maximum}
                      step={option.id === 2 ? '1' : 'any'}
                      value={retryValues[option.id] ?? ''}
                      placeholder={`Enter a value up to ${option.maximum}`}
                      onChange={(event) => {
                        setRetryValues((previous) => ({
                          ...previous,
                          [option.id]: event.target.value,
                        }));
                        setAdjustmentMessage('');
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        boxSizing: 'border-box',
                        padding: '8px',
                        marginBottom: '10px',
                      }}
                    />
                  </>
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
                    opacity: loading ? 0.65 : 1,
                  }}
                >
                  {loading ? 'Calculating...' : 'Apply This Adjustment'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className={styles.note}>
        Results are calculated by the Python engineering backend.
        Verify calculations, materials, and design standards before
        manufacturing.
      </p>
    </div>
  );
}

export default SpurgearResult;
