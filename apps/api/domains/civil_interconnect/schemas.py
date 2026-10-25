"""Schémas Module 8 — interconnexion état civil."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


EVENT_TYPES = (
    "BIRTH",
    "MARRIAGE",
    "DIVORCE",
    "DEATH",
    "RECTIFICATION",
    "RECOGNITION",
    "ADOPTION",
    "ANNULATION",
)


class CivilEventIn(BaseModel):
    source_id: str = Field(min_length=2, max_length=64)
    source_event_id: str = Field(min_length=1, max_length=128)
    event_type: Literal[
        "BIRTH",
        "MARRIAGE",
        "DIVORCE",
        "DEATH",
        "RECTIFICATION",
        "RECOGNITION",
        "ADOPTION",
        "ANNULATION",
    ]
    act_reference: str | None = Field(default=None, max_length=128)
    issuing_authority: str | None = Field(default=None, max_length=256)
    event_date: date | None = None
    effective_date: date | None = None
    person_reference: str | None = Field(
        default=None,
        max_length=128,
        description="Référence personne côté source (≠ NIN)",
    )
    citizen_id: UUID | None = Field(
        default=None,
        description="Identifiant interne FGP si déjà connu",
    )
    candidate_citizen_ids: list[UUID] = Field(default_factory=list)
    payload: dict[str, Any] = Field(default_factory=dict)
    contract_version: str = Field(default="1.0", max_length=32)


class CivilEventAck(BaseModel):
    """Accusé technique ≠ résultat métier appliqué."""

    id: str
    source_id: str
    source_event_id: str
    event_type: str
    processing_status: str
    technical_ack: bool = True
    business_applied: bool = False
    already_processed: bool = False
    correlation_id: str
    message: str
    received_at: datetime | None = None


class CivilEventStatusOut(BaseModel):
    id: str
    source_id: str
    source_event_id: str
    event_type: str
    processing_status: str
    act_reference: str | None = None
    citizen_id: str | None = None
    technical_ack: bool = True
    business_applied: bool = False
    received_at: datetime | None = None
    effective_date: date | None = None
    applied_at: datetime | None = None
    quarantine_reason: str | None = None
    invent_nin_forbidden: bool = True


class MatchingDecisionIn(BaseModel):
    decision: Literal["LINK_CITIZEN", "QUARANTINE", "REJECT", "ESCALATE"]
    motif: str = Field(min_length=8, max_length=2000)
    citizen_id: UUID | None = None


class CivilCatalogOut(BaseModel):
    module: int = 8
    title: str = "Interconnexion état civil"
    invent_nin_forbidden: bool = True
    offline_nin_forbidden: bool = True
    silent_overwrite_forbidden: bool = True
    census_to_act_forbidden: bool = True
    last_message_wins_forbidden: bool = True
    auto_apply_ambiguous_forbidden: bool = True
    recycle_nin_on_death_forbidden: bool = True
    technical_ack_distinct_from_applied: bool = True
    authorized_sources: list[dict[str, Any]]
    event_types: list[str]
    processing_statuses: list[str]
    endpoints: dict[str, str]
    note: str
