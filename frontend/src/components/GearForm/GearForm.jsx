
import styles from './GearForm.module.css';

function GearForm({
  gearType,
  setGearType,
  gearData,
  setGearData,
  onGenerate,
  onReset,
}) {
  function handleChange(event) {
    const { name, value } = event.target;

    setGearData((previousData) => ({
      ...previousData,
      [name]: value === '' ? '' : Number(value),
    }));
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
        >
          <option value="spur">Spur Gear</option>
          <option value="helical">Helical Gear</option>
        </select>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="module">Module (mm)</label>
          <input
            id="module"
            name="module"
            type="number"
            min="0.1"
            step="0.1"
            value={gearData.module}
            onChange={handleChange}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="teeth">Number of Teeth</label>
          <input
            id="teeth"
            name="teeth"
            type="number"
            min="6"
            step="1"
            value={gearData.teeth}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="pressureAngle">Pressure Angle (°)</label>
          <select
            id="pressureAngle"
            name="pressureAngle"
            value={gearData.pressureAngle}
            onChange={handleChange}
          >
            <option value={14.5}>14.5°</option>
            <option value={20}>20°</option>
            <option value={25}>25°</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="faceWidth">Face Width (mm)</label>
          <input
            id="faceWidth"
            name="faceWidth"
            type="number"
            min="1"
            step="1"
            value={gearData.faceWidth}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="power">Power to Transmit (kW)</label>
        <input
          id="power"
          name="power"
          type="number"
          min="0.1"
          step="0.1"
          value={gearData.power}
          onChange={handleChange}
          required
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="pinionSpeed">Pinion Speed (RPM)</label>
          <input
            id="pinionSpeed"
            name="pinionSpeed"
            type="number"
            min="1"
            step="1"
            value={gearData.pinionSpeed}
            onChange={handleChange}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="gearSpeed">Gear Speed (RPM)</label>
          <input
            id="gearSpeed"
            name="gearSpeed"
            type="number"
            min="1"
            step="1"
            value={gearData.gearSpeed}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="factorOfSafety">Factor of Safety</label>
          <input
            id="factorOfSafety"
            name="factorOfSafety"
            type="number"
            min="1"
            step="0.1"
            value={gearData.factorOfSafety}
            onChange={handleChange}
            required
          />
        </div>

        {gearType === 'helical' && (
          <div className={styles.field}>
            <label htmlFor="helixAngle">Helix Angle (°)</label>
            <input
              id="helixAngle"
              name="helixAngle"
              type="number"
              min="1"
              max="45"
              step="1"
              value={gearData.helixAngle}
              onChange={handleChange}
              required
            />
          </div>
        )}
      </div>

      <div className={styles.buttons}>
        <button className={styles.generateButton} type="submit">
          Generate Gear
        </button>

        <button
          className={styles.resetButton}
          type="button"
          onClick={onReset}
        >
          Reset
        </button>
      </div>
    </form>
  );
}

export default GearForm;
