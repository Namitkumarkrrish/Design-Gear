
from pathlib import Path

import cadquery as cq
from cq_gears import SpurGear


GENERATED_DIR = Path(__file__).resolve().parent / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def generate_spur_gear_model(state: dict) -> str:
    """
    Generate a GLB model of the designed pinion and gear.

    This function reads the final design state. It does not
    modify or repeat the engineering calculations.
    """

    if state.get("status") != "success":
        raise ValueError(
            "A successful gear design is required to generate the model."
        )

    results = state.get("results", {})

    module = float(results.get("module", state.get("module")))
    pinion_teeth = int(state["pinion_teeth"])
    gear_teeth = int(state["gear_teeth"])
    pressure_angle = float(state["pressure_angle"])
    face_width = float(results["face_width"])

    if module <= 0 or face_width <= 0:
        raise ValueError("Module and face width must be positive.")

    if pinion_teeth < 1 or gear_teeth < 1:
        raise ValueError("Tooth counts must be positive integers.")

    # Create the pinion using the final design dimensions.
    pinion = SpurGear(
        module=module,
        teeth_number=pinion_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
    ).build()

    # Create the mating gear using the same module and face width.
    gear = SpurGear(
        module=module,
        teeth_number=gear_teeth,
        width=face_width,
        pressure_angle=pressure_angle,
    ).build()

    # Position the gear pair using their calculated pitch diameters.
    pinion_pitch_diameter = module * pinion_teeth
    gear_pitch_diameter = module * gear_teeth
    center_distance = (
        pinion_pitch_diameter + gear_pitch_diameter
    ) / 2.0

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
