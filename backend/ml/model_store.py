from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib


def load_model_artifact(path: str | Path) -> dict[str, Any]:
    raw = joblib.load(path)
    if isinstance(raw, dict) and "model" in raw:
        artifact = dict(raw)
    else:
        artifact = {"model": raw}

    artifact.setdefault("features", [])
    artifact.setdefault("metadata", {})
    return artifact


def save_model_artifact(path: str | Path, artifact: dict[str, Any]) -> None:
    joblib.dump(artifact, path)
