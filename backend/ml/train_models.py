"""
Train or retrain the ITERYX ML models.

The pipeline now prefers real processed datasets from backend/ml/datasets/processed.
If no real raw exports are available, it transparently falls back to synthetic training data.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

try:
    from xgboost import XGBClassifier
except Exception:
    XGBClassifier = None

from backend.ml.experiment_tracker import register_experiment
from backend.ml.model_store import save_model_artifact
from backend.ml.pipeline import (
    ARTIFACTS_DIR,
    BED_PROCESSED_PATH,
    INGESTION_REPORT_PATH,
    TRIAGE_PROCESSED_PATH,
    ingest_real_datasets,
)
from backend.ml.runtime import (
    calculate_expected_calibration_error,
    calculate_multiclass_brier,
    extract_feature_ranges,
)

TRIAGE_MODEL_PATH = SCRIPT_DIR / "triage_model.pkl"
BED_MODEL_PATH = SCRIPT_DIR / "bed_predictor.pkl"
METRICS_TEXT_PATH = SCRIPT_DIR / "model_metrics.txt"
BENCHMARK_REPORT_PATH = ARTIFACTS_DIR / "benchmark_report.json"

np.random.seed(42)


def generate_triage_data(n: int = 5000) -> pd.DataFrame:
    data = pd.DataFrame({
        "age": np.random.randint(18, 91, size=n),
        "bp_systolic": np.random.randint(90, 181, size=n),
        "spo2": np.random.randint(80, 101, size=n),
        "temperature": np.round(np.random.uniform(96.0, 104.0, size=n), 1),
        "heart_rate": np.random.randint(50, 141, size=n),
        "symptom_severity_max": np.random.randint(1, 5, size=n),
        "symptom_count": np.random.randint(1, 6, size=n),
    })

    scores = np.zeros(n, dtype=float)
    for index in range(n):
        spo2 = data.loc[index, "spo2"]
        heart_rate = data.loc[index, "heart_rate"]
        severity = data.loc[index, "symptom_severity_max"]
        if spo2 < 88:
            score = np.random.randint(90, 101)
        elif spo2 <= 92:
            score = np.random.randint(75, 90)
        elif heart_rate > 130:
            score = np.random.randint(85, 101)
        elif heart_rate >= 110:
            score = np.random.randint(65, 85)
        elif severity == 4:
            score = np.random.randint(70, 101)
        elif severity == 3:
            score = np.random.randint(45, 70)
        else:
            score = np.random.randint(10, 45)
        scores[index] = score

    data["urgency_score"] = scores.astype(int)
    data["priority_level"] = np.select(
        [data["urgency_score"] >= 80, data["urgency_score"] >= 60, data["urgency_score"] >= 40],
        ["CRITICAL", "HIGH", "MEDIUM"],
        default="LOW",
    )
    data["source_name"] = "synthetic"
    return data


def generate_bed_data(n: int = 2000) -> pd.DataFrame:
    data = pd.DataFrame({
        "day_of_week": np.random.randint(0, 7, size=n),
        "hour_of_day": np.random.randint(0, 24, size=n),
        "current_occupancy_rate": np.round(np.random.uniform(0.0, 1.0, size=n), 2),
        "pending_discharge_count": np.random.randint(0, 11, size=n),
        "historical_avg_discharge_rate": np.round(np.random.uniform(0.0, 5.0, size=n), 2),
    })
    base = (
        data["pending_discharge_count"] * 0.8
        + data["historical_avg_discharge_rate"] * 1.2
        - data["current_occupancy_rate"] * 5
        + np.random.normal(0, 1.5, size=n)
    )
    data["predicted_free_beds"] = np.clip(np.round(base), 0, 15).astype(int)
    data["source_name"] = "synthetic"
    return data


def load_training_data(force_synthetic: bool = False) -> dict[str, pd.DataFrame]:
    ingest_real_datasets()

    triage_df: pd.DataFrame
    bed_df: pd.DataFrame

    if not force_synthetic and TRIAGE_PROCESSED_PATH.exists():
        triage_candidate = pd.read_csv(TRIAGE_PROCESSED_PATH)
        if len(triage_candidate) >= 25 and triage_candidate["priority_level"].nunique() >= 2:
            triage_df = triage_candidate
            triage_source = "real"
        else:
            triage_df = generate_triage_data()
            triage_source = "synthetic_fallback"
    else:
        triage_df = generate_triage_data()
        triage_source = "synthetic"

    if not force_synthetic and BED_PROCESSED_PATH.exists():
        bed_candidate = pd.read_csv(BED_PROCESSED_PATH)
        if len(bed_candidate) >= 25:
            bed_df = bed_candidate
            bed_source = "real"
        else:
            bed_df = generate_bed_data()
            bed_source = "synthetic_fallback"
    else:
        bed_df = generate_bed_data()
        bed_source = "synthetic"

    return {
        "triage": triage_df,
        "beds": bed_df,
        "triage_source": triage_source,
        "beds_source": bed_source,
    }


def build_triage_classifier():
    if XGBClassifier is not None:
        return XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            eval_metric="mlogloss",
            random_state=42,
        )
    return RandomForestClassifier(n_estimators=300, random_state=42)


def train_triage_model(dataset: pd.DataFrame, dataset_source: str) -> dict:
    feature_cols = [
        "age",
        "bp_systolic",
        "spo2",
        "temperature",
        "heart_rate",
        "symptom_severity_max",
        "symptom_count",
    ]
    X = dataset[feature_cols]
    y = dataset["priority_level"]

    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y)
    stratify = y_encoded if dataset["priority_level"].value_counts().min() > 1 else None
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y_encoded,
        test_size=0.2,
        random_state=42,
        stratify=stratify,
    )

    model = build_triage_classifier()
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)
    report = classification_report(
        y_test,
        predictions,
        target_names=encoder.classes_,
        output_dict=True,
        zero_division=0,
    )
    validation = {
        "accuracy": float(report["accuracy"]),
        "macro_avg_precision": float(report["macro avg"]["precision"]),
        "macro_avg_recall": float(report["macro avg"]["recall"]),
        "macro_avg_f1": float(report["macro avg"]["f1-score"]),
        "weighted_avg_f1": float(report["weighted avg"]["f1-score"]),
        "calibration_ece": calculate_expected_calibration_error(probabilities, y_test),
        "brier_score": calculate_multiclass_brier(probabilities, y_test),
        "classification_report": report,
    }
    metadata = {
        "dataset_source": dataset_source,
        "row_count": int(len(dataset)),
        "class_distribution": dataset["priority_level"].value_counts().to_dict(),
        "feature_ranges": extract_feature_ranges(dataset, feature_cols),
        "classes": list(encoder.classes_),
    }
    version = register_experiment(
        model_name="triage",
        artifact_path=TRIAGE_MODEL_PATH,
        metadata=metadata,
        validation=validation,
        artifacts_dir=ARTIFACTS_DIR,
    )
    metadata["version"] = version
    metadata["trained_at"] = version.split("-", 1)[-1]

    artifact = {
        "model": model,
        "label_encoder": encoder,
        "features": feature_cols,
        "metadata": metadata,
        "validation": validation,
    }
    save_model_artifact(TRIAGE_MODEL_PATH, artifact)
    return artifact


def train_bed_model(dataset: pd.DataFrame, dataset_source: str) -> dict:
    feature_cols = [
        "day_of_week",
        "hour_of_day",
        "current_occupancy_rate",
        "pending_discharge_count",
        "historical_avg_discharge_rate",
    ]
    X = dataset[feature_cols]
    y = dataset["predicted_free_beds"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )
    model = GradientBoostingRegressor(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
    validation = {
        "rmse": rmse,
        "mae": float(mean_absolute_error(y_test, predictions)),
        "r2": float(r2_score(y_test, predictions)),
    }
    metadata = {
        "dataset_source": dataset_source,
        "row_count": int(len(dataset)),
        "feature_ranges": extract_feature_ranges(dataset, feature_cols),
    }
    version = register_experiment(
        model_name="beds",
        artifact_path=BED_MODEL_PATH,
        metadata=metadata,
        validation=validation,
        artifacts_dir=ARTIFACTS_DIR,
    )
    metadata["version"] = version
    metadata["trained_at"] = version.split("-", 1)[-1]

    artifact = {
        "model": model,
        "features": feature_cols,
        "metadata": metadata,
        "validation": validation,
    }
    save_model_artifact(BED_MODEL_PATH, artifact)
    return artifact


def write_reports(triage_artifact: dict, bed_artifact: dict) -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    benchmark_payload = {
        "triage": {
            "dataset_source": triage_artifact["metadata"]["dataset_source"],
            "version": triage_artifact["metadata"]["version"],
            "row_count": triage_artifact["metadata"]["row_count"],
            "accuracy": triage_artifact["validation"]["accuracy"],
            "macro_avg_precision": triage_artifact["validation"]["macro_avg_precision"],
            "macro_avg_recall": triage_artifact["validation"]["macro_avg_recall"],
            "macro_avg_f1": triage_artifact["validation"]["macro_avg_f1"],
            "weighted_avg_f1": triage_artifact["validation"]["weighted_avg_f1"],
            "calibration_ece": triage_artifact["validation"]["calibration_ece"],
            "brier_score": triage_artifact["validation"]["brier_score"],
        },
        "beds": {
            "dataset_source": bed_artifact["metadata"]["dataset_source"],
            "version": bed_artifact["metadata"]["version"],
            "row_count": bed_artifact["metadata"]["row_count"],
            "rmse": bed_artifact["validation"]["rmse"],
            "mae": bed_artifact["validation"]["mae"],
            "r2": bed_artifact["validation"]["r2"],
        },
        "ingestion_report_path": str(INGESTION_REPORT_PATH),
        "experiment_log_path": str(ARTIFACTS_DIR / "experiment_runs.jsonl"),
        "model_registry_path": str(ARTIFACTS_DIR / "model_registry.json"),
    }
    BENCHMARK_REPORT_PATH.write_text(json.dumps(benchmark_payload, indent=2), encoding="utf-8")

    lines = [
        "ITERYX ML Training Summary",
        "",
        f"Triage dataset source: {triage_artifact['metadata']['dataset_source']}",
        f"Triage version: {triage_artifact['metadata']['version']}",
        f"Triage rows: {triage_artifact['metadata']['row_count']}",
        f"Triage accuracy: {triage_artifact['validation']['accuracy']:.4f}",
        f"Triage macro precision: {triage_artifact['validation']['macro_avg_precision']:.4f}",
        f"Triage macro recall: {triage_artifact['validation']['macro_avg_recall']:.4f}",
        f"Triage macro F1: {triage_artifact['validation']['macro_avg_f1']:.4f}",
        f"Triage weighted F1: {triage_artifact['validation']['weighted_avg_f1']:.4f}",
        f"Triage calibration ECE: {triage_artifact['validation']['calibration_ece']:.4f}",
        f"Triage Brier score: {triage_artifact['validation']['brier_score']:.4f}",
        "",
        f"Bed dataset source: {bed_artifact['metadata']['dataset_source']}",
        f"Bed version: {bed_artifact['metadata']['version']}",
        f"Bed rows: {bed_artifact['metadata']['row_count']}",
        f"Bed RMSE: {bed_artifact['validation']['rmse']:.4f}",
        f"Bed MAE: {bed_artifact['validation']['mae']:.4f}",
        f"Bed R2: {bed_artifact['validation']['r2']:.4f}",
        "",
        f"Ingestion report: {INGESTION_REPORT_PATH}",
        f"Benchmark report: {BENCHMARK_REPORT_PATH}",
        f"Experiment log: {ARTIFACTS_DIR / 'experiment_runs.jsonl'}",
        f"Model registry: {ARTIFACTS_DIR / 'model_registry.json'}",
    ]
    METRICS_TEXT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main(force_synthetic: bool = False) -> None:
    datasets = load_training_data(force_synthetic=force_synthetic)
    triage_artifact = train_triage_model(datasets["triage"], datasets["triage_source"])
    bed_artifact = train_bed_model(datasets["beds"], datasets["beds_source"])
    write_reports(triage_artifact, bed_artifact)

    print(f"Triage model trained on {datasets['triage_source']} data.")
    print(f"Bed model trained on {datasets['beds_source']} data.")
    print(f"Benchmark report written to {BENCHMARK_REPORT_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force-synthetic",
        action="store_true",
        help="Ignore processed datasets and retrain on synthetic fallback data.",
    )
    args = parser.parse_args()
    main(force_synthetic=args.force_synthetic)
