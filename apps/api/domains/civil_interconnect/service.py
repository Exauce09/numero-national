"""Service Module 8 — réception idempotente, matching, pas d'écrasement ni NIN inventé."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.civil_interconnect import store
from apps.api.domains.civil_interconnect.schemas import (
    CivilCatalogOut,
    CivilEventAck,
    CivilEventIn,
    CivilEventStatusOut,
    MatchingDecisionIn,
)


class CivilInterconnectError(Exception):
    def __init__(self, message: str, *, code: str, http_status: int = 400):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


def civil_catalog() -> dict[str, Any]:
    return CivilCatalogOut(
        authorized_sources=[
            {
                "source_id": s["source_id"],
                "label": s["label"],
                "active": s["active"],
                "allowed_event_types": s["allowed_event_types"],
                "contract_version": s["contract_version"],
            }
            for s in store.list_sources()
        ],
        event_types=list(store.AUTHORIZED_SOURCES["EC_KIN_DEMO"]["allowed_event_types"]),
        processing_statuses=list(store.PROCESSING_STATUSES),
        endpoints={
            "catalog": "GET /api/v1/civil-events/catalog",
            "ingest": "POST /api/v1/civil-events",
            "status": "GET /api/v1/civil-events/{id}/status",
            "list": "GET /api/v1/civil-events",
            "matching": "GET /api/v1/civil-matching-cases",
            "matching_decision": "POST /api/v1/civil-matching-cases/{id}/decision",
            "onip_conflicts": "GET /api/v1/onip/civil/conflicts",
        },
        note=(
            "État civil = source juridique ; FGP = consommateur. "
            "Accusé technique ≠ APPLIED. Pas de NIN inventé, pas de last-message-wins, "
            "pas de conversion recensement→acte, pas de recyclage NIN au décès."
        ),
    ).model_dump()


def _event_to_status(row: dict[str, Any]) -> CivilEventStatusOut:
    return CivilEventStatusOut(
        id=row["id"],
        source_id=row["source_id"],
        source_event_id=row["source_event_id"],
        event_type=row["event_type"],
        processing_status=row["processing_status"],
        act_reference=row.get("act_reference"),
        citizen_id=row.get("citizen_id"),
        technical_ack=True,
        business_applied=row.get("processing_status") == "APPLIED",
        received_at=row.get("received_at"),
        effective_date=row.get("effective_date"),
        applied_at=row.get("applied_at"),
        quarantine_reason=row.get("quarantine_reason"),
    )


async def ingest_event(
    db: AsyncSession,
    data: CivilEventIn,
    *,
    actor_id: UUID | None = None,
) -> CivilEventAck:
    """Réception idempotente — n'attribue jamais de NIN, n'applique pas silencieusement."""
    del db  # réservé pour persistance future / audit ORM
    src = store.get_source(data.source_id)
    if src is None:
        raise CivilInterconnectError(
            "Source inconnue — refus",
            code="unknown_source",
            http_status=403,
        )
    if not src.get("active"):
        raise CivilInterconnectError(
            "Source révoquée — refus",
            code="revoked_source",
            http_status=403,
        )
    if data.event_type not in src.get("allowed_event_types", []):
        raise CivilInterconnectError(
            f"Type {data.event_type} non autorisé pour cette source",
            code="event_type_not_allowed",
            http_status=403,
        )
    # Interdiction explicite : un client ne propose pas de NIN
    for forbidden in ("nin", "national_id", "nic"):
        if forbidden in (data.payload or {}) and data.payload.get(forbidden):
            raise CivilInterconnectError(
                "Payload ne doit pas proposer de NIN/NIC — service NIN dédié uniquement",
                code="client_proposed_nin_forbidden",
                http_status=400,
            )

    ph = store.payload_hash(data.payload)
    existing = store.find_by_source_key(data.source_id, data.source_event_id)
    if existing is not None:
        if existing.get("payload_hash") == ph:
            return CivilEventAck(
                id=existing["id"],
                source_id=existing["source_id"],
                source_event_id=existing["source_event_id"],
                event_type=existing["event_type"],
                processing_status=existing["processing_status"],
                technical_ack=True,
                business_applied=existing["processing_status"] == "APPLIED",
                already_processed=True,
                correlation_id=existing["correlation_id"],
                message="Message déjà reçu (idempotence) — aucun second effet métier",
                received_at=existing.get("received_at"),
            )
        # Même référence, payload différent → quarantaine / conflit
        existing["processing_status"] = "QUARANTINED"
        existing["quarantine_reason"] = "payload_conflict_same_source_event_id"
        existing["conflict_payload_hash"] = ph
        store.save_event(existing)
        return CivilEventAck(
            id=existing["id"],
            source_id=existing["source_id"],
            source_event_id=existing["source_event_id"],
            event_type=existing["event_type"],
            processing_status="QUARANTINED",
            technical_ack=True,
            business_applied=False,
            already_processed=True,
            correlation_id=existing["correlation_id"],
            message="Conflit de payload — quarantaine ; pas d'écrasement (no last-message-wins)",
            received_at=existing.get("received_at"),
        )

    now = datetime.now(timezone.utc)
    eid = store.new_event_id()
    correlation = f"civ-{eid[:8]}"
    candidates = [str(x) for x in (data.candidate_citizen_ids or [])]
    citizen_id = str(data.citizen_id) if data.citizen_id else None

    if len(candidates) > 1 or (not citizen_id and not candidates and not data.person_reference):
        status = "MATCH_REVIEW"
        reason = "ambiguous_or_missing_person_link"
    elif citizen_id or len(candidates) == 1:
        status = "READY_TO_APPLY"
        if not citizen_id and len(candidates) == 1:
            citizen_id = candidates[0]
        reason = None
    else:
        status = "MATCH_REVIEW"
        reason = "person_reference_only_needs_review"

    row: dict[str, Any] = {
        "id": eid,
        "source_id": data.source_id.strip(),
        "source_event_id": data.source_event_id.strip(),
        "event_type": data.event_type,
        "act_reference": data.act_reference,
        "issuing_authority": data.issuing_authority,
        "event_date": store.iso_date(data.event_date),
        "effective_date": data.effective_date,
        "person_reference": data.person_reference,
        "citizen_id": citizen_id,
        "candidate_citizen_ids": candidates,
        "payload_hash": ph,
        "payload_keys": sorted((data.payload or {}).keys()),
        "contract_version": data.contract_version,
        "processing_status": status,
        "quarantine_reason": reason if status == "MATCH_REVIEW" else None,
        "correlation_id": correlation,
        "received_at": now,
        "applied_at": None,
        "actor_id": str(actor_id) if actor_id else None,
        "nin_assigned": False,
    }
    store.save_event(row)

    if status == "MATCH_REVIEW":
        store.create_matching_case(
            event_id=eid,
            candidate_citizen_ids=candidates,
            reason=reason or "match_review",
        )

    try:
        from apps.api.domains.audit.services import write_audit

        await write_audit(
            db,
            action="CIVIL_EVENT_INGEST",
            actor_id=actor_id,
            resource_type="CivilInboundEvent",
            resource_id=eid,
            new_value={
                "source_id": data.source_id,
                "source_event_id": data.source_event_id,
                "event_type": data.event_type,
                "processing_status": status,
                "nin_assigned": False,
            },
            commit=False,
        )
    except Exception:
        pass

    return CivilEventAck(
        id=eid,
        source_id=row["source_id"],
        source_event_id=row["source_event_id"],
        event_type=row["event_type"],
        processing_status=status,
        technical_ack=True,
        business_applied=False,
        already_processed=False,
        correlation_id=correlation,
        message=(
            "Événement reçu — en rapprochement (aucune mise à jour FGP irréversible)"
            if status == "MATCH_REVIEW"
            else "Événement reçu — prêt à appliquer après validation (pas encore APPLIED)"
        ),
        received_at=now,
    )


def get_status(event_id: str) -> CivilEventStatusOut:
    row = store.get_event(event_id)
    if row is None:
        raise CivilInterconnectError("Événement introuvable", code="not_found", http_status=404)
    return _event_to_status(row)


def list_events(*, limit: int = 50, status: str | None = None) -> list[CivilEventStatusOut]:
    return [_event_to_status(r) for r in store.list_events(limit=limit, status=status)]


def list_matching_cases(*, limit: int = 50) -> list[dict[str, Any]]:
    return store.list_matching(limit=limit)


async def decide_matching(
    db: AsyncSession,
    case_id: str,
    body: MatchingDecisionIn,
    *,
    actor_id: UUID | None = None,
) -> dict[str, Any]:
    """Décision de revue — ne mute jamais le NIN ; APPLY métier = marquage contrôlé."""
    case = store.get_matching(case_id)
    if case is None:
        raise CivilInterconnectError("Cas de rapprochement introuvable", code="not_found", http_status=404)
    event = store.get_event(case["event_id"])
    if event is None:
        raise CivilInterconnectError("Événement lié introuvable", code="not_found", http_status=404)

    decision = body.decision
    now = datetime.now(timezone.utc)
    decisions = list(case.get("decisions") or [])
    decisions.append(
        {
            "decision": decision,
            "motif": body.motif.strip(),
            "citizen_id": str(body.citizen_id) if body.citizen_id else None,
            "actor_id": str(actor_id) if actor_id else None,
            "at": now.isoformat(),
        }
    )
    case["decisions"] = decisions

    if decision == "LINK_CITIZEN":
        if body.citizen_id is None:
            raise CivilInterconnectError(
                "citizen_id requis pour LINK_CITIZEN",
                code="citizen_required",
                http_status=400,
            )
        event["citizen_id"] = str(body.citizen_id)
        event["processing_status"] = "READY_TO_APPLY"
        event["quarantine_reason"] = None
        case["status"] = "LINKED"
        # Optionnel : journal FGP sans NIN
        try:
            from apps.api.domains.fgp.schemas import FgpEventIn
            from apps.api.domains.fgp.service import ingest_event as fgp_ingest

            await fgp_ingest(
                db,
                FgpEventIn(
                    source="civil",
                    source_event_id=f"{event['source_id']}:{event['source_event_id']}",
                    citizen_id=body.citizen_id,
                    event_type=event["event_type"],
                    effective_date=event.get("effective_date"),
                    payload={
                        "civil_event_id": event["id"],
                        "act_reference": event.get("act_reference"),
                        "processing_status": "READY_TO_APPLY",
                        "nin_assigned": False,
                    },
                ),
                actor_id=actor_id,
            )
            event["processing_status"] = "APPLIED"
            event["applied_at"] = now
            case["status"] = "APPLIED"
        except Exception:
            # Lien enregistré ; application FGP peut être reprise plus tard
            pass
    elif decision == "QUARANTINE":
        event["processing_status"] = "QUARANTINED"
        event["quarantine_reason"] = body.motif.strip()
        case["status"] = "QUARANTINED"
    elif decision == "REJECT":
        event["processing_status"] = "REJECTED"
        event["quarantine_reason"] = body.motif.strip()
        case["status"] = "REJECTED"
    else:  # ESCALATE
        case["status"] = "ESCALATED"

    store.save_event(event)
    store.save_matching(case)
    return {
        "case_id": case["id"],
        "event_id": event["id"],
        "case_status": case["status"],
        "processing_status": event["processing_status"],
        "citizen_id": event.get("citizen_id"),
        "nin_mutated": False,
        "message": "Décision enregistrée — aucun NIN créé ni recyclé",
    }
