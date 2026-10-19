
import math


# Standard modules from your original code.
MODULE_STANDARDS = [
    1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0,
    6.0, 7.5, 8.0, 10.0, 12.0, 16.0, 20.0,
    25.0, 32.0, 40.0, 50.0
]


def calculate_module(T, So, y, z, n, x):
    """Calculate the required module using the original iteration."""
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

    raise ValueError("Module calculation did not converge.")


def select_standard_module(required_module):
    """Choose the first standard module >= the required module."""
    for standard in MODULE_STANDARDS:
        if required_module <= standard:
            return standard

    # Preserve the original program's fallback to its largest module.
    return MODULE_STANDARDS[-1]


def calculate_geometry(module, zp, zg, x, pinion_rpm):
    """Calculate gear geometry and velocity factor."""
    Dp = module * zp
    Dg = module * zg
    b = module * x
    v = (math.pi * Dp * pinion_rpm) / 60000
    Cv = 3 / (v + 3)

    return Dp, Dg, b, v, Cv


def bending_check(Tp, Dp, module, y, So, b):
    """Return bending safety, bending capacity, and tangential force."""
    Ft = 2 * Tp / Dp
    Sb = module * b * So * y

    return Sb >= Ft, Sb, Ft


def wear_check(Ft, Cv, Dp, b, BHN, Ep, Eg, zg, zp, fi):
    """Return wear safety, wear force, and dynamic force."""
    Fd = Ft / Cv
    Senc = 2.8 * BHN - 70

    k = (
        ((Senc ** 2) * math.sin(math.radians(fi))) / 1.4
    ) * ((1 / Ep) + (1 / Eg))

    Q = (2 * zg) / (zg + zp)
    Fw = Dp * b * k * Q

    return Fw >= 1.15 * Fd, Fw, Fd


def validate_inputs(data):
    """Validate the input values received from the frontend."""
    required = [
        "power", "pinion_rpm", "gear_ratio", "pressure_angle",
        "pinion_strength", "gear_strength", "service_factor",
        "bhn", "gear_system", "factor_of_safety",
        "pinion_modulus", "gear_modulus", "face_width_factor"
    ]

    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError("Missing inputs: " + ", ".join(missing))

    numeric_keys = [
        "power", "pinion_rpm", "gear_ratio", "pressure_angle",
        "pinion_strength", "gear_strength", "service_factor",
        "bhn", "factor_of_safety", "pinion_modulus",
        "gear_modulus", "face_width_factor"
    ]

    values = {}
    for key in numeric_keys:
        try:
            values[key] = float(data[key])
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be a number.")

        if not math.isfinite(values[key]):
            raise ValueError(f"{key} must be a finite number.")

    positive_keys = [
        "power", "pinion_rpm", "gear_ratio", "pressure_angle",
        "pinion_strength", "gear_strength", "bhn",
        "pinion_modulus", "gear_modulus", "face_width_factor"
    ]

    for key in positive_keys:
        if values[key] <= 0:
            raise ValueError(f"{key} must be greater than zero.")

    if values["service_factor"] < 1:
        raise ValueError("service_factor must be at least 1.")

    if values["factor_of_safety"] < 1:
        raise ValueError("factor_of_safety must be at least 1.")

    if values["gear_ratio"] < 1:
        raise ValueError("gear_ratio must be at least 1.")

    if values["pressure_angle"] > 45:
        raise ValueError("pressure_angle must not exceed 45 degrees.")

    if values["face_width_factor"] > 15:
        raise ValueError("face_width_factor must not exceed 15.")

    if 2.8 * values["bhn"] - 70 <= 0:
        raise ValueError("BHN makes the wear formula invalid.")

    gear_system = str(data["gear_system"]).strip().lower()
    if gear_system not in ("20fdi", "20stub", "14.5fdi"):
        raise ValueError(
            "gear_system must be 20fdi, 20stub, or 14.5fdi."
        )

    values["gear_system"] = gear_system
    return values


def get_available_options(state):
    """Return the same three choices as the original program."""
    x = state["face_width_factor"]
    BHN = state["bhn"]

    if x < 15:
        return [
            {
                "id": 1,
                "label": "Increase face-width factor",
                "minimum": x,
                "maximum": 15
            }
        ]

    if BHN < 400:
        return [
            {
                "id": 2,
                "label": "Increase Brinell hardness number",
                "minimum": BHN,
                "maximum": 400
            }
        ]

    module_index = state["module_index"]

    if module_index + 1 < len(MODULE_STANDARDS):
        return [
            {
                "id": 3,
                "label": "Increase module to the next standard size",
                "next_module": MODULE_STANDARDS[module_index + 1]
            }
        ]

    return []


def run_checks(state):
    """Calculate current results and decide whether the design is complete."""
    zp = state["pinion_teeth"]
    zg = state["gear_teeth"]
    Np = state["pinion_rpm"]
    Ng = state["gear_rpm"]
    fi = state["pressure_angle"]
    x = state["face_width_factor"]
    BHN = state["bhn"]
    module = state["module"]
    Tp = state["pinion_torque"]
    Ep = state["pinion_modulus"]
    Eg = state["gear_modulus"]

    Dp, Dg, b, v, Cv = calculate_geometry(
        module, zp, zg, x, Np
    )

    bending_safe, Sb, Ft = bending_check(
        Tp, Dp, module,
        state["pinion_lewis_factor"],
        state["allowable_pinion_stress"],
        b
    )

    wear_safe, Fw, Fd = wear_check(
        Ft, Cv, Dp, b, BHN, Ep, Eg, zg, zp, fi
    )

    state["results"] = {
        "module": module,
        "required_module": state["required_module"],
        "pinion_teeth": zp,
        "gear_teeth": zg,
        "pinion_pitch_diameter": Dp,
        "gear_pitch_diameter": Dg,
        "face_width": b,
        "velocity": v,
        "velocity_factor": Cv,
        "pinion_lewis_factor": state["pinion_lewis_factor"],
        "gear_lewis_factor": state["gear_lewis_factor"],
        "bending_stress": Sb,
        "tangential_force": Ft,
        "wear_force": Fw,
        "dynamic_force": Fd,
        "pinion_torque": Tp,
        "design_torque": state["design_torque"]
    }

    state["checks"] = {
        "bending_safe": bending_safe,
        "wear_safe": wear_safe,
        "all_safe": bending_safe and wear_safe
    }

    if state["checks"]["all_safe"]:
        state["status"] = "success"
        state["message"] = "All design checks satisfied."
        state["options"] = []
        return state

    options = get_available_options(state)

    if options:
        state["status"] = "needs_user_choice"
        state["message"] = (
            "A safety check failed. Choose an available option to continue."
        )
        state["options"] = options
    else:
        state["status"] = "failed"
        state["message"] = (
            "Safety checks still fail at the maximum standard module."
        )
        state["options"] = []

    return state


def start_spur_design(data):
    """Start a new spur gear design from frontend input values."""
    values = validate_inputs(data)

    Power = values["power"]
    Np = values["pinion_rpm"]
    i = values["gear_ratio"]
    fi = values["pressure_angle"]
    SPut = values["pinion_strength"]
    SGut = values["gear_strength"]
    Cs = values["service_factor"]
    BHN = values["bhn"]
    fos = values["factor_of_safety"]
    Ep = values["pinion_modulus"]
    Eg = values["gear_modulus"]
    x = values["face_width_factor"]

    Ng = Np / i

    zp = math.ceil(2 / (math.sin(math.radians(fi)) ** 2))
    zg = math.ceil(i * zp)

    # Preserve the Lewis factor formulas from your supplied code.
    Yp = 0.484 - (3.28 / zp)
    Yg = 0.484 - (3.28 / zg)

    if Yp <= 0 or Yg <= 0:
        raise ValueError("Calculated Lewis form factor is not positive.")

    So_p = SPut / fos
    So_g = SGut / fos

    if (So_p * Yp) < (So_g * Yg):
        weaker_member = "pinion"
        y, n, z, So = Yp, Np, zp, So_p
    else:
        weaker_member = "gear"
        y, n, z, So = Yg, Ng, zg, So_g

    # Keep both torque calculations as in your original program.
    Tp = Cs * ((60e6 * Power) / (2 * math.pi * Np))
    T_design = Cs * ((60e6 * Power) / (2 * math.pi * n))

    m_calc = calculate_module(T_design, So, y, z, n, x)
    module = select_standard_module(m_calc)

    state = {
        "gear_type": "spur",
        "weaker_member": weaker_member,
        "power": Power,
        "pinion_rpm": Np,
        "gear_rpm": Ng,
        "gear_ratio": i,
        "pressure_angle": fi,
        "service_factor": Cs,
        "factor_of_safety": fos,
        "gear_system": values["gear_system"],
        "pinion_modulus": Ep,
        "gear_modulus": Eg,
        "pinion_strength": SPut,
        "gear_strength": SGut,
        "allowable_pinion_stress": So_p,
        "allowable_gear_stress": So_g,
        "pinion_lewis_factor": Yp,
        "gear_lewis_factor": Yg,
        "pinion_teeth": zp,
        "gear_teeth": zg,
        "pinion_torque": Tp,
        "design_torque": T_design,
        "face_width_factor": x,
        "bhn": BHN,
        "required_module": m_calc,
        "module": module,
        "module_index": MODULE_STANDARDS.index(module)
    }

    return run_checks(state)


def continue_spur_design(state, choice, value=None):
    """Apply the user's chosen option and rerun the safety checks."""
    if state.get("gear_type") != "spur":
        raise ValueError("This state is not a spur gear design.")

    if state.get("status") != "needs_user_choice":
        raise ValueError("This design is not waiting for a user choice.")

    if choice == 1:
        if state["face_width_factor"] >= 15:
            raise ValueError("The face-width factor has already reached 15.")

        if value is None:
            raise ValueError("Enter a new face-width factor.")

        try:
            new_x = float(value)
        except (TypeError, ValueError):
            raise ValueError("The new face-width factor must be a number.")

        if not math.isfinite(new_x):
            raise ValueError("The new face-width factor must be finite.")

        if not state["face_width_factor"] < new_x <= 15:
            raise ValueError(
                "The new face-width factor must be higher than the current "
                "value and no greater than 15."
            )

        state["face_width_factor"] = new_x

        # Recalculate the required module after changing x.
        y = (
            state["pinion_lewis_factor"]
            if state["weaker_member"] == "pinion"
            else state["gear_lewis_factor"]
        )
        z = (
            state["pinion_teeth"]
            if state["weaker_member"] == "pinion"
            else state["gear_teeth"]
        )
        n = (
            state["pinion_rpm"]
            if state["weaker_member"] == "pinion"
            else state["gear_rpm"]
        )
        So = (
            state["allowable_pinion_stress"]
            if state["weaker_member"] == "pinion"
            else state["allowable_gear_stress"]
        )

        state["required_module"] = calculate_module(
            state["design_torque"], So, y, z, n, new_x
        )
        state["module"] = select_standard_module(state["required_module"])
        state["module_index"] = MODULE_STANDARDS.index(state["module"])

    elif choice == 2:
        if state["face_width_factor"] < 15:
            raise ValueError(
                "Increase the face-width factor before choosing option 2."
            )

        if state["bhn"] >= 400:
            raise ValueError("BHN has already reached 400.")

        if value is None:
            raise ValueError("Enter a new BHN.")

        try:
            new_bhn = float(value)
        except (TypeError, ValueError):
            raise ValueError("BHN must be a number.")

        if not math.isfinite(new_bhn):
            raise ValueError("BHN must be finite.")

        if not state["bhn"] < new_bhn <= 400:
            raise ValueError(
                "The new BHN must be higher than the current value "
                "and no greater than 400."
            )

        if 2.8 * new_bhn - 70 <= 0:
            raise ValueError("This BHN makes the wear formula invalid.")

        state["bhn"] = new_bhn

    elif choice == 3:
        if state["face_width_factor"] < 15 or state["bhn"] < 400:
            raise ValueError(
                "Option 3 is available only after x=15 and BHN=400."
            )

        next_index = state["module_index"] + 1

        if next_index >= len(MODULE_STANDARDS):
            raise ValueError("There is no larger standard module available.")

        state["module_index"] = next_index
        state["module"] = MODULE_STANDARDS[next_index]

    else:
        raise ValueError("Choose option 1, 2, or 3.")

    return run_checks(state)
