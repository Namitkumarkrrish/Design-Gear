
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
  const isBevel = gearType === 'bevel';

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

  function handleCheckboxChange(event) {
    const { name, checked } = event.target;

    setGearData((previousData) => ({
      ...previousData,
      [name]: checked,
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
          <option value="bevel">Bevel Gear</option>
        </select>
      </div>

      {field('Power (kW)', 'power')}
      {field('Pinion Speed (RPM)', 'pinionSpeed', '1', '1')}
      {field('Gear Ratio (Np / Ng)', 'gearRatio', '1', 'any')}
      {!isBevel &&
        field('Pressure Angle (°)', 'pressureAngle', '0.1', 'any', '89')}

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

      {isBevel && (
        <>
          {field('Shaft Angle Σ (°, 30 – 90)', 'shaftAngle', '30', 'any', '90')}
          {field('Number of Pinion Teeth', 'pinionTeeth', '5', '1')}
          {field('Loading Factor (Cw)', 'loadingFactor', '0.1')}

          <div className={styles.field}>
            <label htmlFor="accuracyClass">
              Gear Accuracy Class (dynamic load)
            </label>
            <select
              id="accuracyClass"
              name="accuracyClass"
              value={gearData.accuracyClass}
              onChange={handleSelectChange}
              disabled={loading}
            >
              <option value="it7">IT7</option>
              <option value="it8">IT8</option>
              <option value="it9">IT9</option>
            </select>
          </div>
        </>
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

      <div className={styles.field}>
        <label htmlFor="boreEnabled">
          <input
            id="boreEnabled"
            name="boreEnabled"
            type="checkbox"
            checked={Boolean(gearData.boreEnabled)}
            onChange={handleCheckboxChange}
            disabled={loading}
          />{' '}
          Add bore hole
        </label>
      </div>

      {gearData.boreEnabled && (
        <>
          {field('Pinion Bore Diameter (mm)', 'pinionBore', '1', 'any')}
          {field('Gear Bore Diameter (mm)', 'gearBore', '1', 'any')}
        </>
      )}

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

      {isBevel && (
        <p>
          Straight bevel design uses the shaft angle, pinion teeth,
          loading factor and accuracy class in addition to the common gear
          parameters. The pressure angle comes from the selected gear
          standard, and a face-width factor of 8 to 10 is typical.
        </p>
      )}
    </form>
  );
}

export default GearForm;
