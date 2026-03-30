"""
train_models.py
───────────────
Trains two ML models for the ITERYX Smart Hospital system:

  MODEL 1 — Triage Scoring (XGBoost Classifier)
      Predicts patient priority_level: CRITICAL / HIGH / MEDIUM / LOW

  MODEL 2 — Bed Vacancy Prediction (GradientBoosting Regressor)
      Predicts number of beds likely to become free in the next window

Run standalone:
    python train_models.py
"""

import os
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, mean_squared_error
from xgboost import XGBClassifier
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import LabelEncoder
import joblib

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRIAGE_MODEL_PATH = os.path.join(SCRIPT_DIR, "triage_model.pkl")
BED_MODEL_PATH = os.path.join(SCRIPT_DIR, "bed_predictor.pkl")

np.random.seed(42)


# ══════════════════════════════════════════════
#  MODEL 1 — Triage Scoring (XGBoost)
# ══════════════════════════════════════════════

def generate_triage_data(n: int = 1000) -> pd.DataFrame:
    """Generate synthetic patient vitals and derive urgency labels."""
    data = pd.DataFrame({
        "age":                  np.random.randint(18, 91, size=n),
        "bp_systolic":          np.random.randint(90, 181, size=n),
        "spo2":                 np.random.randint(80, 101, size=n),
        "temperature":          np.round(np.random.uniform(96.0, 104.0, size=n), 1),
        "heart_rate":           np.random.randint(50, 141, size=n),
        "symptom_severity_max": np.random.randint(1, 5, size=n),
        "symptom_count":        np.random.randint(1, 6, size=n),
    })

    # ----- derive urgency_score (0-100) using rule cascade -----
    scores = np.zeros(n, dtype=float)

    for i in range(n):
        spo2 = data.loc[i, "spo2"]
        hr   = data.loc[i, "heart_rate"]
        sev  = data.loc[i, "symptom_severity_max"]

        if spo2 < 88:
            score = np.random.randint(90, 101)
        elif spo2 <= 92:
            score = np.random.randint(75, 90)
        elif hr > 130:
            score = np.random.randint(85, 101)
        elif hr >= 110:
            score = np.random.randint(65, 85)
        elif sev == 4:
            score = np.random.randint(70, 101)
        elif sev == 3:
            score = np.random.randint(45, 70)
        else:
            score = np.random.randint(10, 45)

        scores[i] = score

    data["urgency_score"] = scores.astype(int)

    # ----- derive priority_level from score -----
    conditions = [
        data["urgency_score"] >= 80,
        data["urgency_score"] >= 60,
        data["urgency_score"] >= 40,
    ]
    choices = ["CRITICAL", "HIGH", "MEDIUM"]
    data["priority_level"] = np.select(conditions, choices, default="LOW")

    return data


def train_triage_model() -> None:
    """Train XGBoost classifier for triage priority prediction."""
    print("=" * 60)
    print("  MODEL 1 - Triage Scoring (XGBoost Classifier)")
    print("=" * 60)

    df = generate_triage_data(1000)

    print(f"\n[DATA]  Generated {len(df)} synthetic patient rows")
    print(f"    Class distribution:\n{df['priority_level'].value_counts().to_string()}\n")

    feature_cols = [
        "age", "bp_systolic", "spo2", "temperature",
        "heart_rate", "symptom_severity_max", "symptom_count",
    ]
    X = df[feature_cols]
    y = df["priority_level"]

    # Encode labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        eval_metric="mlogloss",
        random_state=42,
    )
    model.fit(X_train, y_train, verbose=False)

    y_pred = model.predict(X_test)

    print("[REPORT]  Classification Report:")
    print(classification_report(
        y_test, y_pred,
        target_names=le.classes_,
        zero_division=0,
    ))

    # Save model + label encoder together
    joblib.dump({"model": model, "label_encoder": le, "features": feature_cols}, TRIAGE_MODEL_PATH)
    print(f"[OK]  triage_model.pkl saved -> {TRIAGE_MODEL_PATH}\n")


# ══════════════════════════════════════════════
#  MODEL 2 — Bed Vacancy Prediction (GradientBoosting)
# ══════════════════════════════════════════════

def generate_bed_data(n: int = 500) -> pd.DataFrame:
    """Generate synthetic hospital bed occupancy rows."""
    data = pd.DataFrame({
        "day_of_week":                    np.random.randint(0, 7, size=n),
        "hour_of_day":                    np.random.randint(0, 24, size=n),
        "current_occupancy_rate":         np.round(np.random.uniform(0.0, 1.0, size=n), 2),
        "pending_discharge_count":        np.random.randint(0, 11, size=n),
        "historical_avg_discharge_rate":  np.round(np.random.uniform(0.0, 5.0, size=n), 2),
    })

    # Target: predicted_free_beds (0-15), influenced by features
    base = (
        data["pending_discharge_count"] * 0.8
        + data["historical_avg_discharge_rate"] * 1.2
        - data["current_occupancy_rate"] * 5
        + np.random.normal(0, 1.5, size=n)
    )
    data["predicted_free_beds"] = np.clip(np.round(base), 0, 15).astype(int)

    return data


def train_bed_model() -> None:
    """Train GradientBoosting regressor for bed vacancy prediction."""
    print("=" * 60)
    print("  MODEL 2 - Bed Vacancy Prediction (GradientBoosting)")
    print("=" * 60)

    df = generate_bed_data(500)

    print(f"\n[DATA]  Generated {len(df)} synthetic occupancy rows")
    print(f"    Target range: {df['predicted_free_beds'].min()} - {df['predicted_free_beds'].max()}\n")

    feature_cols = [
        "day_of_week", "hour_of_day", "current_occupancy_rate",
        "pending_discharge_count", "historical_avg_discharge_rate",
    ]
    X = df[feature_cols]
    y = df["predicted_free_beds"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))

    print(f"[REPORT]  RMSE: {rmse:.4f}\n")

    # Save model + feature list
    joblib.dump({"model": model, "features": feature_cols}, BED_MODEL_PATH)
    print(f"[OK]  bed_predictor.pkl saved -> {BED_MODEL_PATH}\n")


# ══════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════

if __name__ == "__main__":
    train_triage_model()
    train_bed_model()

    print("-" * 60)
    print("[OK] triage_model.pkl saved | [OK] bed_predictor.pkl saved")
    print("-" * 60)
