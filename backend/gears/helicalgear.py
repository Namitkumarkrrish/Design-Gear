
import math
from copy import deepcopy


MODULE_STANDARDS = [
    1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0,
    6.0, 8.0, 10.0, 12.0, 16.0, 20.0, 25.0,
    32.0, 40.0, 50.0
]

MAX_BHN = 400.0
MIN_BHN = 25.0


def validate_inputs(data):
    required = [
        "power", "gear_ratio", "pinion_rpm",
        "pressure_angle", "helix_angle",
        "pinion_strength", "gear_strength",
        "service_factor", "wear_factor",
        "factor_of_safety", "pinion_modulus",
        "gear_modulus", "face_width_factor"
    ]

    missing = [key for key in required if key not in data]
    if missing:
        raise ValueError("Missing inputs: " + ", ".join(missing))

    values = {}

    for key in required:
        try:
            values[key] = float(data[key])
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be a number.")

        if not math.isfinite(values[key]):
            raise ValueError(f"{key} must be finite.")

        if values[key] <= 0:
            raise ValueError(f"{key} must be greater than zero.")

    if values["gear_ratio"] <= 1:
        raise ValueError("gear_ratio must be greater than 1.")

    if values["pressure_angle"] >= 89:
        raise ValueError("pressure_angle must be below 89 degrees.")

    if values["helix_angle"] >= 89:
        raise ValueError("helix_angle must be below 89 degrees.")

    if values["service_factor"] < 1:
        raise ValueError("service_factor must be at least 1.")

    if values["wear_factor"] < 1:
        raise ValueError("wear_factor must be at least 1.")

    if not 1 <= values["factor_of_safety"] <= 10:
        raise ValueError("factor_of_safety must be between 1 and 10.")

    if not 1 <= values["face_width_factor"] <= 15:
        raise ValueError("face_width_factor must be between 1 and 15.")

    return values


def calculate_module(T, So, y, z, n, x):
    denominator = So * x * y * z

    if denominator <= 0:
        raise ValueError("Invalid design strength.")

    r = (2 * T) / denominator
    r1 = (math.pi * z * n) / 60000

    mo = (r / 0.5) ** (1 / 3)
    velocity = r1 * mo
    Cv = 5.5 / (5.5 + math.sqrt(velocity))

    for _ in range(200):
        m1 = (r / Cv) ** (1 / 3)
        velocity1 = r1 * m1
        Cv1 = 5.5 / (5.5 + math.sqrt(velocity1))

        if round(m1, 3) == round(mo, 3):
            return m1

        mo = m1
        Cv = Cv1

    return mo


def select_standard_module(required_module, helix_angle):
    mn_required = required_module * math.cos(helix_angle)

    for mn in MODULE_STANDARDS:
        if mn >= mn_required:
            return mn / math.cos(helix_angle), mn

    raise ValueError(
        "Required normal module exceeds the largest standard module."
    )


def face_width_factor_check(x, module, normal_module, helix_angle):
    b = x * module
    b_min = (math.pi * normal_module) / math.sin(helix_angle)
    return b >= b_min


def calculate_geometry(module, zp_virtual, zg_virtual, x, rpm, helix_angle):
    dp = module * zp_virtual
    dg = module * zg_virtual
    b = module * x
    velocity = (math.pi * dp * rpm) / 60000
    cv = 5.5 / (5.5 + math.sqrt(velocity))

    return dp, dg, b, velocity, cv


def bending_check(T, D, b, module, y, So, cv):
    ft = (2 * T) / D
    fd = ft / cv
    sb = So * y * b * module
    fos_calc = sb / fd

    return fos_calc >= 1.20, ft, fd, sb, fos_calc


def wear_check(fd, D, b, zp_virtual, zg_virtual, Ep, Eg, helix_angle):
    q = (2 * zg_virtual) / (zg_virtual + zp_virtual)
    fw_required = 1.20 * fd
    k = fw_required / (D * b * q)

    elastic_term = (1 / Ep) + (1 / Eg)
    sin_term = math.sin(helix_angle)

    senc = math.sqrt((1.4 * k) / (sin_term * elastic_term))
    required_bhn = (senc + 70) / 2.8

    return required_bhn, fw_required, k, senc


def actual_wear_strength(
    bhn, D, b, zp_virtual, zg_virtual, Ep, Eg, helix_angle
):
    q = (2 * zg_virtual) / (zg_virtual + zp_virtual)
    senc = 2.8 * bhn - 70
    elastic_term = (1 / Ep) + (1 / Eg)

    k = (
        senc ** 2
        * math.sin(helix_angle)
        * elastic_term
        / 1.4
    )

    fw = D * b * q * k

    return fw, k, senc


def available_options(state):
    options = []

    if state["face_width_factor"] < 15:
        options.append({
            "id": 1,
            "label": "Increase face-width factor",
            "minimum": state["face_width_factor"] + 1,
            "maximum": 15
        })

    # Keep offering a BHN adjustment while below the maximum.
    # The user chooses the next BHN; the backend validates it.
    if state["bhn"] < MAX_BHN:
        options.append({
            "id": 2,
            "label": "Increase BHN and re-evaluate wear strength",
            "current_bhn": state["bhn"],
            "minimum": state["bhn"],
            "maximum": MAX_BHN,
            "value": MAX_BHN
        })

    if state["module_index"] + 1 < len(MODULE_STANDARDS):
        options.append({
            "id": 3,
            "label": "Increase module to the next standard size",
            "next_module": MODULE_STANDARDS[state["module_index"] + 1]
        })

    return options


def run_checks(state):
    state = deepcopy(state)

    x = state["face_width_factor"]
    module = state["module"]
    mn = state["normal_module"]
    beta = math.radians(state["helix_angle"])

    dp, dg, b, velocity, cv = calculate_geometry(
        module,
        state["pinion_virtual_teeth"],
        state["gear_virtual_teeth"],
        x,
        state["pinion_rpm"],
        beta
    )

    if state["weaker_member"] == "pinion":
        D = dp
        y = state["pinion_lewis_factor"]
        So = state["allowable_pinion_stress"]
    else:
        D = dg
        y = state["gear_lewis_factor"]
        So = state["allowable_gear_stress"]

    bending_safe, ft, fd, sb, fos_calc = bending_check(
        state["design_torque"], D, b, module, y, So, cv
    )

    required_bhn, fw_required, required_k, required_senc = wear_check(
        fd,
        D,
        b,
        state["pinion_virtual_teeth"],
        state["gear_virtual_teeth"],
        state["pinion_modulus"],
        state["gear_modulus"],
        beta
    )

    bhn = state["bhn"]

    actual_fw, actual_k, actual_senc = actual_wear_strength(
        bhn,
        D,
        b,
        state["pinion_virtual_teeth"],
        state["gear_virtual_teeth"],
        state["pinion_modulus"],
        state["gear_modulus"],
        beta
    )

    wear_safe = actual_fw >= fw_required
    width_safe = face_width_factor_check(x, module, mn, beta)

    state["results"] = {
        "normal_module": mn,
        "module": module,
        "required_module": state["required_module"],
        "pinion_teeth": state["pinion_teeth"],
        "gear_teeth": state["gear_teeth"],
        "pinion_virtual_teeth": state["pinion_virtual_teeth"],
        "gear_virtual_teeth": state["gear_virtual_teeth"],
        "pinion_pitch_diameter": dp,
        "gear_pitch_diameter": dg,
        "face_width": b,
        "minimum_face_width": math.pi * mn / math.sin(beta),
        "velocity": velocity,
        "velocity_factor": cv,
        "tangential_force": ft,
        "dynamic_force": fd,
        "beam_strength": sb,
        "bending_factor_of_safety": fos_calc,
        "required_bhn": required_bhn,
        "bhn": bhn,
        "required_wear_force": fw_required,
        "actual_wear_force": actual_fw,
        "wear_factor_k": actual_k,
        "surface_endurance_limit": actual_senc,
        "design_torque": state["design_torque"],
        "pinion_torque": state["pinion_torque"],
        "helix_angle": state["helix_angle"],
        "pressure_angle": state["pressure_angle"]
    }

    state["checks"] = {
        "face_width_safe": width_safe,
        "bending_safe": bending_safe,
        "wear_safe": wear_safe,
        "all_safe": width_safe and bending_safe and wear_safe
    }

    if state["checks"]["all_safe"]:
        state["status"] = "success"
        state["message"] = "All implemented design checks passed."
        state["options"] = []
    else:
        state["options"] = available_options(state)

        if state["options"]:
            state["status"] = "needs_user_choice"

            if not wear_safe and state["bhn"] >= MAX_BHN:
                state["message"] = (
                    "Maximum BHN value (400) reached, but the wear check "
                    "still fails. Please select a different option."
                )
            else:
                state["message"] = (
                    "A design check failed. Choose a remediation option."
                )
        else:
            state["status"] = "failed"

            if not wear_safe and state["bhn"] >= MAX_BHN:
                state["message"] = (
                    "Maximum BHN value (400) reached, but the wear check "
                    "still fails. No further BHN increase is available. "
                    "The design checks still fail at the available limits."
                )
            else:
                state["message"] = (
                    "The design checks still fail at the available limits."
                )

    return state


def start_helical_design(data):
    values = validate_inputs(data)

    power = values["power"]
    ratio = values["gear_ratio"]
    rpm = values["pinion_rpm"]
    alpha_deg = values["pressure_angle"]
    beta_deg = values["helix_angle"]
    alpha = math.radians(alpha_deg)
    beta = math.radians(beta_deg)

    zp = math.ceil(2 / (math.sin(alpha) ** 2))
    zg = math.ceil(ratio * zp)

    zp_virtual = zp / (math.cos(beta) ** 3)
    zg_virtual = zg / (math.cos(beta) ** 3)

    yp = 0.484 - 3.28 / zp_virtual
    yg = 0.484 - 3.28 / zg_virtual

    if yp <= 0 or yg <= 0:
        raise ValueError("Calculated Lewis factor is not positive.")

    sop = values["pinion_strength"] / values["factor_of_safety"]
    sog = values["gear_strength"] / values["factor_of_safety"]

    if sop * yp < sog * yg:
        weaker = "pinion"
        y, n, z, so = yp, rpm, zp_virtual, sop
    else:
        weaker = "gear"
        y, n, z, so = yg, rpm / ratio, zg_virtual, sog

    torque = (
        values["wear_factor"]
        * values["service_factor"]
        * (60 * 1_000_000 * power)
        / (2 * math.pi * n)
    )

    pinion_torque = (
        values["service_factor"]
        * (60 * 1_000_000 * power)
        / (2 * math.pi * rpm)
    )

    x = values["face_width_factor"]

    required_module = calculate_module(torque, so, y, z, n, x)
    module, mn = select_standard_module(required_module, beta)

    for _ in range(100):
        if face_width_factor_check(x, module, mn, beta):
            break

        x = math.pi * mn / (module * math.sin(beta))
        required_module = calculate_module(torque, so, y, z, n, x)
        module, mn = select_standard_module(required_module, beta)
    else:
        raise ValueError("Minimum face-width calculation did not converge.")

    module_index = MODULE_STANDARDS.index(mn)

    try:
        initial_bhn = float(data.get("bhn", 250.0))
    except (TypeError, ValueError):
        raise ValueError("bhn must be a number.")

    if not math.isfinite(initial_bhn) or initial_bhn <= MIN_BHN:
        raise ValueError("BHN must be greater than 25.")

    if initial_bhn > MAX_BHN:
        raise ValueError("BHN cannot exceed 400.")

    state = {
        "gear_type": "helical",
        "status": "calculating",
        "power": power,
        "gear_ratio": ratio,
        "pinion_rpm": rpm,
        "gear_rpm": rpm / ratio,
        "pressure_angle": alpha_deg,
        "helix_angle": beta_deg,
        "pinion_strength": values["pinion_strength"],
        "gear_strength": values["gear_strength"],
        "service_factor": values["service_factor"],
        "wear_factor": values["wear_factor"],
        "factor_of_safety": values["factor_of_safety"],
        "pinion_modulus": values["pinion_modulus"],
        "gear_modulus": values["gear_modulus"],
        "face_width_factor": x,
        "bhn": initial_bhn,
        "weaker_member": weaker,
        "pinion_teeth": zp,
        "gear_teeth": zg,
        "pinion_virtual_teeth": zp_virtual,
        "gear_virtual_teeth": zg_virtual,
        "pinion_lewis_factor": yp,
        "gear_lewis_factor": yg,
        "allowable_pinion_stress": sop,
        "allowable_gear_stress": sog,
        "pinion_torque": pinion_torque,
        "design_torque": torque,
        "required_module": required_module,
        "module": module,
        "normal_module": mn,
        "module_index": module_index
    }

    return run_checks(state)


def continue_helical_design(state, choice, value=None):
    state = deepcopy(state)

    if state.get("gear_type") != "helical":
        raise ValueError("This state is not a helical gear design.")

    if state.get("status") != "needs_user_choice":
        raise ValueError("This design is not waiting for a choice.")

    if choice == 1:
        if value is None:
            raise ValueError("Enter a new face-width factor.")

        try:
            new_x = float(value)
        except (TypeError, ValueError):
            raise ValueError("Face-width factor must be numeric.")

        if not math.isfinite(new_x) or not (
            state["face_width_factor"] < new_x <= 15
        ):
            raise ValueError(
                "New face-width factor must be higher than current and at most 15."
            )

        state["face_width_factor"] = new_x

    elif choice == 2:
        if state["bhn"] >= MAX_BHN:
            raise ValueError(
                "Maximum BHN value (400) has been reached. "
                "Please select a different option."
            )

        if value is None:
            raise ValueError(
                f"Enter a BHN greater than {state['bhn']} and at most 400."
            )

        try:
            new_bhn = float(value)
        except (TypeError, ValueError):
            raise ValueError("BHN must be numeric.")

        if not math.isfinite(new_bhn):
            raise ValueError("BHN must be finite.")

        if new_bhn <= state["bhn"]:
            raise ValueError(
                f"New BHN must be greater than the current BHN "
                f"({state['bhn']})."
            )

        if new_bhn > MAX_BHN:
            raise ValueError("Maximum BHN value is 400.")

        if new_bhn <= MIN_BHN:
            raise ValueError("BHN must be greater than 25.")

        # Use the actual value entered by the user.
        state["bhn"] = new_bhn

    elif choice == 3:
        next_index = state["module_index"] + 1

        if next_index >= len(MODULE_STANDARDS):
            raise ValueError("No larger standard normal module is available.")

        beta = math.radians(state["helix_angle"])
        mn = MODULE_STANDARDS[next_index]

        state["normal_module"] = mn
        state["module"] = mn / math.cos(beta)
        state["module_index"] = next_index

    else:
        raise ValueError("Choose option 1, 2, or 3.")

    return run_checks(state)
