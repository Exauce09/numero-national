"""Schémas Module 12 — aucun NIN en entrée client."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

MovementType = Literal[
    "CHANGE_OF_RESIDENCE",
    "INTERNAL_MIGRATION",
    "TEMPORARY_MOBILITY",
    "FORCED_DISPLACEMENT",
    "RETURN_RESETTLEMENT",
    "INTERNATIONAL",
    "COLLECTIVE",
]

MovementStatus = Literal[
    "DRAFT",
    "SUBMITTED",
    "IN_REVIEW",
    "COMPLEMENT_REQUIRED",
    "VALIDATED",
    "REJECTED",
    "CANCELLED",
    "CONTESTED",
]


class MovementCreate(BaseModel):
    citizen_id: UUID
    movement_type: MovementType
    source_type: str = Field(default="AGENT", max_length=32)
    source_reference: str | None = Field(default=None, max_length=128)
    observed_date: date | None = None
    effective_date: date | None = None
    reason_code: str | None = Field(default=None, max_length=64)
    notes_minimal: str | None = Field(default=None, max_length=500)
    origin_province_code: str | None = Field(default=None, max_length=32)
    origin_commune_code: str | None = Field(default=None, max_length=64)
    origin_label: str | None = Field(default=None, max_length=255)
    destination_province_code: str | None = Field(default=None, max_length=32)
    destination_commune_code: str | None = Field(default=None, max_length=64)
    destination_city: str | None = Field(default=None, max_length=128)
    destination_line1: str | None = Field(default=None, max_length=255)
    destination_label: str | None = Field(default=None, max_length=255)
    update_fgp_residence: bool = False
    submit: bool = Field(default=False, description="Créer directement en SUBMITTED")
    idempotency_key: str | None = Field(default=None, max_length=128)

    @field_validator("notes_minimal", "reason_code", mode="before")
    @classmethod
    def strip_optional(cls, v: Any) -> Any:
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v


class MovementPatch(BaseModel):
    observed_date: date | None = None
    effective_date: date | None = None
    reason_code: str | None = Field(default=None, max_length=64)
    notes_minimal: str | None = Field(default=None, max_length=500)
    origin_province_code: str | None = Field(default=None, max_length=32)
    origin_commune_code: str | None = Field(default=None, max_length=64)
    origin_label: str | None = Field(default=None, max_length=255)
    destination_province_code: str | None = Field(default=None, max_length=32)
    destination_commune_code: str | None = Field(default=None, max_length=64)
    destination_city: str | None = Field(default=None, max_length=128)
    destination_line1: str | None = Field(default=None, max_length=255)
    destination_label: str | None = Field(default=None, max_length=255)
    update_fgp_residence: bool | None = None


class MovementReviewIn(BaseModel):
    decision: Literal["IN_REVIEW", "COMPLEMENT_REQUIRED", "REJECTED"]
    reason: str = Field(min_length=5, max_length=500)


class MovementApproveIn(BaseModel):
    reason: str | None = Field(default=None, max_length=500)
    apply_fgp_residence: bool | None = Field(
        default=None,
        description="Force l'application FGP si destination renseignée (défaut = flag dossier)",
    )


class MovementCorrectIn(BaseModel):
    reason: str = Field(min_length=8, max_length=500)
    notes_minimal: str | None = Field(default=None, max_length=500)


class MovementHistoryOut(BaseModel):
    id: UUID
    event_type: str
    old_status: str | None = None
    new_status: str | None = None
    actor_id: UUID | None = None
    occurred_at: datetime
    note: str | None = None
    payload: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class MovementOut(BaseModel):
    id: UUID
    citizen_id: UUID
    movement_type: str
    status: str
    declared_at: datetime
    observed_date: date | None = None
    effective_date: date | None = None
    verified_at: datetime | None = None
    source_type: str
    source_reference: str | None = None
    reason_code: str | None = None
    notes_minimal: str | None = None
    origin_province_code: str | None = None
    origin_commune_code: str | None = None
    origin_label: str | None = None
    destination_province_code: str | None = None
    destination_commune_code: str | None = None
    destination_city: str | None = None
    destination_line1: str | None = None
    destination_label: str | None = None
    sensitivity_class: str
    update_fgp_residence: bool
    fgp_residence_applied: bool
    created_by: UUID | None = None
    reviewed_by: UUID | None = None
    validated_by: UUID | None = None
    decision_reason: str | None = None
    version: int
    created_at: datetime
    updated_at: datetime
    history: list[MovementHistoryOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MovementListOut(BaseModel):
    items: list[MovementOut]
    total: int
    page: int
    page_size: int


class MovementStatsOut(BaseModel):
    generated_at: datetime
    total: int
    by_status: dict[str, int]
    by_type: dict[str, int]
    pending_review: int
    validated: int
    fgp_residence_updates: int
    note: str
