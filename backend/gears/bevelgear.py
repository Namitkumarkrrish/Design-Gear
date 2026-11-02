"""
STRAIGHT BEVEL GEAR DESIGN (backend / API version)
==================================================
Follows the step-by-step procedure of "Bevel Gear Design - Problem 1":

    Step 1  number of teeth
    Step 2  pitch cone angles
    Step 3  virtual teeth and Lewis form factors
    Step 4  weaker wheel
    Step 5  design torque
    Step 6  module by iteration (Cv, beta)
    Step 7  wheel dimensions
    Step 8  dynamic load
    Step 9  beam strength and wear checks

The calculation functions below are taken from the original command-line
script (bevelgear.py).  Only the console input/output was replaced by
start_bevel_design() / continue_bevel_design(), which use the same
state / results / checks / options format as spurgearfinal.py and
helicalgear.py.  The 3D model lives in gear_model_generator.py.
"""
import math
from copy import deepcopy


# ----------------------------------------------------------------------------
# CONSTANTS
# ----------------------------------------------------------------------------
WEAR_FOS = 1.5          # Fw >= 1.5 Fd  (Step 9)
MAX_BHN = 400.0
MIN_BHN = 25.0
MAX_FACE_WIDTH_FACTOR = 15.0
RHO = 7.83e-6           # steel density, kg/mm^3

# Standard module series (mm)
M_STANDARD = [1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0,
              7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 14.0, 16.0, 18.0, 20.0,
              22.0, 25.0, 28.0, 32.0, 36.0, 40.0, 45.0, 50.0]

# Tooth systems.  Lewis form factor:  Y = A - B / z'   (z' = virtual teeth)
SYSTEMS = {
    "20fdi":   dict(phi=20.0, ha=1.0, hf=1.25, A=0.484, B=3.28),
    "20stub":  dict(phi=20.0, ha=0.8, hf=1.00, A=0.550, B=2.64),
    "14.5fdi": dict(phi=14.5, ha=1.0, hf=1.25, A=0.390, B=2.15),
}

# Profile pitch error classes: eps_p = eps_g = a + b*sqrt(pi*m)  [micro-m]
ERROR_CLASS = {"it7": (8.0, 3.55), "it8": (12.0, 5.0), "it9": (17.0, 7.1)}


# ----------------------------------------------------------------------------
# INPUT HANDLING
# ----------------------------------------------------------------------------
def _number(data, key, default=None):
    value = data.get(key, default)

    if value is None or value == "":
        raise ValueError(f"Missing required input: {key}")

    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{key} must be numeric.")

    if not math.isfinite(value):
        raise ValueError(f"{key} must be a finite number.")

    return value


def read_bore_inputs(data):
    """Read optional bore diameters (mm). 0 or missing means no bore."""
    bores = {}

    for key in ("pinion_bore", "gear_bore"):
        raw = data.get(key, 0)

        if raw in (None, ""):
            raw = 0

        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise ValueError(f"{key} must be numeric.")

        if not math.isfinite(value) or value < 0:
            raise ValueError(f"{key} must be zero or a positive number.")

        bores[key] = value

    return bores


def validate_inputs(data):
    """Validate the request and return a clean dictionary of values."""
    required = [
        "power", "pinion_rpm", "gear_ratio",
        "pinion_strength", "gear_strength",
        "service_factor", "factor_of_safety",
        "face_width_factor", "bhn",
        "pinion_modulus", "gear_modulus",
    ]

    for key in required:
        if key not in data:
            raise ValueError(f"Missing required input: {key}")

    v = {key: _number(data, key) for key in required}

    for key in ("power", "pinion_rpm", "pinion_strength", "gear_strength",
                "pinion_modulus", "gear_modulus", "face_width_factor"):
        if v[key] <= 0:
            raise ValueError(f"{key} must be greater than zero.")

    if v["gear_ratio"] < 1:
        raise ValueError("Gear ratio must be at least 1.")

    if v["service_factor"] < 1:
        raise ValueError("Service factor must be at least 1.")

    if v["factor_of_safety"] < 1:
        raise ValueError("Factor of safety must be at least 1.")

    if v["face_width_factor"] > MAX_FACE_WIDTH_FACTOR:
        raise ValueError(
            f"Face-width factor must not exceed {MAX_FACE_WIDTH_FACTOR:g}."
        )

    if not MIN_BHN < v["bhn"] <= MAX_BHN:
        raise ValueError(
            f"BHN must be greater than {MIN_BHN:g} and at most {MAX_BHN:g}."
        )

    # Shaft angle (default 90 deg, allowed 30-90 as in the original script)
    v["shaft_angle"] = _number(data, "shaft_angle", 90.0)
    if not 30.0 <= v["shaft_angle"] <= 90.0:
        raise ValueError("Shaft angle must be between 30 and 90 degrees.")

    # Loading factor Cw (default 1.0)
    v["loading_factor"] = _number(data, "loading_factor", 1.0)
    if v["loading_factor"] <= 0:
        raise ValueError("Loading factor Cw must be greater than zero.")

    system = data.get("gear_system", "20fdi")
    if system not in SYSTEMS:
        raise ValueError("Unsupported gear system.")
    v["gear_system"] = system

    err_class = str(data.get("accuracy_class", "it7")).lower()
    if err_class not in ERROR_CLASS:
        raise ValueError("Accuracy class must be one of: it7, it8, it9.")
    v["accuracy_class"] = err_class

    # Pinion teeth: optional, defaults to the minimum that avoids undercut
    s = SYSTEMS[system]
    zmin = math.ceil(2 * s["ha"] / math.sin(math.radians(s["phi"])) ** 2)
    raw_zp = data.get("pinion_teeth")

    if raw_zp in (None, "", 0):
        zp = zmin
    else:
        zp_float = _number(data, "pinion_teeth")
        if abs(zp_float - round(zp_float)) > 1e-9:
            raise ValueError("Number of pinion teeth must be a whole number.")
        zp = int(round(zp_float))

    if zp < 5:
        raise ValueError("Pinion must have at least 5 teeth.")
    v["pinion_teeth"] = zp

    return v


# ----------------------------------------------------------------------------
# DESIGN FUNCTIONS (from the original script)
# ----------------------------------------------------------------------------
def pitch_cone_angles(i, sigma_deg):
    """Step 2.  For 90 deg: gamma_p = atan(1/i), gamma_g = atan(i)."""
    s = math.radians(sigma_deg)
    gp = math.atan2(math.sin(s), i + math.cos(s))
    return gp, s - gp


def design_module(T, So, Y, z_w, x, zp, n_p, gp, Cw):
    """Step 6: m = cuberoot( 2 T Cw / (So Cv x Y z beta) ), iterated on Cv, beta.
    T, Y, z_w, So belong to the weaker wheel.  Returns (m, table_rows)."""
    K = 2.0 * T * Cw / (So * x * Y * z_w)
    Cv, beta = 0.5, 0.75                       # initial assumption
    m = (K / (Cv * beta)) ** (1 / 3)
    V = math.pi * m * zp * n_p / 60000.0
    rows = [(1, None, None, beta, Cv, m, V)]
    for it in range(2, 60):
        b = x * m
        rp = m * zp / (2 * math.sin(gp))
        beta = 1 - b / rp
        if beta <= 0:
            raise ValueError("beta <= 0: face width factor x is too large "
                             "for this cone angle / pinion teeth.")
        Cv = 5.5 / (5.5 + math.sqrt(V))
        m_new = (K / (Cv * beta)) ** (1 / 3)
        V = math.pi * m_new * zp * n_p / 60000.0
        rows.append((it, b, rp, beta, Cv, m_new, V))
        if abs(m_new - m) < 1e-3:
            m = m_new
            break
        m = m_new
    return m, rows


def select_standard(m):
    for s in M_STANDARD:
        if m <= s + 1e-9:
            return s
    return M_STANDARD[-1]


def next_standard(m):
    for s in M_STANDARD:
        if s > m + 1e-9:
            return s
    return None


def geometry(m, D):
    """Step 7: other wheel dimensions."""
    gp, gg, zp, zg, x = D["gp"], D["gg"], D["zp"], D["zg"], D["x"]
    g = {}
    g["Dp"], g["Dg"] = m * zp, m * zg
    g["b"] = x * m
    g["A0"] = g["Dp"] / (2 * math.sin(gp))                 # cone distance
    g["Sp"] = g["Dp"] - 2 * g["b"] * math.sin(gp)          # small-end pitch dia
    g["Sg"] = g["Dg"] - 2 * g["b"] * math.sin(gg)
    g["bap"], g["bag"] = g["b"] * math.cos(gp), g["b"] * math.cos(gg)
    g["Hp"] = g["Dp"] / (2 * math.tan(gp))                 # apex distance
    g["Hg"] = g["Dg"] / (2 * math.tan(gg)) if abs(math.tan(gg)) > 1e-12 else 0.0
    g["rbp"] = g["Dp"] / (2 * math.cos(gp))                # back-cone radii
    g["rbg"] = g["Dg"] / (2 * math.cos(gg))
    g["beta"] = 1 - g["b"] / g["A0"]
    if g["beta"] <= 0:
        raise ValueError("beta <= 0: face width is larger than the cone "
                         "distance. Reduce the face-width factor.")
    g["V"] = math.pi * g["Dp"] * D["n_p"] / 60000.0        # m/s
    g["Cv"] = 5.5 / (5.5 + math.sqrt(g["V"]))
    return g


def dynamic_load(m, g, Ft, D):
    """Step 8: Fd = Ft + Fi  (asymptotic-acceleration method used in the notes)."""
    phi = math.radians(D["phi"])
    # equivalent masses (pitch circular mass)
    mp = math.pi / 8 * ((g["Dp"] + g["Sp"]) / 2) ** 2 * g["bap"] * RHO
    mg = math.pi / 8 * ((g["Dg"] + g["Sg"]) / 2) ** 2 * g["bag"] * RHO
    M = mp * mg / (mp + mg)
    # equivalent acceleration factor G  [1/mm]
    G = (math.tan(phi) * (1 - math.cos(phi)) / phi ** 2) * (1 / g["rbp"] + 1 / g["rbg"])
    V_mm = g["V"] * 1000.0
    F1 = 2 * G * M * V_mm ** 2 / 1000.0                   # rigid-body force, N
    # tooth stiffness & pitch error
    k = g["b"] / (9 * (1 / D["Ep"] + 1 / D["Eg"]))         # N/mm
    a, c = ERROR_CLASS[D["err_class"]]
    eps_each = a + c * math.sqrt(math.pi * m)              # micro-m
    eps = 2 * eps_each / 1000.0                            # mm (pinion + gear)
    F2 = k * eps + Ft
    Fa = F1 * F2 / (F1 + F2)
    Fi = math.sqrt(Fa * (2 * F2 - Fa))
    return dict(mp=mp, mg=mg, M=M, G=G, F1=F1, k=k, eps_each=eps_each, eps=eps,
                F2=F2, Fa=Fa, Fi=Fi, Fd=Ft + Fi)


def evaluate(m, D, BHN):
    """Steps 7-9 for a given standard module and BHN."""
    g = geometry(m, D)
    Ft = 2 * D["Tp"] / g["Dp"]
    dyn = dynamic_load(m, g, Ft, D)
    Fd = dyn["Fd"]

    # bending (beam strength of the weaker wheel) vs dynamic load
    Sb = D["So_w"] * g["b"] * m * D["Y_w"] * g["beta"]
    bending_ok = Sb >= Fd

    # wear (Step 9)
    gp, phi = D["gp"], math.radians(D["phi"])
    Q = 2 * D["zvg"] / (D["zvg"] + D["zvp"])
    Ecomb = 1 / D["Ep"] + 1 / D["Eg"]
    k_req = WEAR_FOS * Fd * math.cos(gp) / (g["Dp"] * g["b"] * Q)
    Senc_req = math.sqrt(k_req * 1.4 / (math.sin(phi) * Ecomb))
    BHN_req = (Senc_req + 70) / 2.8
    Senc = 2.8 * BHN - 70
    k_av = max(Senc, 0) ** 2 * math.sin(phi) / 1.4 * Ecomb
    Fw = g["Dp"] * g["b"] * k_av * Q / math.cos(gp)
    wear_ok = Fw >= WEAR_FOS * Fd
    return dict(g=g, Ft=Ft, dyn=dyn, Fd=Fd, Sb=Sb, bending_ok=bending_ok,
                Q=Q, k_req=k_req, Senc_req=Senc_req, BHN_req=BHN_req,
                Senc=Senc, k_av=k_av, Fw=Fw, wear_ok=wear_ok, m=m, BHN=BHN)


def bore_limits(m, z, gamma, sysd, b):
    """Root diameter at the small end and the largest bore the CAD model
    accepts (0.8 x root diameter, same rule as the original script)."""
    rp = m * z / 2.0
    beta = 1 - b / (rp / math.sin(gamma))
    root_small = 2 * (rp - sysd["hf"] * m) * beta
    return root_small, 0.8 * root_small


# ----------------------------------------------------------------------------
# STATE <-> D  (the dictionary used by the original functions)
# ----------------------------------------------------------------------------
def _design_dict(state):
    """Rebuild the 'D' dictionary of the original script from the state."""
    return dict(
        sigma=state["shaft_angle"],
        phi=state["pressure_angle"],
        zp=state["pinion_teeth"],
        zg=state["gear_teeth"],
        x=state["face_width_factor"],
        n_p=state["pinion_rpm"],
        gp=math.radians(state["pinion_cone_angle"]),
        gg=math.radians(state["gear_cone_angle"]),
        zvp=state["pinion_virtual_teeth"],
        zvg=state["gear_virtual_teeth"],
        So_w=state["weaker_allowable_stress"],
        Y_w=state["weaker_lewis_factor"],
        Tp=state["pinion_torque"],
        Ep=state["pinion_modulus"],
        Eg=state["gear_modulus"],
        err_class=state["accuracy_class"],
    )


def available_options(state):
    """Adjustments offered when a check fails (same two as the original
    script: harder material, or the next standard module)."""
    options = []

    if state["bhn"] < MAX_BHN:
        options.append({
            "id": 1,
            "label": "Increase BHN and re-evaluate wear strength",
            "current_bhn": state["bhn"],
            "minimum": state["bhn"],
            "maximum": MAX_BHN,
        })

    nxt = next_standard(state["module"])
    if nxt is not None:
        options.append({
            "id": 2,
            "label": "Increase module to the next standard size",
            "next_module": nxt,
        })

    return options


def run_checks(state):
    state = deepcopy(state)

    m = float(state["module"])
    D = _design_dict(state)
    sysd = SYSTEMS[state["gear_system"]]

    # As in the original script: if beam strength fails, the module is
    # raised automatically until it passes (or the series ends).
    while True:
        R = evaluate(m, D, state["bhn"])
        if R["bending_ok"]:
            break
        nm = next_standard(m)
        if nm is None:
            break
        m = nm

    state["module"] = m

    g, dyn = R["g"], R["dyn"]

    warnings = []
    if g["b"] > g["A0"] / 3:
        warnings.append(
            f"Face width ({g['b']:.2f} mm) is larger than one third of the "
            f"cone distance ({g['A0'] / 3:.2f} mm), the usual limit."
        )
    zmin = 2 * sysd["ha"] / math.sin(math.radians(sysd["phi"])) ** 2
    if D["zvp"] < zmin:
        warnings.append(
            f"Virtual pinion teeth z'p = {D['zvp']:.2f} is below {zmin:.1f}: "
            "undercutting of the pinion teeth is likely."
        )

    _, max_pinion_bore = bore_limits(m, D["zp"], D["gp"], sysd, g["b"])
    _, max_gear_bore = bore_limits(m, D["zg"], D["gg"], sysd, g["b"])

    bending_safe = R["bending_ok"]
    wear_safe = R["wear_ok"]
    all_safe = bending_safe and wear_safe

    results = {
        "module": m,
        "required_module": state["required_module"],
        "pinion_teeth": D["zp"],
        "gear_teeth": D["zg"],
        "shaft_angle": state["shaft_angle"],
        "pressure_angle": state["pressure_angle"],
        "pinion_cone_angle": state["pinion_cone_angle"],
        "gear_cone_angle": state["gear_cone_angle"],
        "pinion_virtual_teeth": D["zvp"],
        "gear_virtual_teeth": D["zvg"],
        "pinion_lewis_factor": state["pinion_lewis_factor"],
        "gear_lewis_factor": state["gear_lewis_factor"],
        "pinion_pitch_diameter": g["Dp"],
        "gear_pitch_diameter": g["Dg"],
        "face_width": g["b"],
        "face_width_factor": D["x"],
        "cone_distance": g["A0"],
        "pinion_small_end_diameter": g["Sp"],
        "gear_small_end_diameter": g["Sg"],
        "pinion_apex_distance": g["Hp"],
        "gear_apex_distance": g["Hg"],
        "beta": g["beta"],
        "velocity": g["V"],
        "velocity_factor": g["Cv"],
        "tangential_force": R["Ft"],
        "dynamic_force": R["Fd"],
        "beam_strength": R["Sb"],
        "bending_factor_of_safety": R["Sb"] / R["Fd"],
        "required_bhn": R["BHN_req"],
        "bhn": R["BHN"],
        "surface_endurance_limit": R["Senc"],
        "required_surface_endurance_limit": R["Senc_req"],
        "wear_factor_k": R["k_av"],
        "required_wear_factor_k": R["k_req"],
        "actual_wear_force": R["Fw"],
        "required_wear_force": WEAR_FOS * R["Fd"],
        "pinion_torque": state["pinion_torque"],
        "design_torque": state["design_torque"],
        "max_pinion_bore": max_pinion_bore,
        "max_gear_bore": max_gear_bore,
        "weaker_member": state["weaker_member"],
        "warnings": warnings,
    }

    checks = {
        "bending_safe": bending_safe,
        "wear_safe": wear_safe,
        "all_safe": all_safe,
    }

    state["results"] = results
    state["checks"] = checks

    if all_safe:
        state["status"] = "success"
        state["message"] = "All implemented design checks passed."
        state["options"] = []
        return state

    state["options"] = available_options(state)

    if state["options"]:
        state["status"] = "needs_user_choice"
        if not wear_safe and bending_safe and state["bhn"] >= MAX_BHN:
            state["message"] = (
                "Maximum BHN value (400) reached, but the wear check still "
                "fails. Please select a different option."
            )
        else:
            state["message"] = (
                "A design check failed. Choose a remediation option."
            )
    else:
        state["status"] = "failed"
        state["message"] = (
            "The design checks still fail at the available limits."
        )

    return state


# ----------------------------------------------------------------------------
# PUBLIC API  (Steps 1-6, then run_checks does Steps 7-9)
# ----------------------------------------------------------------------------
def start_bevel_design(data):
    v = validate_inputs(data)
    bores = read_bore_inputs(data)
    sysd = SYSTEMS[v["gear_system"]]

    zp = v["pinion_teeth"]

    # Step 1: number of teeth
    zg = int(round(v["gear_ratio"] * zp))
    ratio = zg / zp

    # Step 2: pitch cone angles
    gp, gg = pitch_cone_angles(ratio, v["shaft_angle"])

    # Step 3: virtual teeth and form factors
    zvp = zp / math.cos(gp)
    zvg = zg / math.cos(gg)
    yp = sysd["A"] - sysd["B"] / zvp
    yg = sysd["A"] - sysd["B"] / zvg

    if yp <= 0 or yg <= 0:
        raise ValueError(
            "Calculated Lewis factor is not positive. "
            "Increase the number of pinion teeth."
        )

    # Step 4: weaker wheel
    sop = v["pinion_strength"] / v["factor_of_safety"]
    sog = v["gear_strength"] / v["factor_of_safety"]

    # Step 5: design torque
    pinion_torque = (
        v["service_factor"] * 60e6 * v["power"]
        / (2 * math.pi * v["pinion_rpm"])
    )

    if sop * yp <= sog * yg:
        weaker = "pinion"
        so_w, y_w, z_w, t_w = sop, yp, zp, pinion_torque
    else:
        weaker = "gear"
        so_w, y_w, z_w, t_w = sog, yg, zg, pinion_torque * ratio

    # Step 6: module by iteration
    m_calc, rows = design_module(
        t_w, so_w, y_w, z_w,
        v["face_width_factor"], zp, v["pinion_rpm"], gp,
        v["loading_factor"],
    )
    module = select_standard(m_calc)

    state = {
        "gear_type": "bevel",
        "status": "calculating",
        "pinion_bore": bores["pinion_bore"],
        "gear_bore": bores["gear_bore"],
        "power": v["power"],
        "pinion_rpm": v["pinion_rpm"],
        "gear_rpm": v["pinion_rpm"] / ratio,
        "gear_ratio": ratio,
        "requested_gear_ratio": v["gear_ratio"],
        "shaft_angle": v["shaft_angle"],
        "gear_system": v["gear_system"],
        "pressure_angle": sysd["phi"],
        "accuracy_class": v["accuracy_class"],
        "pinion_strength": v["pinion_strength"],
        "gear_strength": v["gear_strength"],
        "service_factor": v["service_factor"],
        "factor_of_safety": v["factor_of_safety"],
        "loading_factor": v["loading_factor"],
        "pinion_modulus": v["pinion_modulus"],
        "gear_modulus": v["gear_modulus"],
        "face_width_factor": v["face_width_factor"],
        "bhn": v["bhn"],
        "weaker_member": weaker,
        "pinion_teeth": zp,
        "gear_teeth": zg,
        "pinion_cone_angle": math.degrees(gp),
        "gear_cone_angle": math.degrees(gg),
        "pinion_virtual_teeth": zvp,
        "gear_virtual_teeth": zvg,
        "pinion_lewis_factor": yp,
        "gear_lewis_factor": yg,
        "allowable_pinion_stress": sop,
        "allowable_gear_stress": sog,
        "weaker_allowable_stress": so_w,
        "weaker_lewis_factor": y_w,
        "pinion_torque": pinion_torque,
        "design_torque": t_w,
        "required_module": m_calc,
        "module": module,
        "module_iterations": [
            {"iteration": it, "face_width": b, "cone_distance": rp,
             "beta": beta, "velocity_factor": cv, "module": mm, "velocity": vel}
            for it, b, rp, beta, cv, mm, vel in rows
        ],
    }

    return run_checks(state)


def continue_bevel_design(state, choice, value=None):
    state = deepcopy(state)

    if state.get("gear_type") != "bevel":
        raise ValueError("This state is not a bevel gear design.")

    if state.get("status") != "needs_user_choice":
        raise ValueError("This design is not waiting for a choice.")

    available = {option["id"] for option in available_options(state)}

    if choice not in available:
        raise ValueError(
            "This adjustment is not currently available. "
            "Choose one of the listed options."
        )

    if choice == 1:
        if value is None:
            raise ValueError("Enter a new BHN value.")

        try:
            new_bhn = float(value)
        except (TypeError, ValueError):
            raise ValueError("BHN must be numeric.")

        if not math.isfinite(new_bhn):
            raise ValueError("BHN must be finite.")

        if not state["bhn"] < new_bhn <= MAX_BHN:
            raise ValueError(
                f"BHN must be greater than {state['bhn']:g} "
                f"and at most {MAX_BHN:g}."
            )

        state["bhn"] = new_bhn

    elif choice == 2:
        nxt = next_standard(state["module"])
        if nxt is None:
            raise ValueError("There is no higher standard module available.")
        state["module"] = nxt

    return run_checks(state)
