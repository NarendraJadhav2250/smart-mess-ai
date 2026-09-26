import os
import sqlite3
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT.parent / "server" / "prisma" / "dev.db"
ARTIFACT_PATH = ROOT / "model" / "random_forest.joblib"
MIN_TRAINING_ROWS = 20
VERSION = "smart-mess-rf-v1"


def read_records():
    export_path = os.getenv("MEAL_HISTORY_CSV")
    if export_path:
        return pd.read_csv(export_path)

    database_path = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB)))
    if not database_path.exists():
        raise FileNotFoundError(
            f"SQLite database not found at {database_path}. Set DATABASE_PATH or MEAL_HISTORY_CSV."
        )
    query = """
        SELECT m.date, m.day AS day_of_week, m.mealType AS meal_type, m.menu,
               m.expectedStudents AS expected_students, m.holiday,
               m.collegeStatus AS college_status,
               r.consumedQuantity AS actual_consumed,
               r.waste AS actual_waste
        FROM meals m JOIN meal_results r ON r.mealId = m.id
        ORDER BY m.date, r.createdAt, m.id
    """
    with sqlite3.connect(database_path) as connection:
        return pd.read_sql_query(query, connection, parse_dates=["date"])


def add_prior_history_features(records):
    records = records.copy()
    if "historical_consumption" in records and "historical_waste" in records:
        return records

    required = {"actual_consumed", "actual_waste"}
    if not required.issubset(records.columns):
        raise ValueError("CSV must contain actual_consumed and actual_waste columns")

    records = records.sort_values("date", kind="stable").reset_index(drop=True)
    prior_consumption = []
    prior_waste = []
    seen_consumption = []
    seen_waste = []
    for row in records.itertuples(index=False):
        prior_consumption.append(float(np.mean(seen_consumption)) if seen_consumption else np.nan)
        prior_waste.append(float(np.mean(seen_waste)) if seen_waste else np.nan)
        seen_consumption.append(float(row.actual_consumed))
        seen_waste.append(float(row.actual_waste))
    records["historical_consumption"] = prior_consumption
    records["historical_waste"] = prior_waste
    return records.dropna(subset=["historical_consumption", "historical_waste"])


def main():
    data = add_prior_history_features(read_records())
    if "actual_consumed" not in data:
        raise ValueError("Training data must include the actual_consumed target column")
    if len(data) < MIN_TRAINING_ROWS:
        raise SystemExit(
            f"Insufficient training data: found {len(data)} usable records; "
            f"at least {MIN_TRAINING_ROWS} are required."
        )

    categorical = ["day_of_week", "meal_type", "menu", "college_status"]
    numeric = [
        "expected_students",
        "holiday",
        "historical_consumption",
        "historical_waste",
    ]
    missing = set(categorical + numeric + ["actual_consumed"]) - set(data.columns)
    if missing:
        raise ValueError(f"Training data is missing required columns: {sorted(missing)}")

    features = categorical + numeric
    preprocessor = ColumnTransformer(
        [
            ("categories", OneHotEncoder(handle_unknown="ignore"), categorical),
            ("numbers", "passthrough", numeric),
        ]
    )
    model = Pipeline(
        [
            ("features", preprocessor),
            (
                "regressor",
                RandomForestRegressor(
                    n_estimators=200,
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    model.fit(data[features], data["actual_consumed"].astype(float))
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {"model": model, "model_version": VERSION, "training_records": int(len(data))},
        ARTIFACT_PATH,
    )
    print(f"Trained {VERSION} on {len(data)} historical meal results.")
    print(f"Model artifact: {ARTIFACT_PATH}")


if __name__ == "__main__":
    main()
