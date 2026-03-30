from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict


@dataclass
class MonitoringState:
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    total_requests: int = 0
    error_requests: int = 0
    route_counts: Dict[str, int] = field(default_factory=dict)
    last_request_at: datetime | None = None

    def record(self, *, path: str, status_code: int) -> None:
        self.total_requests += 1
        if status_code >= 500:
            self.error_requests += 1
        self.route_counts[path] = self.route_counts.get(path, 0) + 1
        self.last_request_at = datetime.now(timezone.utc)

    def snapshot(self) -> dict:
        uptime_seconds = max(
            0,
            int((datetime.now(timezone.utc) - self.started_at).total_seconds()),
        )
        return {
            "uptime_seconds": uptime_seconds,
            "total_requests": self.total_requests,
            "error_requests": self.error_requests,
            "last_request_at": self.last_request_at.isoformat() if self.last_request_at else None,
            "route_counts": self.route_counts,
        }


monitoring_state = MonitoringState()
