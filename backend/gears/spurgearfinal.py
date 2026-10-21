
import math
from copy import deepcopy


MODULE_STANDARDS = [
    1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6,
    7.5, 8, 10, 12, 16, 20, 25, 32, 40, 50
]

MAX_FACE_WIDTH_FACTOR = 15
MAX_BHN = 400
MIN_BHN = 25


def _number(data, key, default=None):
    value = data.get(key, default)

    if value is None:
        raise ValueError(f"Missing required input: {key}")

    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be numeric.")

    if not math.isfinite(value):
        raise ValueError(f"{key} must be a finite number.")

    return value


def validate_inputs(data):
    required = [
        "power",
        "pinion_rpm",
        "gear_ratio",
        "pressure_angle",
        "pinion_strength",
        "gear_strength",
        "service_factor",
        "bhn",
        "factor_of_safety",
        "pinion_modulus",
        "gear_modulus",
        "face_width_factor",
        "gear_system",
    ]

    for key in required:
        if key not in data:
            raise ValueError(f"Missing required input: {key}")

    numeric_keys = [
        "power",
        "pinion_rpm",
        "gear_ratio",
        "pressure_angle",
        "pinion_strength",
        "gear_strength",
        "service_factor",
        "bhn",
        "factor_of_safety",
        "pinion_modulus",
        "gear_modulus",
        "face_width_factor",
    ]

    for key in numeric_keys:
        value = _number(data, key)

        if value <= 0:
            raise ValueError(f"{key} must be greater than zero.")

    if _number(data, "service_factor") < 1:
        raise ValueError("Service factor must be at least 1.")

    if _number(data, "factor_of_safety") < 1:
        raise ValueError("Factor of safety must be at least 1.")

    if _number(data, "gear_ratio") < 1:
        raise ValueError("Gear ratio must be at least 1.")

    if _number(data, "pressure_angle") > 45:
        raise ValueError("Pressure angle must not exceed 45 degrees.")

    if _number(data, "face_width_factor") > MAX_FACE_WIDTH_FACTOR:
        raise ValueError(
            f"Face-width factor must not exceed "
            f"{MAX_FACE_WIDTH_FACTOR}."
        )

    bhn = _number(data, "bhn")
    if not MIN_BHN < bhn <= MAX_BHN:
        raise ValueError(
            f"BHN must be greater than {MIN_BHN} "
            f"and at most {MAX_BHN}."
        )

    if data["gear_system"] not in (
        "20fdi",
        "20stub",
        "14.5fdi",
    ):
        raise ValueError("Unsupported gear system.")

    return data


def calculate_module(T, So, y, z, n, x):
    """Iteratively estimate the required module."""
    if min(T, So, y, z, n, x) <= 0:
        raise ValueError(
            "Module calculation inputs must be greater than zero."
        )

    Cv = 0.5
    r = (2 * T) / (So * x * y * z)
    r1 = (math.pi * z * n) / 60000
    mo = (r / Cv) ** (1 / 3)

    for _ in range(1000):
        velocity = r1 * mo
        Cv_new = 3 / (velocity + 3)
        m1 = (r / Cv_new) ** (1 / 3)

        if abs(m1 - mo) < 1e-4:
            return m1

        mo = m1

    return mo


def select_standard_module(required_module):
    for module in MODULE_STANDARDS:
        if module >= required_module:
            return module

    return MODULE_STANDARDS[-1]


def calculate_geometry(module, zp, zg, x, pinion_rpm):
    dp = module * zp
    dg = module * zg
    b = module * x
    velocity = math.pi * dp * pinion_rpm / 60000
    cv = 3 / (velocity + 3)

    return {
        "pinion_pitch_diameter": dp,
        "gear_pitch_diameter": dg,
        "face_width": b,
        "velocity": velocity,
        "velocity_factor": cv,
    }


def bending_check(Tp, Dp, module, y, So, b):
    Ft = 2 * Tp / Dp
    Sb = module * b * So * y

    return Sb >= Ft, Sb, Ft


def wear_check(Ft, Cv, Dp, b, BHN, Ep, Eg, zg, zp, fi):
    dynamic_force = Ft / Cv
    Senc = 2.8 * BHN - 70

    k = (
        (Senc ** 2)
        * math.sin(math.radians(fi))
        / 1.4
        * ((1 / Ep) + (1 / Eg))
    )

    Q = 2 * zg / (zg + zp)
    Fw = Dp * b * k * Q
    required_wear_force = 1.15 * dynamic_force

    return (
        Fw >= required_wear_force,
        Fw,
        dynamic_force,
        required_wear_force,
    )


def get_available_options(state):
    """
    Return every currently available adjustment.

    Options are independent: the user does not have to exhaust
    face-width or BHN adjustments before increasing the module.
    """
    options = []

    x = float(state["face_width_factor"])
    bhn = float(state["bhn"])
    module_index = int(state["module_index"])

    if x < MAX_FACE_WIDTH_FACTOR:
        options.append({
            "id": 1,
            "label": "Increase face-width factor",
            "minimum": x,
            "maximum": MAX_FACE_WIDTH_FACTOR,
        })

    if bhn < MAX_BHN:
        options.append({
            "id": 2,
            "label": "Increase Brinell hardness number (BHN)",
            "minimum": bhn,
            "maximum": MAX_BHN,
        })

    if module_index + 1 < len(MODULE_STANDARDS):
        options.append({
            "id": 3,
            "label": "Increase to the next standard module",
            "next_module": MODULE_STANDARDS[module_index + 1],
        })

    return options


def _recalculate_module(state):
    if state["weaker_member"] == "pinion":
        y = state["pinion_lewis_factor"]
        z = state["pinion_teeth"]
        n = state["pinion_rpm"]
        So = state["allowable_pinion_stress"]
    else:
        y = state["gear_lewis_factor"]
        z = state["gear_teeth"]
        n = state["gear_rpm"]
        So = state["allowable_gear_stress"]

    required_module = calculate_module(
        state["design_torque"],
        So,
        y,
        z,
        n,
        state["face_width_factor"],
    )

    module = select_standard_module(required_module)

    state["required_module"] = required_module
    state["module"] = module
    state["module_index"] = MODULE_STANDARDS.index(module)


def run_checks(state):
    state = deepcopy(state)

    module = float(state["module"])
    zp = int(state["pinion_teeth"])
    zg = int(state["gear_teeth"])
    x = float(state["face_width_factor"])
    bhn = float(state["bhn"])

    geometry = calculate_geometry(
        module,
        zp,
        zg,
        x,
        float(state["pinion_rpm"]),
    )

    dp = geometry["pinion_pitch_diameter"]
    dg = geometry["gear_pitch_diameter"]
    b = geometry["face_width"]
    velocity = geometry["velocity"]
    cv = geometry["velocity_factor"]

    if state["weaker_member"] == "pinion":
        y = state["pinion_lewis_factor"]
        So = state["allowable_pinion_stress"]
    else:
        y = state["gear_lewis_factor"]
        So = state["allowable_gear_stress"]

    bending_safe, bending_capacity, Ft = bending_check(
        state["design_torque"],
        dp,
        module,
        y,
        So,
        b,
    )

    wear_safe, wear_force, dynamic_force, required_wear_force = (
        wear_check(
            Ft,
            cv,
            dp,
            b,
            bhn,
            float(state["pinion_modulus"]),
            float(state["gear_modulus"]),
            zg,
            zp,
            float(state["pressure_angle"]),
        )
    )

    all_safe = bending_safe and wear_safe

    results = {
        "module": module,
        "required_module": state["required_module"],
        "pinion_teeth": zp,
        "gear_teeth": zg,
        "pinion_pitch_diameter": dp,
        "gear_pitch_diameter": dg,
        "face_width": b,
        "velocity": velocity,
        "velocity_factor": cv,
        "pinion_lewis_factor": state["pinion_lewis_factor"],
        "gear_lewis_factor": state["gear_lewis_factor"],
        "bending_stress": bending_capacity,
        "tangential_force": Ft,
        "wear_force": wear_force,
        "dynamic_force": dynamic_force,
        "required_wear_force": required_wear_force,
        "pinion_torque": state["pinion_torque"],
        "design_torque": state["design_torque"],
        "bhn": bhn,
    }

    checks = {
        "bending_safe": bending_safe,
        "wear_safe": wear_safe,
        "all_safe": all_safe,
    }

    if all_safe:
        status = "success"
        message = "All implemented design checks passed."
        options = []
    else:
        options = get_available_options(state)

        if options:
            status = "needs_user_choice"
            message = (
                "One or more safety checks failed. "
                "Choose any available adjustment below."
            )
        else:
            status = "failed"
            message = (
                "Safety checks still fail and no further "
                "adjustments are available."
            )

    state.update({
        "results": results,
        "checks": checks,
        "status": status,
        "message": message,
        "options": options,
    })

    return state


def start_spur_design(data):
    validate_inputs(data)

    power = float(data["power"])
    pinion_rpm = float(data["pinion_rpm"])
    gear_ratio = float(data["gear_ratio"])
    pressure_angle = float(data["pressure_angle"])
    service_factor = float(data["service_factor"])
    fos = float(data["factor_of_safety"])
    x = float(data["face_width_factor"])
    bhn = float(data["bhn"])

    pinion_strength = float(data["pinion_strength"])
    gear_strength = float(data["gear_strength"])

    gear_rpm = pinion_rpm / gear_ratio

    zp = math.ceil(
        2 / math.sin(math.radians(pressure_angle)) ** 2
    )
    zg = math.ceil(gear_ratio * zp)

    if data["gear_system"] == "20fdi":
        yp = 0.484 - 2.87 / zp
        yg = 0.484 - 2.87 / zg
    elif data["gear_system"] == "20stub":
        yp = 0.8 - 2.0 / zp
        yg = 0.8 - 2.0 / zg
    else:
        yp = 0.124 - 0.684 / zp
        yg = 0.124 - 0.684 / zg

    allowable_pinion = pinion_strength / fos
    allowable_gear = gear_strength / fos

    pinion_comparison = allowable_pinion * yp
    gear_comparison = allowable_gear * yg

    if pinion_comparison <= gear_comparison:
        weaker_member = "pinion"
        y = yp
        z = zp
        n = pinion_rpm
        So = allowable_pinion
    else:
        weaker_member = "gear"
        y = yg
        z = zg
        n = gear_rpm
        So = allowable_gear

    # Convert power and rotational speed into N·mm.
    pinion_torque = (
        60 * 1e6 * power
    ) / (2 * math.pi * pinion_rpm)

    design_torque = service_factor * pinion_torque

    required_module = calculate_module(
        design_torque,
        So,
        y,
        z,
        n,
        x,
    )

    module = select_standard_module(required_module)

    state = {
        "gear_type": "spur",
        "weaker_member": weaker_member,
        "power": power,
        "pinion_rpm": pinion_rpm,
        "gear_rpm": gear_rpm,
        "gear_ratio": gear_ratio,
        "pressure_angle": pressure_angle,
        "service_factor": service_factor,
        "factor_of_safety": fos,
        "gear_system": data["gear_system"],
        "pinion_modulus": float(data["pinion_modulus"]),
        "gear_modulus": float(data["gear_modulus"]),
        "pinion_strength": pinion_strength,
        "gear_strength": gear_strength,
        "allowable_pinion_stress": allowable_pinion,
        "allowable_gear_stress": allowable_gear,
        "pinion_lewis_factor": yp,
        "gear_lewis_factor": yg,
        "pinion_teeth": zp,
        "gear_teeth": zg,
        "pinion_torque": pinion_torque,
        "design_torque": design_torque,
        "face_width_factor": x,
        "bhn": bhn,
        "required_module": required_module,
        "module": module,
        "module_index": MODULE_STANDARDS.index(module),
    }

    return run_checks(state)


def continue_spur_design(state, choice, value=None):
    state = deepcopy(state)

    if state.get("gear_type") != "spur":
        raise ValueError("The supplied state is not a spur gear design.")

    if state.get("status") != "needs_user_choice":
        raise ValueError(
            "The design is not currently waiting for an adjustment."
        )

    # Validate against currently available choices. This ensures
    # the selected option is still valid for the supplied design state.
    available = get_available_options(state)
    option_ids = {option["id"] for option in available}

    if choice not in option_ids:
        raise ValueError(
            "This adjustment is not currently available. "
            "Choose one of the listed options."
        )

    if choice == 1:
        if value is None:
            raise ValueError("Enter a new face-width factor.")

        new_x = float(value)
        current_x = float(state["face_width_factor"])

        if not current_x < new_x <= MAX_FACE_WIDTH_FACTOR:
            raise ValueError(
                f"Face-width factor must be greater than {current_x} "
                f"and at most {MAX_FACE_WIDTH_FACTOR}."
            )

        state["face_width_factor"] = new_x
        _recalculate_module(state)

    elif choice == 2:
        if value is None:
            raise ValueError("Enter a new BHN value.")

        new_bhn = float(value)
        current_bhn = float(state["bhn"])

        if not current_bhn < new_bhn <= MAX_BHN:
            raise ValueError(
                f"BHN must be greater than {current_bhn} "
                f"and at most {MAX_BHN}."
            )

        if 2.8 * new_bhn - 70 <= 0:
            raise ValueError("The entered BHN is not valid.")

        state["bhn"] = new_bhn

    elif choice == 3:
        next_index = int(state["module_index"]) + 1

        if next_index >= len(MODULE_STANDARDS):
            raise ValueError(
                "There is no higher standard module available."
            )

        state["module_index"] = next_index
        state["module"] = MODULE_STANDARDS[next_index]

    return run_checks(state)
