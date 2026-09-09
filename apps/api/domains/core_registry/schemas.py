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
    """Draft citizen creation — NIC is never accepted."""

    sex: Sex = Sex.UNKNOWN
    date_of_birth: date
    place_of_birth: str | None = Field(default=None, max_length=255)
    nationality: str = Field(default="COD", min_length=2, max_length=3)
    given_names: str = Field(min_length=1, max_length=255)
    family_name: str = Field(min_length=1, max_length=255)
    addresses: list[CitizenAddressIn] = Field(default_factory=list)

    @field_validator("given_names", "family_name")
    @classmethod
    def strip_names(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name must not be blank")
        return cleaned


class CitizenUpdate(BaseModel):
    """Limited updates allowed only before validation."""

    sex: Sex | None = None
    date_of_birth: date | None = None
    place_of_birth: str | None = Field(default=None, max_length=255)
    nationality: str | None = Field(default=None, min_length=2, max_length=3)
    given_names: str | None = Field(default=None, min_length=1, max_length=255)
    family_name: str | None = Field(default=None, min_length=1, max_length=255)


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
    date_of_birth: date
    sex: Sex = Sex.UNKNOWN
    place_of_birth: str | None = None
    province_code: str | None = None
    ville: str | None = None
    commune_code: str | None = None


class CitizenSearchParams(BaseModel):
    q: str | None = None
    family_name: str | None = None
    given_names: str | None = None
    nic: str | None = None
    date_of_birth: date | None = None
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
