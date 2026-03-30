from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import app
CONTRACT_PATH = ROOT / "contracts" / "api-contract.json"


def main() -> int:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    expected_routes = {
        (route["method"], route["path"])
        for route in contract["httpRoutes"]
    }
    actual_routes: set[tuple[str, str]] = set()

    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None)
        if not path or not methods:
            continue
        if not (path.startswith("/api") or path in {"/health", "/livez", "/readyz", "/metrics"}):
            continue
        for method in methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            actual_routes.add((method, path))

    missing = sorted(expected_routes - actual_routes)
    unexpected = sorted(actual_routes - expected_routes)

    if missing or unexpected:
        if missing:
            print("Missing backend routes:")
            for method, path in missing:
                print(f"  - {method} {path}")
        if unexpected:
            print("Unexpected backend routes:")
            for method, path in unexpected:
                print(f"  - {method} {path}")
        return 1

    print("Backend contract verification passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
