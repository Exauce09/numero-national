"""Store process-local demandes CIN / lots (Module 9 MVP) — pas de NIN inventé."""

from __future__ import annotations

import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

# Gabarit prototype — jamais « officiel » tant que non homologué
TEMPLATE_APPROVED = False
TEMPLATE_VERSION = "prototype-rdc-html-v1-NOT-OFFICIAL"
PROTOTYPE_VALIDITY_DAYS = 365 * 10  # indicatif, non juridique

REQUEST_TYPES = ("FIRST_ISSUE", "RENEWAL", "REPLACE", "LOST", "STOLEN")
REQUEST_STATUSES = (
    "DRAFT",
    "SUBMITTED",
    "ELIGIBILITY_REVIEW",
    "ADMISSIBLE",
    "BLOCKED",
    "APPROVED_FOR_PERSONALIZATION",
    "APPROVED_FOR_PRODUCTION",
    "IN_BATCH",
    "CANCELLED",
)

_lock = threading.RLock()
_requests: dict[str, dict[str, Any]] = {}
_by_idem: dict[str, str] = {}
_batches: dict[str, dict[str, Any]] = {}


def reset_store() -> None:
    with _lock:
        _requests.clear()
        _by_idem.clear()
        _batches.clear()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


def find_by_idempotency(key: str | None) -> dict[str, Any] | None:
    if not key or not key.strip():
        return None
    with _lock:
        rid = _by_idem.get(key.strip())
        return deepcopy(_requests[rid]) if rid and rid in _requests else None


def get_request(request_id: str) -> dict[str, Any] | None:
    with _lock:
        row = _requests.get(request_id)
        return deepcopy(row) if row else None


def save_request(row: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        _requests[row["id"]] = deepcopy(row)
        key = row.get("idempotency_key")
        if key:
            _by_idem[str(key).strip()] = row["id"]
        return deepcopy(row)


def list_requests(*, limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    with _lock:
        rows = sorted(
            _requests.values(),
            key=lambda r: r.get("created_at") or "",
            reverse=True,
        )
        if status:
            rows = [r for r in rows if r.get("status") == status]
        return [deepcopy(r) for r in rows[:limit]]


def save_batch(row: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        _batches[row["id"]] = deepcopy(row)
        return deepcopy(row)


def get_batch(batch_id: str) -> dict[str, Any] | None:
    with _lock:
        row = _batches.get(batch_id)
        return deepcopy(row) if row else None


def list_batches(*, limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        rows = sorted(
            _batches.values(),
            key=lambda r: r.get("created_at") or "",
            reverse=True,
        )
        return [deepcopy(r) for r in rows[:limit]]
