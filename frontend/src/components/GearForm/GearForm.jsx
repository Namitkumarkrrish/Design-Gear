
import styles from './GearForm.module.css';

function GearForm({
  gearType,
  setGearType,
  gearData,
  setGearData,
  onGenerate,
  onReset,
  loading,
}) {
  const isHelical = gearType === 'helical';

  function handleChange(event) {
    const { name, value } = event.target;

    setGearData((previousData) => ({
      ...previousData,
      [name]: value === '' ? '' : Number(value),
    }));
  }

  function handleSelectChange(event) {
    const { name, value } = event.target;

    setGearData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  function field(label, name, min = '0.1', step = 'any', max) {
    return (
      <div className={styles.field} key={name}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          type="number"
          min={min}
          max={max}
          step={step}
          value={gearData[name] ?? ''}
          onChange={handleChange}
          required
          disabled={loading}
        />
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onGenerate();
      }}
    >
      <div className={styles.field}>
        <label htmlFor="gearType">Gear Type</label>
        <select
          id="gearType"
          value={gearType}
          onChange={(event) => setGearType(event.target.value)}
          disabled={loading}
        >
          <option value="spur">Spur Gear</option>
          <option value="helical">Helical Gear</option>
        </select>
      </div>

      {field('Power (kW)', 'power')}
      {field('Pinion Speed (RPM)', 'pinionSpeed', '1', '1')}
      {field('Gear Ratio (Np / Ng)', 'gearRatio', '1', 'any')}
      {field('Pressure Angle (°)', 'pressureAngle', '0.1', 'any', '89')}

      {isHelical &&
        field('Helix Angle (°)', 'helixAngle', '0.1', 'any', '89')}

      {!isHelical && (
        <div className={styles.field}>
          <label htmlFor="gearSystem">Gear Standard</label>
          <select
            id="gearSystem"
            name="gearSystem"
            value={gearData.gearSystem}
            onChange={handleSelectChange}
            disabled={loading}
          >
            <option value="20fdi">20° Full-Depth Involute</option>
            <option value="20stub">20° Stub Involute</option>
            <option value="14.5fdi">14.5° Full-Depth Involute</option>
          </select>
        </div>
      )}

      {field('Pinion Ultimate Strength (MPa)', 'pinionStrength')}
      {field('Gear Ultimate Strength (MPa)', 'gearStrength')}
      {field('Service Factor', 'serviceFactor', '1')}

      {isHelical &&
        field('Wear Factor', 'wearFactor', '1')}

      {field('Brinell Hardness Number (BHN)', 'bhn', '1', '1', '400')}
      {field('Factor of Safety', 'factorOfSafety', '1', 'any', '10')}
      {field('Pinion Young’s Modulus (MPa)', 'pinionModulus', '1')}
      {field('Gear Young’s Modulus (MPa)', 'gearModulus', '1')}
      {field('Face-Width Factor (maximum 15)', 'faceWidthFactor', '1', 'any', '15')}

      <div className={styles.buttons}>
        <button
          className={styles.generateButton}
          type="submit"
          disabled={loading}
        >
          {loading ? 'Calculating...' : 'Generate Gear'}
        </button>

        <button
          className={styles.resetButton}
          type="button"
          onClick={onReset}
          disabled={loading}
        >
          Reset
        </button>
      </div>

      {isHelical && (
        <p>
          Helical design uses the helix angle and wear factor in addition
          to the common gear parameters.
        </p>
      )}
    </form>
  );
}

export default GearForm;
