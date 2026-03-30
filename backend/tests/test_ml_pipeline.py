from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import pandas as pd

from backend.ml.pipeline import ingest_real_datasets


class RealDatasetPipelineTests(unittest.TestCase):
    def test_ingestion_maps_external_triage_and_bed_exports(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            triage_dir = root / "datasets" / "raw" / "triage"
            beds_dir = root / "datasets" / "raw" / "beds"
            triage_dir.mkdir(parents=True)
            beds_dir.mkdir(parents=True)

            pd.DataFrame(
                [
                    {
                        "patient_age": 51,
                        "systolic_bp": 145,
                        "oxygen_saturation": 91,
                        "temperature_c": 37.8,
                        "pulse_rate": 112,
                        "severity": 4,
                        "complaint_count": 2,
                        "triage_label": "urgent",
                    }
                ]
            ).to_csv(triage_dir / "triage_export.csv", index=False)

            pd.DataFrame(
                [
                    {
                        "snapshot_at": "2026-03-31T09:30:00Z",
                        "beds_occupied": 17,
                        "beds_total": 20,
                        "pending_discharges": 3,
                        "avg_discharge_rate": 2.4,
                        "actual_free_beds": 4,
                    }
                ]
            ).to_csv(beds_dir / "bed_export.csv", index=False)

            summary = ingest_real_datasets(root)

            self.assertEqual("processed", summary["triage"].status)
            self.assertEqual("processed", summary["beds"].status)

            triage_processed = pd.read_csv(root / "datasets" / "processed" / "triage_dataset.csv")
            bed_processed = pd.read_csv(root / "datasets" / "processed" / "bed_dataset.csv")

            self.assertIn("priority_level", triage_processed.columns)
            self.assertEqual("HIGH", triage_processed.iloc[0]["priority_level"])
            self.assertAlmostEqual(100.04, round(triage_processed.iloc[0]["temperature"], 2), places=2)

            self.assertIn("current_occupancy_rate", bed_processed.columns)
            self.assertAlmostEqual(0.85, bed_processed.iloc[0]["current_occupancy_rate"], places=2)
            self.assertEqual(1, int(bed_processed.iloc[0]["day_of_week"]))


if __name__ == "__main__":
    unittest.main(verbosity=2)
