"""Civil administrative configuration (not legal statutes).

Values here are operational defaults and may be overridden by deployment config.
They must NOT be presented as legally mandatory without a verified source.
"""

from __future__ import annotations

from typing import Any

# Act types still accepted for write via /civil/* collections.
ACT_TYPES_ENABLED: frozenset[str] = frozenset(
    {
        "BIRTH",
        "MARRIAGE",
        "DIVORCE",
        "DEATH",
        "RECOGNITION",
        "ADOPTION",
        "RECTIFICATION",
    }
)

# Deprecated as état-civil acts (kept readable historically).
ACT_TYPES_DEPRECATED_WRITE: frozenset[str] = frozenset(
    {"DISPLACEMENT", "CENSUS", "RESIDENCE_ATTESTATION", "DOCUMENT"}
)

# Administrative numbering hint — not a legal prescription.
NUMBERING_PATTERN: str = "{commune_code}/{year}/{seq:06d}"

# Allowed status transitions (configurable workflow).
WORKFLOW_TRANSITIONS: dict[str, frozenset[str]] = {
    "DRAFT": frozenset({"SUBMITTED", "REJECTED"}),
    "SUBMITTED": frozenset({"UNDER_REVIEW", "REJECTED", "VALIDATED"}),
    "UNDER_REVIEW": frozenset({"VALIDATED", "REJECTED", "SUBMITTED"}),
    "VALIDATED": frozenset({"ARCHIVED"}),
    "REJECTED": frozenset({"DRAFT", "SUBMITTED"}),
    "ARCHIVED": frozenset(),
}


def can_transition(current: str, target: str) -> bool:
    return target in WORKFLOW_TRANSITIONS.get(current, frozenset())


def public_config() -> dict[str, Any]:
    return {
        "source": "administrative_config",
        "disclaimer": "Not a legal statute; verify against Code de la famille / texts in force.",
        "act_types_enabled": sorted(ACT_TYPES_ENABLED),
        "act_types_deprecated_write": sorted(ACT_TYPES_DEPRECATED_WRITE),
        "numbering_pattern": NUMBERING_PATTERN,
        "workflow_transitions": {k: sorted(v) for k, v in WORKFLOW_TRANSITIONS.items()},
    }
