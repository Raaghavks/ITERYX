from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import pandas as pd


SCRIPT_DIR = Path(__file__).resolve().parent
DATASETS_DIR = SCRIPT_DIR / "datasets"
RAW_DIR = DATASETS_DIR / "raw"
PROCESSED_DIR = DATASETS_DIR / "processed"
ARTIFACTS_DIR = SCRIPT_DIR / "artifacts"

TRIAGE_PROCESSED_PATH = PROCESSED_DIR / "triage_dataset.csv"
BED_PROCESSED_PATH = PROCESSED_DIR / "bed_dataset.csv"
INGESTION_REPORT_PATH = ARTIFACTS_DIR / "ingestion_report.json"


PRIORITY_SCORES = {
    "CRITICAL": 95,
    "HIGH": 75,
    "MEDIUM": 55,
    "LOW": 25,
}

TRIAGE_COLUMN_ALIASES = {
    "age": ["age", "patient_age"],
    "bp_systolic": ["bp_systolic", "systolic_bp", "systolic"],
    "spo2": ["spo2", "oxygen_saturation", "o2_sat", "spo2_percent"],
    "temperature": ["temperature", "temperature_f", "body_temperature_f"],
    "temperature_c": ["temperature_c", "body_temperature_c"],
    "heart_rate": ["heart_rate", "pulse", "pulse_rate"],
    "symptom_severity_max": ["symptom_severity_max", "symptom_severity", "severity_max", "severity"],
    "symptom_count": ["symptom_count", "symptoms_count", "complaint_count"],
    "priority_level": ["priority_level", "triage_label", "acuity", "target_priority"],
    "urgency_score": ["urgency_score", "score", "triage_score"],
}

BED_COLUMN_ALIASES = {
    "timestamp": ["timestamp", "snapshot_at", "captured_at"],
    "day_of_week": ["day_of_week", "weekday"],
    "hour_of_day": ["hour_of_day", "hour"],
    "current_occupancy_rate": ["current_occupancy_rate", "occupancy_rate"],
    "occupied_beds": ["occupied_beds", "beds_occupied"],
    "total_beds": ["total_beds", "beds_total"],
    "pending_discharge_count": ["pending_discharge_count", "pending_discharges"],
    "historical_avg_discharge_rate": ["historical_avg_discharge_rate", "avg_discharge_rate"],
    "predicted_free_beds": ["predicted_free_beds", "actual_free_beds", "free_beds_next_window"],
}


@dataclass
class IngestionSummary:
    dataset_name: str
    source_files: list[str]
    raw_rows: int
    processed_rows: int
    output_path: str | None
    status: str


def ensure_ml_directories(base_dir: Path | None = None) -> dict[str, Path]:
    root = base_dir or SCRIPT_DIR
    datasets_dir = root / "datasets"
    raw_dir = datasets_dir / "raw"
    processed_dir = datasets_dir / "processed"
    artifacts_dir = root / "artifacts"

    for directory in [
        raw_dir / "triage",
        raw_dir / "beds",
        processed_dir,
        artifacts_dir,
    ]:
        directory.mkdir(parents=True, exist_ok=True)

    return {
        "root": root,
        "raw": raw_dir,
        "processed": processed_dir,
        "artifacts": artifacts_dir,
    }


def _first_present_column(frame: pd.DataFrame, aliases: Iterable[str]) -> str | None:
    for alias in aliases:
        if alias in frame.columns:
            return alias
    return None


def _copy_first_available_column(frame: pd.DataFrame, aliases: dict[str, list[str]]) -> pd.DataFrame:
    canonical = pd.DataFrame(index=frame.index)
    for target, options in aliases.items():
        source = _first_present_column(frame, options)
        if source:
            canonical[target] = frame[source]
    return canonical


def _coerce_numeric(frame: pd.DataFrame, columns: Iterable[str]) -> None:
    for column in columns:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")


def _normalize_priority(value: object) -> str | None:
    if value is None or pd.isna(value):
        return None
    normalized = str(value).strip().upper().replace(" ", "_")
    if normalized in PRIORITY_SCORES:
        return normalized
    if normalized in {"SEVERE", "EMERGENCY"}:
        return "CRITICAL"
    if normalized in {"URGENT"}:
        return "HIGH"
    if normalized in {"STANDARD"}:
        return "MEDIUM"
    if normalized in {"NON_URGENT", "ROUTINE"}:
        return "LOW"
    return None


def _priority_from_score(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def normalize_triage_dataframe(frame: pd.DataFrame, source_name: str = "unknown") -> pd.DataFrame:
    canonical = _copy_first_available_column(frame, TRIAGE_COLUMN_ALIASES)

    if "temperature" not in canonical and "temperature_c" in canonical:
        canonical["temperature"] = pd.to_numeric(canonical["temperature_c"], errors="coerce") * 9 / 5 + 32

    _coerce_numeric(
        canonical,
        [
            "age",
            "bp_systolic",
            "spo2",
            "temperature",
            "heart_rate",
            "symptom_severity_max",
            "symptom_count",
            "urgency_score",
        ],
    )

    if "symptom_count" not in canonical:
        canonical["symptom_count"] = 1
    if "symptom_severity_max" not in canonical:
        canonical["symptom_severity_max"] = 2

    if "priority_level" in canonical:
        canonical["priority_level"] = canonical["priority_level"].map(_normalize_priority)
    else:
        canonical["priority_level"] = None

    if "urgency_score" not in canonical:
        canonical["urgency_score"] = canonical["priority_level"].map(PRIORITY_SCORES)
    canonical["priority_level"] = canonical.apply(
        lambda row: row["priority_level"]
        if row["priority_level"]
        else (_priority_from_score(row["urgency_score"]) if pd.notna(row["urgency_score"]) else None),
        axis=1,
    )
    canonical["urgency_score"] = canonical.apply(
        lambda row: row["urgency_score"]
        if pd.notna(row["urgency_score"])
        else PRIORITY_SCORES.get(row["priority_level"]),
        axis=1,
    )

    canonical["source_name"] = source_name
    canonical = canonical.dropna(
        subset=[
            "age",
            "bp_systolic",
            "spo2",
            "temperature",
            "heart_rate",
            "symptom_severity_max",
            "symptom_count",
            "priority_level",
            "urgency_score",
        ]
    )

    return canonical[
        [
            "age",
            "bp_systolic",
            "spo2",
            "temperature",
            "heart_rate",
            "symptom_severity_max",
            "symptom_count",
            "urgency_score",
            "priority_level",
            "source_name",
        ]
    ].reset_index(drop=True)


def normalize_bed_dataframe(frame: pd.DataFrame, source_name: str = "unknown") -> pd.DataFrame:
    canonical = _copy_first_available_column(frame, BED_COLUMN_ALIASES)

    if "timestamp" in canonical:
        timestamps = pd.to_datetime(canonical["timestamp"], errors="coerce", utc=True)
        canonical["day_of_week"] = canonical.get("day_of_week", timestamps.dt.weekday)
        canonical["hour_of_day"] = canonical.get("hour_of_day", timestamps.dt.hour)

    _coerce_numeric(
        canonical,
        [
            "day_of_week",
            "hour_of_day",
            "current_occupancy_rate",
            "occupied_beds",
            "total_beds",
            "pending_discharge_count",
            "historical_avg_discharge_rate",
            "predicted_free_beds",
        ],
    )

    if "current_occupancy_rate" not in canonical and {"occupied_beds", "total_beds"} <= set(canonical.columns):
        canonical["current_occupancy_rate"] = canonical["occupied_beds"] / canonical["total_beds"].replace(0, pd.NA)

    if "pending_discharge_count" not in canonical:
        canonical["pending_discharge_count"] = 0
    if "historical_avg_discharge_rate" not in canonical:
        canonical["historical_avg_discharge_rate"] = canonical["pending_discharge_count"].rolling(3, min_periods=1).mean()

    canonical["source_name"] = source_name
    canonical = canonical.dropna(
        subset=[
            "day_of_week",
            "hour_of_day",
            "current_occupancy_rate",
            "pending_discharge_count",
            "historical_avg_discharge_rate",
            "predicted_free_beds",
        ]
    )

    return canonical[
        [
            "day_of_week",
            "hour_of_day",
            "current_occupancy_rate",
            "pending_discharge_count",
            "historical_avg_discharge_rate",
            "predicted_free_beds",
            "source_name",
        ]
    ].reset_index(drop=True)


def _load_tabular_files(directory: Path) -> tuple[list[str], list[pd.DataFrame]]:
    frames: list[pd.DataFrame] = []
    source_files: list[str] = []

    for file_path in sorted(directory.glob("*")):
        if file_path.suffix.lower() == ".csv":
            frames.append(pd.read_csv(file_path))
            source_files.append(file_path.name)
        elif file_path.suffix.lower() in {".json", ".jsonl"}:
            lines = file_path.suffix.lower() == ".jsonl"
            frames.append(pd.read_json(file_path, lines=lines))
            source_files.append(file_path.name)

    return source_files, frames


def ingest_real_datasets(base_dir: Path | None = None) -> dict[str, IngestionSummary]:
    paths = ensure_ml_directories(base_dir)
    triage_dir = paths["raw"] / "triage"
    beds_dir = paths["raw"] / "beds"

    triage_files, triage_frames = _load_tabular_files(triage_dir)
    bed_files, bed_frames = _load_tabular_files(beds_dir)

    if triage_frames:
        triage_combined = pd.concat(
            [
                normalize_triage_dataframe(frame, source_name=file_name)
                for file_name, frame in zip(triage_files, triage_frames)
            ],
            ignore_index=True,
        )
        triage_path = paths["processed"] / "triage_dataset.csv"
        triage_combined.to_csv(triage_path, index=False)
        triage_summary = IngestionSummary(
            dataset_name="triage",
            source_files=triage_files,
            raw_rows=sum(len(frame) for frame in triage_frames),
            processed_rows=len(triage_combined),
            output_path=str(triage_path),
            status="processed",
        )
    else:
        triage_summary = IngestionSummary(
            dataset_name="triage",
            source_files=[],
            raw_rows=0,
            processed_rows=0,
            output_path=None,
            status="missing",
        )

    if bed_frames:
        bed_combined = pd.concat(
            [
                normalize_bed_dataframe(frame, source_name=file_name)
                for file_name, frame in zip(bed_files, bed_frames)
            ],
            ignore_index=True,
        )
        bed_path = paths["processed"] / "bed_dataset.csv"
        bed_combined.to_csv(bed_path, index=False)
        bed_summary = IngestionSummary(
            dataset_name="beds",
            source_files=bed_files,
            raw_rows=sum(len(frame) for frame in bed_frames),
            processed_rows=len(bed_combined),
            output_path=str(bed_path),
            status="processed",
        )
    else:
        bed_summary = IngestionSummary(
            dataset_name="beds",
            source_files=[],
            raw_rows=0,
            processed_rows=0,
            output_path=None,
            status="missing",
        )

    report = {
        "triage": triage_summary.__dict__,
        "beds": bed_summary.__dict__,
    }
    report_path = paths["artifacts"] / "ingestion_report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return {
        "triage": triage_summary,
        "beds": bed_summary,
    }
