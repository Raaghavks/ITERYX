from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd


CRITICAL_SYMPTOMS = {"chest pain", "breathing difficulty", "asthma attack", "unconscious", "seizure"}


def calculate_expected_calibration_error(
    probabilities: np.ndarray,
    true_labels: np.ndarray,
    bins: int = 10,
) -> float:
    if len(probabilities) == 0:
        return 0.0

    confidences = probabilities.max(axis=1)
    predictions = probabilities.argmax(axis=1)
    correctness = (predictions == true_labels).astype(float)
    boundaries = np.linspace(0.0, 1.0, bins + 1)

    ece = 0.0
    for lower, upper in zip(boundaries[:-1], boundaries[1:]):
        mask = (confidences > lower) & (confidences <= upper)
        if not np.any(mask):
            continue
        bin_accuracy = correctness[mask].mean()
        bin_confidence = confidences[mask].mean()
        ece += abs(bin_accuracy - bin_confidence) * mask.mean()
    return float(ece)


def calculate_multiclass_brier(probabilities: np.ndarray, true_labels: np.ndarray) -> float:
    if len(probabilities) == 0:
        return 0.0
    one_hot = np.eye(probabilities.shape[1])[true_labels]
    return float(np.mean(np.sum((probabilities - one_hot) ** 2, axis=1)))


def extract_feature_ranges(dataset: pd.DataFrame, feature_cols: list[str]) -> dict[str, dict[str, float]]:
    return {
        column: {
            "min": float(dataset[column].min()),
            "max": float(dataset[column].max()),
        }
        for column in feature_cols
    }


def features_within_ranges(features: dict[str, float], ranges: dict[str, dict[str, float]] | None) -> bool:
    if not ranges:
        return True
    for name, value in features.items():
        bounds = ranges.get(name)
        if not bounds:
            continue
        if value < bounds["min"] or value > bounds["max"]:
            return False
    return True


def heuristic_triage_assessment(vitals: dict[str, float], symptoms: list[dict[str, Any]]) -> dict[str, Any]:
    severity_max = max((int(symptom.get("severity_code", 1)) for symptom in symptoms), default=1)
    symptom_names = {str(symptom.get("symptom_text", "")).strip().lower() for symptom in symptoms}

    if vitals["spo2"] < 90 or vitals["heart_rate"] > 125 or symptom_names & CRITICAL_SYMPTOMS:
        return {"priority_level": "CRITICAL", "score": 95.0}
    if vitals["spo2"] <= 92 or vitals["heart_rate"] >= 110 or severity_max >= 4:
        return {"priority_level": "HIGH", "score": 78.0}
    if vitals["temperature"] >= 101 or severity_max >= 3 or len(symptoms) >= 3:
        return {"priority_level": "MEDIUM", "score": 55.0}
    return {"priority_level": "LOW", "score": 25.0}


def choose_triage_decision(
    *,
    artifact: dict[str, Any] | None,
    patient_age: int,
    vitals: dict[str, float],
    symptoms: list[dict[str, Any]],
) -> dict[str, Any]:
    heuristic = heuristic_triage_assessment(vitals, symptoms)
    features = {
        "age": float(patient_age),
        "bp_systolic": float(vitals["bp_systolic"]),
        "spo2": float(vitals["spo2"]),
        "temperature": float(vitals["temperature"]),
        "heart_rate": float(vitals["heart_rate"]),
        "symptom_severity_max": float(max((symptom["severity_code"] for symptom in symptoms), default=1)),
        "symptom_count": float(len(symptoms)),
    }

    if heuristic["priority_level"] == "CRITICAL":
        return {
            **heuristic,
            "decision_source": "rule_override",
            "model_version": artifact.get("metadata", {}).get("version") if artifact else None,
            "confidence": 1.0,
            "fallback_reason": None,
        }

    if not artifact or "model" not in artifact:
        return {
            **heuristic,
            "decision_source": "safe_fallback",
            "model_version": None,
            "confidence": None,
            "fallback_reason": "model_unavailable",
        }

    validation = artifact.get("validation", {})
    ranges = artifact.get("metadata", {}).get("feature_ranges")
    if validation.get("macro_avg_f1", 0.0) < 0.6:
        return {
            **heuristic,
            "decision_source": "safe_fallback",
            "model_version": artifact.get("metadata", {}).get("version"),
            "confidence": None,
            "fallback_reason": "model_quality_below_threshold",
        }
    if not features_within_ranges(features, ranges):
        return {
            **heuristic,
            "decision_source": "safe_fallback",
            "model_version": artifact.get("metadata", {}).get("version"),
            "confidence": None,
            "fallback_reason": "out_of_training_range",
        }

    input_frame = pd.DataFrame([features])[artifact["features"]]
    probabilities = artifact["model"].predict_proba(input_frame)[0]
    predicted_index = int(np.argmax(probabilities))
    confidence = float(np.max(probabilities))
    if confidence < 0.55:
        return {
            **heuristic,
            "decision_source": "safe_fallback",
            "model_version": artifact.get("metadata", {}).get("version"),
            "confidence": confidence,
            "fallback_reason": "low_confidence",
        }

    label_encoder = artifact.get("label_encoder")
    if label_encoder is not None:
        priority_level = str(label_encoder.inverse_transform([predicted_index])[0])
        classes = list(label_encoder.classes_)
    else:
        classes = artifact.get("metadata", {}).get("classes", [])
        priority_level = str(classes[predicted_index]) if classes else heuristic["priority_level"]

    def get_probability(class_name: str) -> float:
        return float(probabilities[classes.index(class_name)]) if class_name in classes else 0.0

    score = min(
        get_probability("CRITICAL") * 90
        + get_probability("HIGH") * 70
        + get_probability("MEDIUM") * 50
        + get_probability("LOW") * 20,
        94.0,
    )
    return {
        "priority_level": priority_level,
        "score": float(score),
        "decision_source": "model",
        "model_version": artifact.get("metadata", {}).get("version"),
        "confidence": confidence,
        "fallback_reason": None,
    }


def heuristic_bed_prediction(current_available: int, pending_discharge_count: int) -> int:
    return max(0, int(current_available + pending_discharge_count))


def choose_bed_prediction(
    *,
    artifact: dict[str, Any] | None,
    features: dict[str, float],
    current_available: int,
) -> dict[str, Any]:
    heuristic_value = heuristic_bed_prediction(current_available, int(features["pending_discharge_count"]))
    if not artifact or "model" not in artifact:
        return {
            "predicted_free_beds": heuristic_value,
            "prediction_source": "safe_fallback",
            "model_version": None,
            "fallback_reason": "model_unavailable",
        }

    if artifact.get("validation", {}).get("rmse", 999.0) > 4.0:
        return {
            "predicted_free_beds": heuristic_value,
            "prediction_source": "safe_fallback",
            "model_version": artifact.get("metadata", {}).get("version"),
            "fallback_reason": "model_quality_below_threshold",
        }

    ranges = artifact.get("metadata", {}).get("feature_ranges")
    if not features_within_ranges(features, ranges):
        return {
            "predicted_free_beds": heuristic_value,
            "prediction_source": "safe_fallback",
            "model_version": artifact.get("metadata", {}).get("version"),
            "fallback_reason": "out_of_training_range",
        }

    input_frame = pd.DataFrame([features])[artifact["features"]]
    prediction = max(0, int(round(float(artifact["model"].predict(input_frame)[0]))))
    return {
        "predicted_free_beds": prediction,
        "prediction_source": "model",
        "model_version": artifact.get("metadata", {}).get("version"),
        "fallback_reason": None,
    }
