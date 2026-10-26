"""Pydantic request/response schemas for Core Registry.

List endpoints intentionally expose minimal PII.
NIC is never accepted as client input on create/update.
"""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from apps.api.domains.core_registry.enums import (
    AddressType,
    CitizenStatus,
    Sex,
)


class CitizenAddressIn(BaseModel):
    address_type: AddressType = AddressType.RESIDENTIAL
    line1: str = Field(min_length=1, max_length=255)
    line2: str | None = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=128)
    commune_code: str | None = Field(default=None, max_length=32)
    province_code: str | None = Field(default=None, max_length=32)
    country_code: str = Field(default="COD", min_length=2, max_length=3)
    is_primary: bool = False
    valid_from: date | None = None
    valid_to: date | None = None


class CitizenAddressOut(CitizenAddressIn):
    model_config = ConfigDict(from_attributes=True)

    id: UUID


class CitizenCreate(BaseModel):
    """Draft citizen creation — NIC is never accepted.

    Champs alignés décret 22/07 art. 8 (fiche FGP / identification RDC).
    """

    sex: Sex = Sex.UNKNOWN
    date_of_birth: date
    place_of_birth: str | None = Field(default=None, max_length=255)
    nationality: str = Field(default="COD", min_length=2, max_length=3)
    given_names: str = Field(min_length=1, max_length=255)
    family_name: str = Field(min_length=1, max_length=255)
    post_name: str | None = Field(default=None, max_length=255, description="Postnom")
    other_names: str | None = Field(default=None, max_length=255)
    birth_certificate_number: str | None = Field(default=None, max_length=128)
    height_cm: float | None = Field(default=None, ge=30, le=272)
    eye_color: str | None = Field(default=None, max_length=64)
    occupation: str | None = Field(default=None, max_length=255)
    marital_status: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    origin_province: str | None = Field(default=None, max_length=128)
    origin_territory: str | None = Field(default=None, max_length=128)
    origin_secteur: str | None = Field(default=None, max_length=128)
    origin_groupement: str | None = Field(default=None, max_length=128)
    origin_localite: str | None = Field(default=None, max_length=128)
    father_full_name: str | None = Field(default=None, max_length=255)
    father_occupation: str | None = Field(default=None, max_length=255)
    father_nationality: str | None = Field(default=None, min_length=2, max_length=3)
    mother_full_name: str | None = Field(default=None, max_length=255)
    mother_occupation: str | None = Field(default=None, max_length=255)
    mother_nationality: str | None = Field(default=None, min_length=2, max_length=3)
    person_kind: str = Field(
        default="ADULT",
        max_length=16,
        description="NEWBORN (bébé) ou ADULT (parent / personne)",
    )
    addresses: list[CitizenAddressIn] = Field(default_factory=list)

    @field_validator("given_names", "family_name")
    @classmethod
    def strip_names(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name must not be blank")
        return cleaned

    @field_validator("person_kind")
    @classmethod
    def normalize_person_kind(cls, value: str) -> str:
        kind = (value or "ADULT").strip().upper()
        if kind in {"BEBE", "BÉBÉ", "NOUVEAU_NE", "NOUVEAU-NE", "NEW_BORN"}:
            return "NEWBORN"
        if kind not in {"NEWBORN", "ADULT"}:
            raise ValueError("person_kind must be NEWBORN or ADULT")
        return kind

    @field_validator(
        "post_name",
        "other_names",
        "occupation",
        "eye_color",
        "phone",
        "email",
        "father_full_name",
        "mother_full_name",
        mode="before",
    )
    @classmethod
    def empty_to_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value.strip() if isinstance(value, str) else value


class CitizenUpdate(BaseModel):
    """Limited updates allowed only before validation."""

    sex: Sex | None = None
    date_of_birth: date | None = None
    place_of_birth: str | None = Field(default=None, max_length=255)
    nationality: str | None = Field(default=None, min_length=2, max_length=3)
    given_names: str | None = Field(default=None, min_length=1, max_length=255)
    family_name: str | None = Field(default=None, min_length=1, max_length=255)
    post_name: str | None = Field(default=None, max_length=255)
    other_names: str | None = Field(default=None, max_length=255)
    birth_certificate_number: str | None = Field(default=None, max_length=128)
    height_cm: float | None = Field(default=None, ge=30, le=272)
    eye_color: str | None = Field(default=None, max_length=64)
    occupation: str | None = Field(default=None, max_length=255)
    marital_status: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=64)
    email: str | None = Field(default=None, max_length=255)
    origin_province: str | None = Field(default=None, max_length=128)
    origin_territory: str | None = Field(default=None, max_length=128)
    origin_secteur: str | None = Field(default=None, max_length=128)
    origin_groupement: str | None = Field(default=None, max_length=128)
    origin_localite: str | None = Field(default=None, max_length=128)
    father_full_name: str | None = Field(default=None, max_length=255)
    father_occupation: str | None = Field(default=None, max_length=255)
    father_nationality: str | None = Field(default=None, min_length=2, max_length=3)
    mother_full_name: str | None = Field(default=None, max_length=255)
    mother_occupation: str | None = Field(default=None, max_length=255)
    mother_nationality: str | None = Field(default=None, min_length=2, max_length=3)
    person_kind: str | None = Field(default=None, max_length=16)
    reason: str | None = Field(
        default=None,
        max_length=2000,
        description="Motif de modification (historisé)",
    )


class CitizenDetail(BaseModel):
    """Full citizen detail for authorized read."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nic: str | None
    status: CitizenStatus
    sex: Sex
    date_of_birth: date
    place_of_birth: str | None
    nationality: str
    given_names: str
    family_name: str
    post_name: str | None = None
    other_names: str | None = None
    birth_certificate_number: str | None = None
    height_cm: float | None = None
    eye_color: str | None = None
    occupation: str | None = None
    marital_status: str | None = None
    phone: str | None = None
    email: str | None = None
    origin_province: str | None = None
    origin_territory: str | None = None
    origin_secteur: str | None = None
    origin_groupement: str | None = None
    origin_localite: str | None = None
    father_full_name: str | None = None
    father_occupation: str | None = None
    father_nationality: str | None = None
    mother_full_name: str | None = None
    mother_occupation: str | None = None
    mother_nationality: str | None = None
    person_kind: str = "ADULT"
    created_at: datetime
    updated_at: datetime
    validated_at: datetime | None
    deceased_at: datetime | None
    merged_into_id: UUID | None
    addresses: list[CitizenAddressOut] = Field(default_factory=list)


class CitizenListItem(BaseModel):
    """Search/list hit enriched for autofill (still permission-gated)."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nic: str | None
    status: CitizenStatus
    family_name: str
    given_names: str
    post_name: str | None = None
    date_of_birth: date
    sex: Sex = Sex.UNKNOWN
    place_of_birth: str | None = None
    person_kind: str = "ADULT"
    province_code: str | None = None
    ville: str | None = None
    commune_code: str | None = None


class CitizenSearchParams(BaseModel):
    q: str | None = None
    family_name: str | None = None
    given_names: str | None = None
    nic: str | None = None
    date_of_birth: date | None = None
    status: CitizenStatus | None = None
    sex: Sex | None = None
    place_of_birth: str | None = None
    province_code: str | None = None
    commune_code: str | None = None
    include_closed: bool = False
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class PaginatedCitizens(BaseModel):
    items: list[CitizenListItem]
    total: int
    page: int
    page_size: int


class CitizenValidateResponse(BaseModel):
    id: UUID
    nic: str
    status: CitizenStatus
    validated_at: datetime
    duplicate_candidates_created: int = 0


class CitizenMergeRequest(BaseModel):
    source_citizen_id: UUID
    target_citizen_id: UUID
    justification: str = Field(min_length=10, max_length=4000)


class CitizenMergeResponse(BaseModel):
    source_citizen_id: UUID
    target_citizen_id: UUID
    source_status: CitizenStatus
    message: str


class CitizenHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    citizen_id: UUID
    event_type: str
    payload: dict
    actor_id: UUID | None
    created_at: datetime


class PaginatedCitizenHistory(BaseModel):
    items: list[CitizenHistoryItem]
    total: int
    page: int
    page_size: int


class CitizenSubmitRequest(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


class CitizenStatusChangeRequest(BaseModel):
    status: CitizenStatus
    reason: str = Field(min_length=5, max_length=4000)


class DuplicateCandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    citizen_a_id: UUID
    citizen_b_id: UUID
    other_citizen_id: UUID | None = None
    score: float
    status: str
    match_method: str
    created_at: datetime
    other_family_name: str | None = None
    other_given_names: str | None = None
    other_date_of_birth: date | None = None
    other_status: str | None = None
    other_nic: str | None = None


class DuplicateResolveRequest(BaseModel):
    """Résolution manuelle — jamais une fusion automatique."""

    decision: str = Field(
        description="FALSE_POSITIVE | CONFIRMED_DUPLICATE (fusion via POST /citizens/merge)"
    )
    justification: str = Field(min_length=10, max_length=4000)


class DuplicateResolveResponse(BaseModel):
    id: UUID
    status: str
    message: str


class SimilarSearchResponse(BaseModel):
    items: list[CitizenListItem]
    total: int
    message: str = "Candidats potentiels — revue humaine requise, pas de fusion automatique"
