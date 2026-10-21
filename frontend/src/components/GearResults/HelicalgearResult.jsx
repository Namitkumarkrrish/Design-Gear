
import { useState } from 'react';
import styles from './GearResults.module.css';

const MAX_BHN = 400;
const MAX_FACE_WIDTH_FACTOR = 15;
const MAX_STANDARD_MODULE = 50;

function HelicalgearResult({ designResponse, loading, onContinue }) {
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

  const currentModule = Number(
    result.normal_module ??
      designResponse.normal_module ??
      result.module ??
      designResponse.module
  );

  const designFailed =
    status === 'failed' || status === 'needs_user_choice';

  const anySafetyCheckFailed =
    checks.face_width_safe === false ||
    checks.bending_safe === false ||
    checks.wear_safe === false ||
    checks.all_safe === false;

  const bhnMaximumReached =
    designFailed &&
    checks.wear_safe === false &&
    Number.isFinite(currentBhn) &&
    currentBhn >= MAX_BHN;

  const faceWidthMaximumReached =
    designFailed &&
    Number.isFinite(currentFaceWidthFactor) &&
    currentFaceWidthFactor >= MAX_FACE_WIDTH_FACTOR &&
    anySafetyCheckFailed;

  const moduleMaximumReached =
    designFailed &&
    Number.isFinite(currentModule) &&
    currentModule >= MAX_STANDARD_MODULE &&
    anySafetyCheckFailed;

  function format(value) {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : '—';
  }

  const normalModule =
    result.normal_module ?? designResponse.normal_module;

  const transverseModule =
    result.module ?? designResponse.module;

  const resultItems = [
    {
      label: 'Normal Module',
      value: format(normalModule),
      unit: 'mm',
    },
    {
      label: 'Transverse Module',
      value: format(transverseModule),
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
      label: 'Helix Angle',
      value: format(result.helix_angle ?? designResponse.helix_angle),
      unit: '°',
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
      label: 'Actual Wear Force',
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
    {
      label: 'Required BHN',
      value: format(result.required_bhn),
      unit: '',
    },
    {
      label: 'Bending Factor of Safety',
      value: format(result.bending_factor_of_safety),
      unit: '',
    },
  ];

  function handleRetry(option) {
    let value = null;

    if (option.id === 1) {
      const minimum = Number(option.minimum);
      const maximum = Number(
        option.maximum ?? MAX_FACE_WIDTH_FACTOR
      );
      const entered = retryValues[option.id];

      value =
        entered === undefined || entered.trim() === ''
          ? maximum
          : Number(entered);

      if (
        !Number.isFinite(value) ||
        value <= minimum ||
        value > maximum
      ) {
        setAdjustmentMessage(
          `Face-width factor must be greater than ${minimum} and at most ${maximum}.`
        );
        return;
      }
    } else if (option.id === 2) {
      const currentBhnValue = Number(
        result.bhn ?? designResponse.bhn
      );
      const entered = retryValues[option.id];

      if (entered === undefined || entered.trim() === '') {
        setAdjustmentMessage(
          'Please enter a BHN value before continuing.'
        );
        return;
      }

      value = Number(entered);

      if (
        !Number.isFinite(currentBhnValue) ||
        !Number.isFinite(value) ||
        value <= currentBhnValue ||
        value > MAX_BHN
      ) {
        setAdjustmentMessage(
          `Enter a BHN greater than the current value (${currentBhnValue}) and at most ${MAX_BHN}.`
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
        <h3>Helical Gear</h3>
        <p>
          {result.pinion_teeth ?? designResponse.pinion_teeth} pinion teeth
          {' · '}
          {result.gear_teeth ?? designResponse.gear_teeth} gear teeth
          {' · '}
          Normal module {format(normalModule)} mm
        </p>
        <p>
          Helix angle:{' '}
          {format(result.helix_angle ?? designResponse.helix_angle)}°
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
          `Maximum face-width factor (${MAX_FACE_WIDTH_FACTOR}) has been reached, but the design still fails a safety check. Try another adjustment.`
        )}

      {moduleMaximumReached &&
        limitNotice(
          `Maximum standard module (${MAX_STANDARD_MODULE} mm) has been reached, but the design still fails a safety check. No higher standard module is available.`
        )}

      {status === 'needs_user_choice' && (
        <div style={{ marginTop: '20px' }}>
          <h3>Design Adjustment Required</h3>

          <p>
            {designResponse.message ||
              'Choose an available adjustment to recalculate the design.'}
          </p>

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

              {option.id === 1 && (
                <>
                  <p>
                    Current/minimum: {option.minimum}
                    {' · '}
                    Maximum: {option.maximum ?? MAX_FACE_WIDTH_FACTOR}
                  </p>

                  <label htmlFor="helical-retry-face-width">
                    Face-width factor
                  </label>

                  <input
                    id="helical-retry-face-width"
                    type="number"
                    min={option.minimum}
                    max={option.maximum ?? MAX_FACE_WIDTH_FACTOR}
                    step="any"
                    value={retryValues[option.id] ?? ''}
                    placeholder={`Enter a value up to ${
                      option.maximum ?? MAX_FACE_WIDTH_FACTOR
                    }`}
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
                      margin: '8px 0 10px',
                    }}
                  />
                </>
              )}

              {option.id === 2 && (
                <>
                  <p>
                    Current BHN: {result.bhn ?? designResponse.bhn}
                    {' · '}
                    Maximum BHN: {MAX_BHN}
                  </p>

                  <p>
                    Enter a value greater than the current BHN and at most{' '}
                    {MAX_BHN}.
                  </p>

                  <label htmlFor="helical-retry-bhn">BHN value</label>

                  <input
                    id="helical-retry-bhn"
                    type="number"
                    min={Number(result.bhn ?? designResponse.bhn) + 1}
                    max={MAX_BHN}
                    step="1"
                    value={retryValues[option.id] ?? ''}
                    placeholder={`Enter BHN above ${
                      result.bhn ?? designResponse.bhn
                    }`}
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
                      margin: '8px 0 10px',
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
          ))}
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

export default HelicalgearResult;
