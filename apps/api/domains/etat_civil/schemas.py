"""Pydantic schemas for état civil API."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from apps.api.domains.etat_civil.enums import (
    ActStatus,
    ActType,
    DeclarationSource,
    DeclarationStatus,
    DeclarationType,
    ResidenceStatus,
)


class PopulationSearchQuery(BaseModel):
    """Stub search against conceptual citizen_reference."""

    q: str | None = None
    family_name: str | None = None
    given_names: str | None = None
    date_of_birth: str | None = None
    commune_code: str | None = None
    limit: int = Field(default=20, ge=1, le=100)


class PopulationHit(BaseModel):
    citizen_id: UUID | None = None
    nic: str | None = None
    given_names: str | None = None
    family_name: str | None = None
    date_of_birth: str | None = None
    status: str | None = None
    source: str = "citizen_reference"


class CivilActCreate(BaseModel):
    act_type: ActType | None = None
    act_number: str | None = None
    commune_code: str
    citizen_id: UUID | None = None
    related_citizen_ids: list[UUID] | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    status: ActStatus = ActStatus.DRAFT
    bureau_id: UUID | None = None


class CivilActRead(BaseModel):
    id: UUID
    act_type: str
    act_number: str
    commune_code: str
    status: str
    citizen_id: UUID | None
    related_citizen_ids: list[Any] | None
    payload: dict[str, Any]
    issued_at: datetime | None
    validated_by: UUID | None
    bureau_id: UUID | None = None
    verification_code: str | None = None
    version: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MentionCreate(BaseModel):
    target_act_id: UUID
    mention_type: str
    source_act_id: UUID | None = None
    authority: str | None = None
    reference: str | None = None
    justificatif: str | None = None


class MentionRead(BaseModel):
    id: UUID
    target_act_id: UUID
    mention_type: str
    source_act_id: UUID | None
    authority: str | None
    mention_date: Any | None
    reference: str | None
    justificatif: str | None
    created_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FiliationCreate(BaseModel):
    relation_type: str
    parent_citizen_id: UUID | None = None
    child_citizen_id: UUID | None = None
    parent_label: str | None = None
    child_label: str | None = None
    act_id: UUID | None = None


class FiliationRead(BaseModel):
    id: UUID
    relation_type: str
    parent_citizen_id: UUID | None
    child_citizen_id: UUID | None
    parent_label: str | None
    child_label: str | None
    act_id: UUID | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TranscriptionCreate(BaseModel):
    source_act_ref: str = Field(min_length=2, max_length=255)
    source_place: str | None = None
    source_authority: str | None = None
    source_date: str | None = None  # YYYY-MM-DD
    source_number: str | None = None
    bureau_id: UUID | None = None
    citizen_id: UUID | None = None
    resulting_act_id: UUID | None = None
    status: str = "REGISTERED"


class TranscriptionRead(BaseModel):
    id: UUID
    source_act_ref: str
    source_place: str | None
    source_authority: str | None
    source_date: Any | None
    source_number: str | None
    bureau_id: UUID | None
    citizen_id: UUID | None
    resulting_act_id: UUID | None
    status: str
    created_by: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ActTransitionRequest(BaseModel):
    status: ActStatus
    officer_name: str | None = None
    officer_matricule: str | None = None
    seal_ref: str | None = None
    signature_ref: str | None = None


class OfficialExtract(BaseModel):
    act: CivilActRead
    mentions: list[MentionRead]
    verification_code: str | None
    qr: dict[str, Any] | None = None
    authentication: dict[str, Any] | None = None
    conservation: dict[str, Any]


class DocumentVerifyRequest(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class DeclarationCreate(BaseModel):
    source: DeclarationSource = DeclarationSource.HOSPITAL
    declaration_type: DeclarationType
    payload: dict[str, Any] = Field(default_factory=dict)


class DeclarationRead(BaseModel):
    id: UUID
    source: str
    declaration_type: str
    payload: dict[str, Any]
    status: str
    linked_act_id: UUID | None
    created_at: datetime
    notification: dict[str, Any] | None = None

    model_config = {"from_attributes": True}


class DeclarationValidateRequest(BaseModel):
    commune_code: str
    act_number: str | None = None
    citizen_id: UUID | None = None
    related_citizen_ids: list[UUID] | None = None
    payload_overrides: dict[str, Any] | None = None
    reject: bool = False
    rejection_reason: str | None = None


class ResidenceCreate(BaseModel):
    citizen_id: UUID
    line1: str
    line2: str | None = None
    city: str
    commune_code: str
    province_code: str | None = None
    country_code: str = "COD"
    attestation_number: str | None = None
    status: ResidenceStatus = ResidenceStatus.ACTIVE
    notes: str | None = None


class ResidenceRead(BaseModel):
    id: UUID
    citizen_id: UUID
    line1: str
    line2: str | None
    city: str
    commune_code: str
    province_code: str | None
    country_code: str
    attestation_number: str
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StatsByActType(BaseModel):
    commune_code: str
    counts: dict[str, int]
    total: int
