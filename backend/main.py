
from copy import deepcopy
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from gears.spurgearfinal import (
    start_spur_design,
    continue_spur_design,
)
from gears.helicalgear import (
    start_helical_design,
    continue_helical_design,
)
from gears.gear_model_generator import (
    generate_spur_gear_model,
    generate_helical_gear_model,
)


app = FastAPI(title="Gear Design Studio API")

GENERATED_DIR = Path(__file__).resolve().parent / "gears" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/generated",
    StaticFiles(directory=str(GENERATED_DIR)),
    name="generated",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ContinueDesignRequest(BaseModel):
    state: dict[str, Any]
    choice: int
    value: float | None = None


@app.get("/")
def home():
    return {"message": "Gear Design Studio backend is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------- SPUR GEAR ENDPOINTS ----------------

@app.post("/api/gears/spur/start")
def start_spur(data: dict[str, Any]):
    try:
        return start_spur_design(data)
    except (ValueError, ZeroDivisionError, OverflowError) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/gears/spur/continue")
def continue_spur(request: ContinueDesignRequest):
    try:
        return continue_spur_design(
            deepcopy(request.state),
            request.choice,
            request.value,
        )
    except (
        ValueError,
        KeyError,
        TypeError,
        ZeroDivisionError,
        OverflowError,
    ) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/gears/spur/model")
def generate_spur_model(state: dict[str, Any]):
    try:
        output_path = generate_spur_gear_model(state)

        return {
            "message": "Spur 3D model generated successfully",
            "filename": Path(output_path).name,
            "model_url": "/generated/" + Path(output_path).name,
        }
    except (ValueError, KeyError, TypeError, RuntimeError) as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Spur model generation failed: {error}",
        )


# ---------------- HELICAL GEAR ENDPOINTS ----------------

@app.post("/api/gears/helical/start")
def start_helical(data: dict[str, Any]):
    try:
        return start_helical_design(data)
    except (
        ValueError,
        KeyError,
        TypeError,
        ZeroDivisionError,
        OverflowError,
    ) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/gears/helical/continue")
def continue_helical(request: ContinueDesignRequest):
    try:
        return continue_helical_design(
            deepcopy(request.state),
            request.choice,
            request.value,
        )
    except (
        ValueError,
        KeyError,
        TypeError,
        ZeroDivisionError,
        OverflowError,
    ) as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/gears/helical/model")
def generate_helical_model(state: dict[str, Any]):
    try:
        output_path = generate_helical_gear_model(state)

        return {
            "message": "Helical 3D model generated successfully",
            "filename": Path(output_path).name,
            "model_url": "/generated/" + Path(output_path).name,
        }
    except (ValueError, KeyError, TypeError, RuntimeError) as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Helical model generation failed: {error}",
        )
