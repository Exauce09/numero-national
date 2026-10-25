"""Store process-local Module 8 (sources + événements) — sans inventer de NIN.

Persistance durable via migration à prévoir ; ce store couvre audit/tests/MVP
interconnexion (idempotence, quarantaine, matching).
"""

from __future__ import annotations

import hashlib
import threading
import uuid
from copy import deepcopy
from datetime import date, datetime, timezone
from typing import Any

AUTHORIZED_SOURCES: dict[str, dict[str, Any]] = {
    "EC_KIN_DEMO": {
        "source_id": "EC_KIN_DEMO",
        "label": "État civil Kinshasa (démo)",
        "active": True,
        "contract_version": "1.0",
        "allowed_event_types": [
            "BIRTH",
            "MARRIAGE",
            "DIVORCE",
            "DEATH",
            "RECTIFICATION",
            "RECOGNITION",
            "ADOPTION",
            "ANNULATION",
        ],
    },
    "HOSPITAL_DEMO": {
        "source_id": "HOSPITAL_DEMO",
        "label": "Déclarations hôpital (démo)",
        "active": True,
        "contract_version": "1.0",
        "allowed_event_types": ["BIRTH", "DEATH"],
    },
    "EC_REVOKED": {
        "source_id": "EC_REVOKED",
        "label": "Source révoquée (tests)",
        "active": False,
        "contract_version": "1.0",
        "allowed_event_types": ["BIRTH"],
    },
}

PROCESSING_STATUSES = (
    "RECEIVED",
    "DUPLICATE_MESSAGE",
    "MATCH_REVIEW",
    "READY_TO_APPLY",
    "APPLIED",
    "REJECTED",
    "QUARANTINED",
)

_lock = threading.RLock()
_events: dict[str, dict[str, Any]] = {}
_by_source_key: dict[str, str] = {}  # source_id:source_event_id -> event id
_matching: dict[str, dict[str, Any]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def payload_hash(payload: dict[str, Any] | None) -> str:
    raw = repr(sorted((payload or {}).items())).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:32]


def source_key(source_id: str, source_event_id: str) -> str:
    return f"{source_id.strip()}:{source_event_id.strip()}"


def get_source(source_id: str) -> dict[str, Any] | None:
    return AUTHORIZED_SOURCES.get(source_id.strip())


def list_sources() -> list[dict[str, Any]]:
    return [deepcopy(v) for v in AUTHORIZED_SOURCES.values()]


def reset_store() -> None:
    """Tests uniquement."""
    with _lock:
        _events.clear()
        _by_source_key.clear()
        _matching.clear()


def find_by_source_key(source_id: str, source_event_id: str) -> dict[str, Any] | None:
    with _lock:
        eid = _by_source_key.get(source_key(source_id, source_event_id))
        if not eid:
            return None
        row = _events.get(eid)
        return deepcopy(row) if row else None


def get_event(event_id: str) -> dict[str, Any] | None:
    with _lock:
        row = _events.get(event_id)
        return deepcopy(row) if row else None


def list_events(*, limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        rows = sorted(
            _events.values(),
            key=lambda r: r.get("received_at") or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )
        if status:
            rows = [r for r in rows if r.get("processing_status") == status]
        return [deepcopy(r) for r in rows[:limit]]


def save_event(row: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        eid = row["id"]
        _events[eid] = deepcopy(row)
        _by_source_key[source_key(row["source_id"], row["source_event_id"])] = eid
        return deepcopy(row)


def create_matching_case(
    *,
    event_id: str,
    candidate_citizen_ids: list[str],
    reason: str,
) -> dict[str, Any]:
    with _lock:
        mid = str(uuid.uuid4())
        case = {
            "id": mid,
            "event_id": event_id,
            "candidate_citizen_ids": list(candidate_citizen_ids),
            "status": "OPEN",
            "reason": reason,
            "created_at": _now().isoformat(),
            "decisions": [],
        }
        _matching[mid] = case
        return deepcopy(case)


def list_matching(*, limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        rows = sorted(
            _matching.values(),
            key=lambda r: r.get("created_at") or "",
            reverse=True,
        )
        return [deepcopy(r) for r in rows[:limit]]


def get_matching(case_id: str) -> dict[str, Any] | None:
    with _lock:
        row = _matching.get(case_id)
        return deepcopy(row) if row else None


def save_matching(case: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        _matching[case["id"]] = deepcopy(case)
        return deepcopy(case)


def new_event_id() -> str:
    return str(uuid.uuid4())


def iso_date(d: date | None) -> str | None:
    return d.isoformat() if d else None
