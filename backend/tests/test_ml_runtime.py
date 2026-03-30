from __future__ import annotations

import unittest

import numpy as np

from backend.ml.runtime import choose_bed_prediction, choose_triage_decision


class DummyClassifier:
    def __init__(self, probabilities):
        self._probabilities = np.array([probabilities])

    def predict_proba(self, frame):
        return np.repeat(self._probabilities, len(frame), axis=0)


class DummyRegressor:
    def __init__(self, value: float):
        self.value = value

    def predict(self, frame):
        return np.array([self.value] * len(frame))


class DummyEncoder:
    classes_ = np.array(["CRITICAL", "HIGH", "LOW", "MEDIUM"])

    def inverse_transform(self, indexes):
        return self.classes_[indexes]


class MLRuntimeSafetyTests(unittest.TestCase):
    def test_triage_runtime_uses_safe_fallback_on_low_confidence(self) -> None:
        artifact = {
            "model": DummyClassifier([0.25, 0.30, 0.20, 0.25]),
            "label_encoder": DummyEncoder(),
            "features": [
                "age",
                "bp_systolic",
                "spo2",
                "temperature",
                "heart_rate",
                "symptom_severity_max",
                "symptom_count",
            ],
            "metadata": {
                "version": "triage-123",
                "feature_ranges": {
                    "age": {"min": 1, "max": 100},
                    "bp_systolic": {"min": 80, "max": 200},
                    "spo2": {"min": 80, "max": 100},
                    "temperature": {"min": 95, "max": 105},
                    "heart_rate": {"min": 40, "max": 150},
                    "symptom_severity_max": {"min": 1, "max": 5},
                    "symptom_count": {"min": 1, "max": 5},
                },
            },
            "validation": {"macro_avg_f1": 0.8},
        }

        decision = choose_triage_decision(
            artifact=artifact,
            patient_age=42,
            vitals={
                "bp_systolic": 130,
                "spo2": 95,
                "temperature": 99.2,
                "heart_rate": 90,
            },
            symptoms=[{"symptom_text": "headache", "severity_code": 2}],
        )

        self.assertEqual("safe_fallback", decision["decision_source"])
        self.assertEqual("low_confidence", decision["fallback_reason"])

    def test_bed_runtime_uses_model_when_inputs_are_safe(self) -> None:
        artifact = {
            "model": DummyRegressor(6.4),
            "features": [
                "day_of_week",
                "hour_of_day",
                "current_occupancy_rate",
                "pending_discharge_count",
                "historical_avg_discharge_rate",
            ],
            "metadata": {
                "version": "beds-123",
                "feature_ranges": {
                    "day_of_week": {"min": 0, "max": 6},
                    "hour_of_day": {"min": 0, "max": 23},
                    "current_occupancy_rate": {"min": 0.1, "max": 1.0},
                    "pending_discharge_count": {"min": 0, "max": 12},
                    "historical_avg_discharge_rate": {"min": 0.0, "max": 6.0},
                },
            },
            "validation": {"rmse": 1.8},
        }

        prediction = choose_bed_prediction(
            artifact=artifact,
            features={
                "day_of_week": 2,
                "hour_of_day": 10,
                "current_occupancy_rate": 0.78,
                "pending_discharge_count": 3,
                "historical_avg_discharge_rate": 2.2,
            },
            current_available=2,
        )

        self.assertEqual("model", prediction["prediction_source"])
        self.assertEqual(6, prediction["predicted_free_beds"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
