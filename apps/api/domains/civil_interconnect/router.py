"""HTTP Module 8 — `/api/v1/civil-events` + matching."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.permissions import (
    PERM_ONIP_DASHBOARD,
    Principal,
    require_permissions,
)
from apps.api.db.session import get_db
from apps.api.domains.civil_interconnect import service as civ
from apps.api.domains.civil_interconnect.schemas import (
    CivilEventAck,
    CivilEventIn,
    CivilEventStatusOut,
    MatchingDecisionIn,
)

router = APIRouter(tags=["civil-interconnect-module-8"])


def _http(exc: civ.CivilInterconnectError) -> HTTPException:
    return HTTPException(
        status_code=exc.http_status,
        detail={"message": str(exc), "code": exc.code},
    )


@router.get("/civil-events/catalog")
async def catalog(
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> dict[str, Any]:
    return civ.civil_catalog()


@router.post("/civil-events", response_model=CivilEventAck)
async def ingest(
    body: CivilEventIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> CivilEventAck:
    try:
        ack = await civ.ingest_event(db, body, actor_id=principal.actor_id)
    except civ.CivilInterconnectError as exc:
        raise _http(exc) from exc
    await db.commit()
    return ack


@router.get("/civil-events", response_model=list[CivilEventStatusOut])
async def list_events(
    limit: int = Query(default=50, ge=1, le=200),
    status_filter: str | None = Query(default=None, alias="status"),
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> list[CivilEventStatusOut]:
    return civ.list_events(limit=limit, status=status_filter)


@router.get("/civil-events/{event_id}/status", response_model=CivilEventStatusOut)
async def event_status(
    event_id: str,
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> CivilEventStatusOut:
    try:
        return civ.get_status(event_id)
    except civ.CivilInterconnectError as exc:
        raise _http(exc) from exc


@router.get("/civil-matching-cases")
async def matching_cases(
    limit: int = Query(default=50, ge=1, le=200),
    _: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> dict[str, Any]:
    items = civ.list_matching_cases(limit=limit)
    return {
        "count": len(items),
        "items": items,
        "auto_apply_ambiguous_forbidden": True,
        "invent_nin_forbidden": True,
    }


@router.post("/civil-matching-cases/{case_id}/decision")
async def matching_decision(
    case_id: str,
    body: MatchingDecisionIn,
    db: AsyncSession = Depends(get_db),
    principal: Principal = Depends(require_permissions(PERM_ONIP_DASHBOARD)),
) -> dict[str, Any]:
    try:
        out = await civ.decide_matching(
            db, case_id, body, actor_id=principal.actor_id
        )
    except civ.CivilInterconnectError as exc:
        raise _http(exc) from exc
    await db.commit()
    return out
