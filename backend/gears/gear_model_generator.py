
from pathlib import Path
import math

import cadquery as cq
from cq_gears import SpurGear


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

    pinion = SpurGear(
        module=module,
        teeth_number=pinion_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=0.0,
    ).build()

    gear = SpurGear(
        module=module,
        teeth_number=gear_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=0.0,
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

    # External helical gears require opposite helix hands.
    pinion = SpurGear(
        module=transverse_module,
        teeth_number=pinion_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=helix_angle,
    ).build()

    gear = SpurGear(
        module=transverse_module,
        teeth_number=gear_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
        helix_angle=-helix_angle,
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
