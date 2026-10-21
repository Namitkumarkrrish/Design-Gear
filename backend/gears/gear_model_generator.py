
from pathlib import Path
import math

import cadquery as cq
from cq_gears import SpurGear


GENERATED_DIR = Path(__file__).resolve().parent / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def generate_spur_gear_model(state: dict) -> str:
    """Generate a spur gear pair using cq_gears."""
    if state.get("status") != "success":
        raise ValueError("A successful gear design is required.")

    results = state.get("results", {})
    module = float(results.get("module", state.get("module")))
    pinion_teeth = int(state["pinion_teeth"])
    gear_teeth = int(state["gear_teeth"])
    pressure_angle = float(state["pressure_angle"])
    face_width = float(results["face_width"])

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

    center_distance = module * (pinion_teeth + gear_teeth) / 2

    assembly = cq.Assembly(name="Gear_Design_Studio")
    assembly.add(
        pinion,
        name="Pinion",
        color=cq.Color(0.27, 0.51, 0.71),
    )
    assembly.add(
        gear,
        name="Gear",
        loc=cq.Location(cq.Vector(center_distance, 0, 0)),
        color=cq.Color(0.75, 0.48, 0.20),
    )

    output_path = GENERATED_DIR / "spur_gear_pair.glb"
    assembly.export(str(output_path))
    return str(output_path)


def generate_helical_gear_model(state: dict) -> str:
    """Generate a helical gear pair using cq_gears.SpurGear."""
    if state.get("status") != "success":
        raise ValueError("A successful helical design is required.")

    if state.get("gear_type") != "helical":
        raise ValueError("Expected a helical gear design state.")

    results = state.get("results", {})

    # The design results store the normal module. cq_gears.SpurGear
    # uses the transverse module to calculate the pitch diameter.
    normal_module = float(
        results.get("normal_module", state.get("normal_module"))
    )
    face_width = float(results["face_width"])
    helix_angle = float(
        results.get("helix_angle", state.get("helix_angle"))
    )
    pressure_angle = float(
        results.get("pressure_angle", state.get("pressure_angle", 20.0))
    )

    pinion_teeth = int(state["pinion_teeth"])
    gear_teeth = int(state["gear_teeth"])

    if normal_module <= 0:
        raise ValueError("Normal module must be positive.")
    if face_width <= 0:
        raise ValueError("Face width must be positive.")
    if pinion_teeth < 6 or gear_teeth < 6:
        raise ValueError("At least 6 teeth are required for this preview.")
    if not 0 < abs(helix_angle) < 45:
        raise ValueError("Helix angle must be between 0 and 45 degrees.")

    beta = math.radians(helix_angle)
    transverse_module = normal_module / math.cos(beta)

    # Matching gears should have opposite helix hands.
    # cq_gears.SpurGear accepts the helix angle in degrees.
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

    center_distance = (
        transverse_module * (pinion_teeth + gear_teeth) / 2
    )

    assembly = cq.Assembly(name="Helical_Gear_Design_Studio")
    assembly.add(
        pinion,
        name="Helical_Pinion",
        color=cq.Color(0.27, 0.51, 0.71),
    )
    assembly.add(
        gear,
        name="Helical_Gear",
        loc=cq.Location(cq.Vector(center_distance, 0, 0)),
        color=cq.Color(0.75, 0.48, 0.20),
    )

    output_path = GENERATED_DIR / "helical_gear_pair.glb"
    assembly.export(str(output_path))
    return str(output_path)
