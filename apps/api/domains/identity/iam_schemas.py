"""Schemas for institutional IAM (personnel, bureaux, assignments, scopes)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PersonnelCreate(BaseModel):
    matricule: str = Field(min_length=2, max_length=64)
    family_name: str = Field(min_length=1, max_length=128)
    postnom: str | None = None
    given_names: str = Field(min_length=1, max_length=128)
    function_title: str | None = None
    phone_pro: str | None = None
    email_pro: EmailStr | None = None
    status: str = "ACTIVE"
    date_entree: date | None = None


class PersonnelUpdate(BaseModel):
    family_name: str | None = None
    postnom: str | None = None
    given_names: str | None = None
    function_title: str | None = None
    phone_pro: str | None = None
    email_pro: EmailStr | None = None
    status: str | None = None
    date_sortie: date | None = None


class PersonnelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    matricule: str
    family_name: str
    postnom: str | None
    given_names: str
    function_title: str | None
    phone_pro: str | None
    email_pro: str | None
    status: str
    date_entree: date | None
    date_sortie: date | None
    created_at: datetime


class BureauCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    bureau_type: str = "PRINCIPAL"
    province_id: UUID | None = None
    ville_id: UUID | None = None
    commune_id: UUID | None = None
    commune_code: str | None = None
    address: str | None = None
    ressort: dict[str, Any] = Field(default_factory=dict)
    status: str = "ACTIVE"


class BureauUpdate(BaseModel):
    name: str | None = None
    bureau_type: str | None = None
    address: str | None = None
    ressort: dict[str, Any] | None = None
    status: str | None = None
    closed_at: datetime | None = None


class BureauRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    code: str
    name: str
    bureau_type: str
    province_id: UUID | None
    ville_id: UUID | None
    commune_id: UUID | None
    commune_code: str | None
    address: str | None
    ressort: dict[str, Any]
    status: str
    opened_at: datetime | None
    closed_at: datetime | None
    created_at: datetime


class AssignmentCreate(BaseModel):
    personnel_id: UUID
    bureau_id: UUID | None = None
    province_id: UUID | None = None
    function_code: str = Field(min_length=2, max_length=64)
    start_date: date
    end_date: date | None = None
    open_ended: bool = False
    justification: str | None = None
    document_reference: str | None = None


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    personnel_id: UUID
    bureau_id: UUID | None
    province_id: UUID | None
    function_code: str
    start_date: date
    end_date: date | None
    status: str
    assigned_by: UUID | None
    justification: str | None
    document_reference: str | None
    created_at: datetime


class ScopeCreate(BaseModel):
    user_id: UUID
    scope_type: str
    territory_id: UUID | None = None
    bureau_id: UUID | None = None


class ScopeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    scope_type: str
    territory_id: UUID | None
    bureau_id: UUID | None
    created_at: datetime


class AccountRequestCreate(BaseModel):
    personnel_id: UUID
    requested_role: str
    reason: str | None = None
    requested_scope_type: str | None = "BUREAU"
    requested_bureau_id: UUID | None = None
    requested_province_id: UUID | None = None
    email: EmailStr | None = None
    temporary_password: str | None = Field(default=None, min_length=8)


class AccountRequestReject(BaseModel):
    rejection_reason: str = Field(min_length=3)


class AccountRequestApprove(BaseModel):
    email: EmailStr | None = None
    temporary_password: str = Field(min_length=8)
    role_codes: list[str] | None = None


class AccountRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    personnel_id: UUID
    requested_by: UUID | None
    requested_at: datetime
    reason: str | None
    requested_role: str
    requested_scope_type: str | None
    requested_bureau_id: UUID | None
    requested_province_id: UUID | None
    status: str
    approved_by: UUID | None
    approved_at: datetime | None
    rejection_reason: str | None
    created_user_id: UUID | None


class UserStatusAction(BaseModel):
    reason: str = Field(min_length=3)
    until: datetime | None = None


# --- Account administration (wizard + lifecycle) ---------------------------------


class AccountProvisionPersonnel(BaseModel):
    mode: str = Field(description="select | create")
    personnel_id: UUID | None = None
    new_personnel: PersonnelCreate | None = None


class AccountProvisionAssignment(BaseModel):
    province_id: UUID
    ville_id: UUID | None = None
    commune_id: UUID | None = None
    bureau_id: UUID
    function_code: str = Field(min_length=2, max_length=64)
    start_date: date
    end_date: date | None = None
    open_ended: bool = True
    justification: str | None = None
    document_reference: str | None = None


class AccountProvisionCredentials(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr | None = None
    phone: str | None = None
    access_mode: str = Field(default="invite", description="invite | temporary_password")
    temporary_password: str | None = Field(default=None, min_length=8)


class AccountProvisionCreate(BaseModel):
    """Orchestrated PERSONNEL → AFFECTATION → COMPTE → RÔLE → SCOPE."""

    personnel: AccountProvisionPersonnel
    assignment: AccountProvisionAssignment
    credentials: AccountProvisionCredentials
    role_code: str = Field(min_length=2, max_length=64)
    scope_type: str | None = None  # auto if omitted


class AccountProvisionResult(BaseModel):
    user_id: UUID
    email: str
    username: str
    account_status: str
    role_codes: list[str]
    personnel_id: UUID
    assignment_id: UUID
    invite_token: str | None = None
    invite_url: str | None = None
    message: str


class AccountListItem(BaseModel):
    id: UUID
    email: str
    full_name: str
    account_status: str
    is_active: bool
    role_codes: list[str]
    personnel_id: UUID | None = None
    personnel_matricule: str | None = None
    personnel_name: str | None = None
    function_code: str | None = None
    bureau_id: UUID | None = None
    bureau_name: str | None = None
    last_login_at: datetime | None = None
    created_at: datetime


class AccountStats(BaseModel):
    total: int
    active: int
    pending: int
    suspended: int
    disabled: int


class AccountListResponse(BaseModel):
    stats: AccountStats
    items: list[AccountListItem]


class AccountDetail(BaseModel):
    user: AccountListItem
    personnel: PersonnelRead | None = None
    assignment: AssignmentRead | None = None
    scopes: list[ScopeRead] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


class RoleChangeRequest(BaseModel):
    role_code: str = Field(min_length=2, max_length=64)
    reason: str = Field(min_length=3)


class AssignmentChangeRequest(BaseModel):
    bureau_id: UUID
    province_id: UUID | None = None
    ville_id: UUID | None = None
    commune_id: UUID | None = None
    function_code: str = Field(min_length=2, max_length=64)
    start_date: date
    end_date: date | None = None
    open_ended: bool = True
    justification: str | None = None
    document_reference: str | None = None


class InviteActivateRequest(BaseModel):
    token: str = Field(min_length=16)
    password: str = Field(min_length=8, max_length=128)


class CitizenRegisterRequest(BaseModel):
    family_name: str = Field(min_length=1, max_length=128)
    postnom: str | None = None
    given_names: str = Field(min_length=1, max_length=128)
    date_of_birth: date
    email: EmailStr | None = None
    phone: str | None = None
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)
    password_confirm: str = Field(min_length=8, max_length=128)


class HistoryEvent(BaseModel):
    id: UUID
    action: str
    created_at: datetime
    actor_id: UUID | None = None
    result: str | None = None
    justification: str | None = None
    old_value: dict[str, Any] | None = None
    new_value: dict[str, Any] | None = None


class AssignableRolesResponse(BaseModel):
    roles: list[dict[str, Any]]
