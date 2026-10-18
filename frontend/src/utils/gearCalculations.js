
/**
 * Gear Design Studio
 * ------------------
 * Lightweight frontend calculations for preliminary gear geometry.
 *
 * These functions do not replace the actual engineering design
 * calculations in the Python backend.
 */

/**
 * Convert degrees to radians.
 */
function degreesToRadians(degrees) {
  return (Number(degrees) * Math.PI) / 180;
}

/**
 * Validate the basic inputs required for geometry calculations.
 */
export function validateGearInputs(gearType, gearData) {
  const errors = {};

  const module = Number(gearData.module);
  const teeth = Number(gearData.teeth);
  const pressureAngle = Number(gearData.pressureAngle);
  const faceWidth = Number(gearData.faceWidth);
  const pinionSpeed = Number(gearData.pinionSpeed);
  const gearSpeed = Number(gearData.gearSpeed);
  const power = Number(gearData.power);
  const factorOfSafety = Number(gearData.factorOfSafety);
  const helixAngle = Number(gearData.helixAngle);

  if (!Number.isFinite(module) || module <= 0) {
    errors.module = 'Module must be greater than zero.';
  }

  if (!Number.isInteger(teeth) || teeth < 6) {
    errors.teeth = 'Enter a whole number of teeth, at least 6.';
  }

  if (!Number.isFinite(pressureAngle) || pressureAngle <= 0 || pressureAngle >= 90) {
    errors.pressureAngle = 'Enter a valid pressure angle.';
  }

  if (!Number.isFinite(faceWidth) || faceWidth <= 0) {
    errors.faceWidth = 'Face width must be greater than zero.';
  }

  if (!Number.isFinite(pinionSpeed) || pinionSpeed <= 0) {
    errors.pinionSpeed = 'Pinion speed must be greater than zero.';
  }

  if (!Number.isFinite(gearSpeed) || gearSpeed <= 0) {
    errors.gearSpeed = 'Gear speed must be greater than zero.';
  }

  if (!Number.isFinite(power) || power <= 0) {
    errors.power = 'Power must be greater than zero.';
  }

  if (!Number.isFinite(factorOfSafety) || factorOfSafety < 1) {
    errors.factorOfSafety = 'Factor of safety must be at least 1.';
  }

  if (gearType === 'helical') {
    if (
      !Number.isFinite(helixAngle) ||
      helixAngle <= 0 ||
      helixAngle > 45
    ) {
      errors.helixAngle = 'Helix angle must be greater than 0° and at most 45°.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Calculate preliminary geometric dimensions.
 *
 * Spur gear:
 *   Pitch diameter = module × number of teeth
 *
 * Helical gear:
 *   Assumes the supplied module is the normal module.
 *   Transverse module = normal module / cos(helix angle)
 */
export function calculateGearGeometry(gearType, gearData) {
  const validation = validateGearInputs(gearType, gearData);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  const module = Number(gearData.module);
  const teeth = Number(gearData.teeth);
  const pressureAngle = Number(gearData.pressureAngle);
  const faceWidth = Number(gearData.faceWidth);
  const pinionSpeed = Number(gearData.pinionSpeed);
  const gearSpeed = Number(gearData.gearSpeed);
  const power = Number(gearData.power);

  const helixAngle =
    gearType === 'helical'
      ? Number(gearData.helixAngle)
      : 0;

  const helixRadians = degreesToRadians(helixAngle);
  const pressureRadians = degreesToRadians(pressureAngle);

  const transverseModule =
    gearType === 'helical'
      ? module / Math.cos(helixRadians)
      : module;

  const pitchDiameter = transverseModule * teeth;
  const addendumDiameter = pitchDiameter + 2 * transverseModule;
  const dedendumDiameter = pitchDiameter - 2.5 * transverseModule;
  const baseDiameter =
    pitchDiameter * Math.cos(
      gearType === 'helical'
        ? Math.atan(Math.tan(pressureRadians) / Math.cos(helixRadians))
        : pressureRadians
    );

  const centerDistance = pitchDiameter / 2;
  const speedRatio = pinionSpeed / gearSpeed;
  const torque = (9550 * power) / pinionSpeed;

  const round = (value) =>
    Number.isFinite(value)
      ? Number(value.toFixed(3))
      : null;

  return {
    success: true,
    gearType,
    inputs: {
      module,
      teeth,
      pressureAngle,
      faceWidth,
      pinionSpeed,
      gearSpeed,
      power,
      helixAngle,
    },
    geometry: {
      normalModule: round(module),
      transverseModule: round(transverseModule),
      pitchDiameter: round(pitchDiameter),
      addendumDiameter: round(addendumDiameter),
      dedendumDiameter: round(dedendumDiameter),
      baseDiameter: round(baseDiameter),
      faceWidth: round(faceWidth),
      centerDistance: round(centerDistance),
    },
    transmission: {
      speedRatio: round(speedRatio),
      inputTorque: round(torque),
    },
    notice:
      'Preliminary geometric estimates only. Final module selection, strength checks, wear checks, and design safety must be calculated by the engineering backend.',
  };
}

/**
 * Prepare the current design inputs for a future backend request.
 */
export function prepareGearDesignRequest(gearType, gearData) {
  const validation = validateGearInputs(gearType, gearData);

  if (!validation.isValid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  return {
    success: true,
    payload: {
      gearType,
      parameters: {
        module: Number(gearData.module),
        teeth: Number(gearData.teeth),
        pressureAngle: Number(gearData.pressureAngle),
        faceWidth: Number(gearData.faceWidth),
        power: Number(gearData.power),
        pinionSpeed: Number(gearData.pinionSpeed),
        gearSpeed: Number(gearData.gearSpeed),
        factorOfSafety: Number(gearData.factorOfSafety),
        helixAngle:
          gearType === 'helical'
            ? Number(gearData.helixAngle)
            : null,
      },
    },
  };
}
