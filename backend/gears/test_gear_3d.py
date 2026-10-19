
import cadquery as cq
from cq_gears import SpurGear
from pathlib import Path

# Test gear dimensions (mm)
module = 6
teeth_number = 18
face_width = 90
pressure_angle = 20

# Create the 3D gear
gear = SpurGear(
    module=module,
    teeth_number=teeth_number,
    width=face_width,
    pressure_angle=pressure_angle,
)

solid = gear.build()

# Save the model as STEP for CAD and STL for mesh viewing
output_dir = Path(__file__).resolve().parent / "generated"
output_dir.mkdir(parents=True, exist_ok=True)

step_path = output_dir / "test_spur_gear.step"
stl_path = output_dir / "test_spur_gear.stl"

cq.exporters.export(solid, str(step_path))
cq.exporters.export(solid, str(stl_path))

print("Gear generated successfully!")
print(f"Module: {module} mm")
print(f"Teeth: {teeth_number}")
print(f"Pitch diameter: {module * teeth_number} mm")
print(f"Face width: {face_width} mm")
print(f"STEP file: {step_path}")
print(f"STL file: {stl_path}")
