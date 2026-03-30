from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def register_experiment(
    *,
    model_name: str,
    artifact_path: Path,
    metadata: dict[str, Any],
    validation: dict[str, Any],
    artifacts_dir: Path,
) -> str:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    version = f"{model_name}-{datetime.now(timezone.utc):%Y%m%d%H%M%S}"

    experiment_log_path = artifacts_dir / "experiment_runs.jsonl"
    registry_path = artifacts_dir / "model_registry.json"
    record = {
        "model_name": model_name,
        "version": version,
        "artifact_path": str(artifact_path),
        "timestamp": utc_iso_now(),
        "metadata": metadata,
        "validation": validation,
    }

    with experiment_log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")

    if registry_path.exists():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
    else:
        registry = {}

    registry[model_name] = {
        "latest_version": version,
        "artifact_path": str(artifact_path),
        "updated_at": record["timestamp"],
        "validation": validation,
        "metadata": metadata,
    }
    registry_path.write_text(json.dumps(registry, indent=2), encoding="utf-8")
    return version
