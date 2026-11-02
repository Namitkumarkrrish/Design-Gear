
from pathlib import Path
import math

import cadquery as cq
from cq_gears import SpurGear

from .bevelgear import SYSTEMS as BEVEL_SYSTEMS, bore_limits


GENERATED_DIR = Path(__file__).resolve().parent / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def _validate_gear_pair(
    module: float,
    face_width: float,
    pinion_teeth: int,
    gear_teeth: int,
) -> None:
    """Validate the basic dimensions needed for a gear-pair preview."""
    if not math.isfinite(module) or module <= 0:
        raise ValueError("Module must be a positive finite number.")

    if not math.isfinite(face_width) or face_width <= 0:
        raise ValueError("Face width must be a positive finite number.")

    if pinion_teeth < 6 or gear_teeth < 6:
        raise ValueError("At least 6 teeth are required for each gear.")

    if pinion_teeth == gear_teeth:
        # Equal tooth counts are mechanically possible, so no rejection here.
        pass


def _read_bore(state: dict, key: str):
    """Return the bore diameter in mm, or None for a solid gear."""
    raw = state.get(key, 0)

    if raw in (None, ""):
        return None

    value = float(raw)

    if not math.isfinite(value) or value < 0:
        raise ValueError(f"{key} must be zero or a positive number.")

    return value if value > 0 else None


def _position_gear_pair(
    pinion,
    gear,
    module: float,
    pinion_teeth: int,
    gear_teeth: int,
    assembly_name: str,
    pinion_name: str,
    gear_name: str,
    output_filename: str,
) -> str:
    """
    Position and phase a pair of external gears.

    Assumes cq_gears builds both gears around the Z axis and that their
    unrotated tooth profiles share the same angular reference.
    """
    center_distance = module * (pinion_teeth + gear_teeth) / 2.0

    # Rotate the larger gear by half its angular tooth pitch.
    # Tooth pitch = 360 / gear_teeth degrees.
    # Half pitch = 180 / gear_teeth degrees.
    phase_angle = 180.0 / gear_teeth

    gear = gear.rotate(
        (0, 0, 0),
        (0, 0, 1),
        phase_angle,
    )

    assembly = cq.Assembly(name=assembly_name)

    assembly.add(
        pinion,
        name=pinion_name,
        color=cq.Color(0.27, 0.51, 0.71),
    )

    assembly.add(
        gear,
        name=gear_name,
        loc=cq.Location(
            cq.Vector(center_distance, 0, 0)
        ),
        color=cq.Color(0.75, 0.48, 0.20),
    )

    output_path = GENERATED_DIR / output_filename
    assembly.export(str(output_path))

    return str(output_path)


def generate_spur_gear_model(state: dict) -> str:
    """Generate a spur gear pair using cq_gears."""
    if state.get("status") != "success":
        raise ValueError("A successful gear design is required.")

    results = state.get("results", {})

    module_value = results.get("module", state.get("module"))
    if module_value is None:
        raise ValueError("The design state does not contain a module.")

    module = float(module_value)
    pinion_teeth = int(state["pinion_teeth"])
    gear_teeth = int(state["gear_teeth"])
    pressure_angle = float(state["pressure_angle"])
    face_width = float(results["face_width"])

    if not math.isfinite(pressure_angle) or not 0 < pressure_angle < 45:
        raise ValueError("Pressure angle must be between 0 and 45 degrees.")

    _validate_gear_pair(
        module,
        face_width,
        pinion_teeth,
        gear_teeth,
    )

    pinion_bore = _read_bore(state, "pinion_bore")
    gear_bore = _read_bore(state, "gear_bore")

    pinion = SpurGear(
        module=module,
        teeth_number=pinion_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=0.0,
        bore_d=pinion_bore,
    ).build()

    gear = SpurGear(
        module=module,
        teeth_number=gear_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=0.0,
        bore_d=gear_bore,
    ).build()

    return _position_gear_pair(
        pinion=pinion,
        gear=gear,
        module=module,
        pinion_teeth=pinion_teeth,
        gear_teeth=gear_teeth,
        assembly_name="Gear_Design_Studio",
        pinion_name="Pinion",
        gear_name="Gear",
        output_filename="spur_gear_pair.glb",
    )


def generate_helical_gear_model(state: dict) -> str:
    """Generate a helical gear pair using cq_gears.SpurGear."""
    if state.get("status") != "success":
        raise ValueError("A successful helical design is required.")

    if state.get("gear_type") != "helical":
        raise ValueError("Expected a helical gear design state.")

    results = state.get("results", {})

    normal_module_value = results.get(
        "normal_module",
        state.get("normal_module"),
    )

    if normal_module_value is None:
        raise ValueError("The design state does not contain a normal module.")

    normal_module = float(normal_module_value)
    face_width = float(results["face_width"])

    helix_angle_value = results.get(
        "helix_angle",
        state.get("helix_angle"),
    )

    if helix_angle_value is None:
        raise ValueError("The design state does not contain a helix angle.")

    helix_angle = float(helix_angle_value)

    pressure_angle = float(
        results.get(
            "pressure_angle",
            state.get("pressure_angle", 20.0),
        )
    )

    pinion_teeth = int(state["pinion_teeth"])
    gear_teeth = int(state["gear_teeth"])

    if not math.isfinite(normal_module) or normal_module <= 0:
        raise ValueError("Normal module must be positive and finite.")

    if not math.isfinite(face_width) or face_width <= 0:
        raise ValueError("Face width must be positive and finite.")

    if not math.isfinite(helix_angle) or not 0 < abs(helix_angle) < 45:
        raise ValueError("Helix angle must be between 0 and 45 degrees.")

    if not math.isfinite(pressure_angle) or not 0 < pressure_angle < 45:
        raise ValueError("Pressure angle must be between 0 and 45 degrees.")

    _validate_gear_pair(
        normal_module,
        face_width,
        pinion_teeth,
        gear_teeth,
    )

    # Convert normal module to transverse module.
    beta = math.radians(helix_angle)
    transverse_module = normal_module / math.cos(beta)

    pinion_bore = _read_bore(state, "pinion_bore")
    gear_bore = _read_bore(state, "gear_bore")


    # External helical gears require opposite helix hands.
    pinion = SpurGear(
        module=transverse_module,
        teeth_number=pinion_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=helix_angle,
        bore_d=pinion_bore,
    ).build()

    gear = SpurGear(
        module=transverse_module,
        teeth_number=gear_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=-helix_angle,
        bore_d=gear_bore,
    ).build()

    return _position_gear_pair(
        pinion=pinion,
        gear=gear,
        module=transverse_module,
        pinion_teeth=pinion_teeth,
        gear_teeth=gear_teeth,
        assembly_name="Helical_Gear_Design_Studio",
        pinion_name="Helical_Pinion",
        gear_name="Helical_Gear",
        output_filename="helical_gear_pair.glb",
    )


# ----------------------------------------------------------------------------
# STRAIGHT BEVEL GEARS
# (CadQuery wheel construction taken from the original bevelgear.py)
# ----------------------------------------------------------------------------
def _inv(a: float) -> float:
    return math.tan(a) - a


def _bevel_tooth_outline(m, z, phi_deg, ha, hf, n_flank=6):
    """Closed polyline (list of (x, y)) of a complete toothed outline at the
    BIG END of the wheel (involute flanks, tooth 0 centred on +X axis)."""
    phi = math.radians(phi_deg)
    rp = m * z / 2.0
    rb = rp * math.cos(phi)
    ra = rp + ha * m
    rf = rp - hf * m
    pitch = 2 * math.pi / z
    inv_phi = _inv(phi)

    def half(r):  # half tooth angle at radius r
        a = math.acos(min(1.0, rb / r))
        return max(math.pi / (2 * z) + inv_phi - _inv(a), 1e-4)

    r0 = max(rb, rf)
    radii = [r0 + (ra - r0) * j / (n_flank - 1) for j in range(n_flank)]
    pol = lambda r, a: (r * math.cos(a), r * math.sin(a))
    pts = []
    for k in range(z):
        c = k * pitch
        if rf < rb:  # radial run-out below base circle
            pts.append(pol(rf, c - half(rb)))
        for r in radii:
            pts.append(pol(r, c - half(r)))
        pts.append(pol(ra, c))
        for r in reversed(radii):
            pts.append(pol(r, c + half(r)))
        if rf < rb:
            pts.append(pol(rf, c + half(rb)))
        pts.append(pol(rf, c + pitch / 2))  # root land
    return pts


def _make_bevel_wheel(m, z, b, gamma, sysd, bore_d, hub_d, hub_len):
    """One straight bevel wheel.  Local frame: BIG END at z = 0, axis = +Z,
    cone APEX on the axis at z = H (toward +Z).  Teeth are a ruled loft between
    the big-end outline and the same outline scaled by beta at z = b*cos(gamma);
    every flank line therefore passes through the cone apex.

    bore_d = 0 gives a solid wheel (no bore, no hub)."""
    rp = m * z / 2.0
    A0 = rp / math.sin(gamma)
    beta = 1 - b / A0
    face_h = b * math.cos(gamma)
    pts = _bevel_tooth_outline(m, z, sysd["phi"], sysd["ha"], sysd["hf"])
    big = [cq.Vector(x, y, 0.0) for x, y in pts]
    small = [cq.Vector(x * beta, y * beta, face_h) for x, y in pts]
    w1 = cq.Wire.makePolygon(big + [big[0]])
    w2 = cq.Wire.makePolygon(small + [small[0]])
    solid = cq.Solid.makeLoft([w1, w2], True)  # ruled loft
    body = cq.Workplane("XY").newObject([solid])

    if bore_d <= 0:
        return body

    if hub_len > 0:  # hub behind small end
        hub = (cq.Workplane("XY").workplane(offset=face_h - 1.0)
               .circle(hub_d / 2.0).extrude(hub_len + 1.0))
        body = body.union(hub)
    total = face_h + max(hub_len, 0.0) + 2.0
    bore = (cq.Workplane("XY").workplane(offset=-1.0)
            .circle(bore_d / 2.0).extrude(total))
    return body.cut(bore)


def _bevel_bore_and_hub(label, bore, m, z, gamma, sysd, b):
    """Return (bore_d, hub_d, hub_len) using the same rules as the original
    script: bore < 0.8 x root diameter at the small end, hub diameter
    min(1.6 x bore, 0.85 x root), hub length 0.8 x bore."""
    if bore is None:
        return 0.0, 0.0, 0.0

    root_small, max_bore = bore_limits(m, z, gamma, sysd, b)

    if bore >= max_bore:
        raise ValueError(
            f"{label} bore {bore:g} mm is too large. The root diameter at "
            f"the small end is {root_small:.1f} mm, so the bore must be "
            f"smaller than {max_bore:.1f} mm."
        )

    hub_d = min(1.6 * bore, 0.85 * root_small)
    hub_len = float(round(0.8 * bore))
    return bore, hub_d, hub_len


def generate_bevel_gear_model(state: dict) -> str:
    """Generate a straight bevel gear pair (apexes meeting at the origin)."""
    if state.get("status") != "success":
        raise ValueError("A successful bevel design is required.")

    if state.get("gear_type") != "bevel":
        raise ValueError("Expected a bevel gear design state.")

    results = state.get("results", {})

    module = float(results.get("module", state.get("module")))
    face_width = float(results["face_width"])
    zp = int(state["pinion_teeth"])
    zg = int(state["gear_teeth"])
    sigma = float(state["shaft_angle"])
    gamma_p = math.radians(float(state["pinion_cone_angle"]))
    gamma_g = math.radians(float(state["gear_cone_angle"]))

    system = state.get("gear_system", "20fdi")
    if system not in BEVEL_SYSTEMS:
        raise ValueError("Unsupported bevel gear system.")
    sysd = BEVEL_SYSTEMS[system]

    if not math.isfinite(module) or module <= 0:
        raise ValueError("Module must be a positive finite number.")

    if not math.isfinite(face_width) or face_width <= 0:
        raise ValueError("Face width must be a positive finite number.")

    if zp < 5 or zg < 5:
        raise ValueError("At least 5 teeth are required for each wheel.")

    if not 0 < gamma_p < math.pi / 2 or not 0 < gamma_g < math.pi:
        raise ValueError("The pitch cone angles are not valid.")

    pinion_bore = _read_bore(state, "pinion_bore") or 0.0
    gear_bore = _read_bore(state, "gear_bore") or 0.0

    bp = _bevel_bore_and_hub(
        "Pinion", pinion_bore or None, module, zp, gamma_p, sysd, face_width
    )
    bg = _bevel_bore_and_hub(
        "Gear", gear_bore or None, module, zg, gamma_g, sysd, face_width
    )

    pinion = _make_bevel_wheel(module, zp, face_width, gamma_p, sysd, *bp)
    gear = _make_bevel_wheel(module, zg, face_width, gamma_g, sysd, *bg)

    # Apex distances (both cone apexes are placed at the origin).
    hp = module * zp / (2 * math.tan(gamma_p))
    hg = module * zg / (2 * math.tan(gamma_g))

    pinion_placed = pinion.translate((0, 0, -hp))  # axis = Z, body at z < 0

    # Space the gear tooth at the mesh line, then tilt it by the shaft angle.
    phase = 0.0 if zg % 2 == 1 else 180.0 / zg
    gear_placed = (
        gear.rotate((0, 0, 0), (0, 0, 1), phase)
        .translate((0, 0, -hg))
        .rotate((0, 0, 0), (0, 1, 0), -sigma)
    )

    assembly = cq.Assembly(name="Bevel_Gear_Design_Studio")

    assembly.add(
        pinion_placed,
        name="Bevel_Pinion",
        color=cq.Color(0.27, 0.51, 0.71),
    )

    assembly.add(
        gear_placed,
        name="Bevel_Gear",
        color=cq.Color(0.75, 0.48, 0.20),
    )

    output_path = GENERATED_DIR / "bevel_gear_pair.glb"
    assembly.export(str(output_path))

    return str(output_path)
