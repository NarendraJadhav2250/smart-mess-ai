from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
ARTIFACT_PATH = ROOT / "model" / "random_forest.joblib"
FEATURES = [
    "day_of_week",
    "meal_type",
    "menu",
    "expected_students",
    "holiday",
    "college_status",
    "historical_consumption",
    "historical_waste",
]

app = FastAPI(title="Smart Mess AI ML Service", version="1.0.0")


class PredictionInput(BaseModel):
    day_of_week: Literal[
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    ]
    meal_type: Literal["Lunch", "Dinner"]
    menu: str = Field(min_length=1, max_length=160)
    expected_students: int = Field(ge=0, le=100000)
    holiday: bool
    college_status: Literal["College Day", "Non-college Day"]
    historical_consumption: float = Field(ge=0, le=100000)
    historical_waste: float = Field(ge=0, le=100000)


@app.get("/health")
def health():
    return {"status": "ok", "modelReady": ARTIFACT_PATH.exists()}


@app.post("/predict")
def predict(payload: PredictionInput):
    if not ARTIFACT_PATH.exists():
        raise HTTPException(status_code=503, detail="Trained model artifact is unavailable")

    artifact = joblib.load(ARTIFACT_PATH)
    frame = pd.DataFrame([payload.model_dump()])[FEATURES]
    model = artifact["model"]
    prediction = max(0.0, float(model.predict(frame)[0]))
    tree_predictions = [float(tree.predict(frame)[0]) for tree in model.named_steps["regressor"].estimators_]
    # This is the standard deviation across tree outputs, expressed in servings.
    # It describes ensemble spread and is not a calibrated confidence interval.
    uncertainty = float(pd.Series(tree_predictions).std(ddof=0))

    return {
        "predictedConsumption": prediction,
        "modelVersion": artifact["model_version"],
        "uncertainty": uncertainty,
        "trainingRecords": artifact["training_records"],
        "explanation": (
            "RandomForestRegressor used day, meal type, menu, expected students, "
            "holiday/college status, and historical consumption and waste. "
            f"Tree outputs varied by {uncertainty:.1f} servings (ensemble spread; not a calibrated interval)."
        ),
    }
