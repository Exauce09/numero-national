"""Schémas Module 5 FGP — pas de NIN en entrée client."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class FgpCatalogOut(BaseModel):
    module: int = 5
    title: str = "Fichier Général de la Population"
    offline_nin_forbidden: bool = True
    auto_merge_forbidden: bool = True
    invent_nin_forbidden: bool = True
    note: str
    endpoints: dict[str, str]
    maps_to: str = "core_registry (citizens) — pas de tables dupliquées"


class FgpHealthOut(BaseModel):
    generated_at: datetime
    citizens_total: int
    with_nic: int
    without_nic: int
    by_status: dict[str, int]
    open_duplicates: int
    provisional_nic_only: bool = True
    official_nin_format_confirmed: bool = False
    offline_nin_forbidden: bool = True


class FgpEventIn(BaseModel):
    """Ingestion idempotente d'un événement source vers le FGP."""

    source: str = Field(min_length=2, max_length=64, description="census|civil|enrollment|manual|…")
    source_event_id: str = Field(min_length=2, max_length=128, description="Clé d'idempotence")
    citizen_id: UUID
    event_type: str = Field(min_length=2, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)
    effective_date: date | None = None


class FgpEventOut(BaseModel):
    id: str
    source: str
    source_event_id: str
    citizen_id: UUID
    event_type: str
    already_processed: bool
    created_at: datetime | None = None
    message: str


class FgpCorrectionIn(BaseModel):
    citizen_id: UUID
    field_name: str = Field(min_length=1, max_length=64)
    proposed_value: str = Field(min_length=1, max_length=2000)
    reason: str = Field(min_length=10, max_length=4000)
    current_value: str | None = Field(default=None, max_length=2000)


class FgpCorrectionOut(BaseModel):
    citizen_id: UUID
    status: str = "REQUESTED"
    field_name: str
    history_id: UUID
    message: str


class FgpRelationIn(BaseModel):
    related_citizen_id: UUID
    relation_type: str = Field(min_length=2, max_length=32)
    legal_basis: str | None = Field(default=None, max_length=2000)


class FgpRelationOut(BaseModel):
    id: UUID
    citizen_id: UUID
    related_citizen_id: UUID
    relation_type: str
    legal_basis: str | None = None

    model_config = {"from_attributes": True}
