# Real Dataset Pipeline

Drop external raw exports into these folders before retraining:

- `backend/ml/datasets/raw/triage`
- `backend/ml/datasets/raw/beds`

Supported file types:

- `.csv`
- `.json`
- `.jsonl`

The ingestion pipeline maps common external column names into the project schema.

Triage aliases:

- `age`, `patient_age`
- `bp_systolic`, `systolic_bp`, `systolic`
- `spo2`, `oxygen_saturation`, `o2_sat`
- `temperature`, `temperature_f`, `temperature_c`
- `heart_rate`, `pulse`, `pulse_rate`
- `symptom_severity_max`, `severity`
- `symptom_count`, `complaint_count`
- `priority_level`, `triage_label`, `acuity`
- `urgency_score`, `triage_score`

Bed aliases:

- `timestamp`, `snapshot_at`
- `day_of_week`, `weekday`
- `hour_of_day`, `hour`
- `current_occupancy_rate`, `occupancy_rate`
- `occupied_beds`, `beds_occupied`
- `total_beds`, `beds_total`
- `pending_discharge_count`, `pending_discharges`
- `historical_avg_discharge_rate`, `avg_discharge_rate`
- `predicted_free_beds`, `actual_free_beds`

Processed canonical datasets are written to `backend/ml/datasets/processed`, and ingestion metadata is written to `backend/ml/artifacts/ingestion_report.json`.
