"""Service central d'attribution du numéro national d'identification (NIN / NIC FGP).

Point d'entrée unique pour ONIP, recensement, état civil et cartes.

État juridique (audit 2026-10-25) — voir docs/legal/onip/AUDIT_CONFORMITE_FGP_NIN.md :

- Décret n° 22/07 du 2 mars 2022, art. 8 : la composition du numéro est fixée par
  arrêté du Ministre de l'Intérieur sur proposition de l'ONIP.
- L'arrêté CIN/NIN et son annexe technique n'ont PAS pu être récupérés depuis
  onip.gouv.cd (échec HTTP / fichier vide) ; la longueur totale, la taille du
  numéro d'ordre et l'algorithme des chiffres de contrôle ne sont donc PAS confirmés.
- OFFICIAL_NIN_FORMAT_CONFIRMED = False → le chemin « officiel » est bloqué.
- Le générateur existant (v3-rdc-14) reste PROVISOIRE / développement uniquement.

Ne pas inventer de format, préfixe, longueur ou clé de contrôle non autorisés.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.enums import CitizenStatus, DuplicateStatus
from apps.api.domains.core_registry.models import Citizen, CitizenHistory, DuplicateCandidate
from apps.api.domains.core_registry.nic_service import (
    ALGORITHM_VERSION as PROVISIONAL_ALGORITHM_VERSION,
    NicGenerationError,
    assign_nic as _assign_provisional_nic_impl,
    is_valid_nic_format,
    nic_exists,
)

# Historique additif (pas de migration) — Module 7
EVENT_NIN_ALLOCATION = "NIN_ALLOCATION"
EVENT_NIN_EXCEPTION = "NIN_EXCEPTION"

EXCEPTION_TYPES = frozenset(
    {
        "COLLISION",
        "WRONG_ASSOCIATION",
        "MERGE_CONFLICT",
        "DEATH_REVIEW",
        "CORRECTION_REVIEW",
    }
)
EXCEPTION_DECISIONS = frozenset(
    {"PENDING", "ACKNOWLEDGED", "ESCALATED", "CLOSED"}
)

# ---------------------------------------------------------------------------
# Garde-fou légal — basculer à True UNIQUEMENT après validation ONIP écrite
# de l'annexe officielle (longueur + ordre + algorithme de contrôle).
# ---------------------------------------------------------------------------
OFFICIAL_NIN_FORMAT_CONFIRMED: bool = False

OFFICIAL_BLOCK_REASON = (
    "Générateur NIN officiel bloqué : arrêté du Ministre de l'Intérieur / annexe "
    "technique ONIP non vérifiés (PDF onip.gouv.cd inaccessible ; incohérence "
    "longueur / n° d'ordre / clé de contrôle non résolue). "
    "Voir docs/legal/onip/AUDIT_CONFORMITE_FGP_NIN.md."
)


class OfficialNinFormatUnresolvedError(RuntimeError):
    """Levée tant que la composition officielle du NIN n'est pas confirmée."""


class ProvisionalNinPrerequisitesError(ValueError):
    """Dossier incomplet ou doublon OPEN — attribution provisoire refusée."""

    def __init__(self, message: str, *, code: str, details: dict | None = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}


@dataclass(frozen=True)
class NinAssignmentResult:
    nin: str
    citizen_id: uuid.UUID
    algorithm_version: str
    official: bool
    already_assigned: bool = False
    nin_status: str = "PROVISIONAL"


class NationalIdentityNumberService:
    """Façade unique — idempotente, sans réattribution silencieuse."""

    @staticmethod
    def official_format_ready() -> bool:
        return OFFICIAL_NIN_FORMAT_CONFIRMED

    @staticmethod
    def is_valid_provisional_format(value: str) -> bool:
        return is_valid_nic_format(value)

    @staticmethod
    def nin_status_for(citizen: Citizen) -> str | None:
        """Statut logique additif (pas de colonne obligatoire) : PROVISIONAL | None."""
        if citizen.nic is None:
            return None
        # Officiel impossible tant que le flag légal est faux.
        return "PROVISIONAL"

    @staticmethod
    async def already_issued(session: AsyncSession, nin: str) -> bool:
        return await nic_exists(session, nin)

    @classmethod
    async def count_open_duplicates(
        cls, session: AsyncSession, citizen_id: uuid.UUID
    ) -> int:
        open_dupes = await session.scalar(
            select(func.count())
            .select_from(DuplicateCandidate)
            .where(
                and_(
                    DuplicateCandidate.status == DuplicateStatus.OPEN.value,
                    or_(
                        DuplicateCandidate.citizen_a_id == citizen_id,
                        DuplicateCandidate.citizen_b_id == citizen_id,
                    ),
                )
            )
        )
        return int(open_dupes or 0)

    @classmethod
    async def assert_provisional_prerequisites(
        cls, session: AsyncSession, citizen: Citizen
    ) -> None:
        """Refuse si dossier incomplet, statut incompatible ou doublon OPEN."""
        if citizen.status in {
            CitizenStatus.DECEASED.value,
            CitizenStatus.MERGED.value,
            CitizenStatus.SUSPENDED.value,
        }:
            raise ProvisionalNinPrerequisitesError(
                f"Cannot assign provisional NIC in status {citizen.status}",
                code="invalid_status",
                details={"status": citizen.status},
            )
        missing: list[str] = []
        if not (citizen.given_names and str(citizen.given_names).strip()):
            missing.append("given_names")
        if not (citizen.family_name and str(citizen.family_name).strip()):
            missing.append("family_name")
        if citizen.date_of_birth is None:
            missing.append("date_of_birth")
        if missing:
            raise ProvisionalNinPrerequisitesError(
                "Dossier incomplet — champs obligatoires manquants",
                code="incomplete_dossier",
                details={"missing": missing},
            )
        open_count = await cls.count_open_duplicates(session, citizen.id)
        if open_count > 0:
            raise ProvisionalNinPrerequisitesError(
                "Attribution bloquée : doublons démographiques OPEN",
                code="open_duplicates",
                details={"open_duplicates": open_count},
            )

    @classmethod
    async def assign_official_nin(
        cls,
        session: AsyncSession,
        *,
        citizen: Citizen,
        actor_id: uuid.UUID | None = None,
    ) -> NinAssignmentResult:
        """Attribution selon l'annexe officielle — bloquée tant que non confirmée."""
        if not OFFICIAL_NIN_FORMAT_CONFIRMED:
            raise OfficialNinFormatUnresolvedError(OFFICIAL_BLOCK_REASON)
        # Réservé : brancher ici l'algorithme officiel une fois l'annexe validée.
        raise OfficialNinFormatUnresolvedError(
            "OFFICIAL_NIN_FORMAT_CONFIRMED=True mais l'implémentation officielle "
            "n'est pas encore branchée — action manuelle ONIP requise."
        )

    @classmethod
    async def assign_provisional_nic(
        cls,
        session: AsyncSession,
        *,
        citizen: Citizen,
        actor_id: uuid.UUID | None = None,
        skip_prerequisites: bool = False,
    ) -> NinAssignmentResult:
        """Chemin DEV / transition : format v3-rdc-14 provisoire (non officiel).

        Idempotent : si un NIC est déjà présent, le retourne sans en générer un autre.
        Prérequis (sauf skip_prerequisites=True pour chemins override déjà validés) :
        dossier complet + aucun doublon OPEN.
        """
        if citizen.nic is not None:
            return NinAssignmentResult(
                nin=citizen.nic,
                citizen_id=citizen.id,
                algorithm_version=PROVISIONAL_ALGORITHM_VERSION,
                official=False,
                already_assigned=True,
                nin_status="PROVISIONAL",
            )
        if not skip_prerequisites:
            await cls.assert_provisional_prerequisites(session, citizen)
        try:
            nin = await _assign_provisional_nic_impl(
                session, citizen=citizen, actor_id=actor_id
            )
        except NicGenerationError:
            raise
        return NinAssignmentResult(
            nin=nin,
            citizen_id=citizen.id,
            algorithm_version=PROVISIONAL_ALGORITHM_VERSION,
            official=False,
            already_assigned=False,
            nin_status="PROVISIONAL",
        )

    @classmethod
    async def evaluate_eligibility(
        cls, session: AsyncSession, citizen: Citizen
    ) -> dict[str, Any]:
        """Codes d'admissibilité sans attribution (cahier §5 / §13 status)."""
        block_codes: list[str] = []
        missing: list[str] = []
        if citizen.status in {
            CitizenStatus.DECEASED.value,
            CitizenStatus.MERGED.value,
            CitizenStatus.SUSPENDED.value,
        }:
            block_codes.append("invalid_status")
        if not (citizen.given_names and str(citizen.given_names).strip()):
            missing.append("given_names")
        if not (citizen.family_name and str(citizen.family_name).strip()):
            missing.append("family_name")
        if citizen.date_of_birth is None:
            missing.append("date_of_birth")
        if missing:
            block_codes.append("incomplete_dossier")
        open_dupes = await cls.count_open_duplicates(session, citizen.id)
        if open_dupes > 0:
            block_codes.append("open_duplicates")
        already = citizen.nic is not None
        if already:
            block_codes.append("already_assigned")
        eligible = not already and not block_codes
        return {
            "citizen_id": str(citizen.id),
            "eligible_provisional": eligible,
            "block_codes": block_codes,
            "missing_fields": missing,
            "open_duplicates": open_dupes,
            "status": citizen.status,
            "has_nin": already,
            "official_assign_available": False,
            "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
        }

    @classmethod
    async def get_national_id_status(
        cls, session: AsyncSession, citizen: Citizen
    ) -> dict[str, Any]:
        eligibility = await cls.evaluate_eligibility(session, citizen)
        nin_status = cls.nin_status_for(citizen)
        return {
            **eligibility,
            "nin": citizen.nic,
            "nin_status": nin_status,
            "official": False,
            "algorithm_version": (
                PROVISIONAL_ALGORITHM_VERSION if citizen.nic else None
            ),
            "internal_id_distinct_from_nin": True,
            "note": (
                "NIN officiel non activé — "
                + (OFFICIAL_BLOCK_REASON if not OFFICIAL_NIN_FORMAT_CONFIRMED else "OK")
            ),
        }

    @staticmethod
    def catalog() -> dict[str, Any]:
        """Catalogue règles Module 7 — générateur officiel hors lot."""
        return {
            "module": 7,
            "title": "Attribution et gestion du NIN",
            "official_nin_format_confirmed": OFFICIAL_NIN_FORMAT_CONFIRMED,
            "official_generation_enabled": False,
            "provisional_allowed": True,
            "offline_nin_forbidden": True,
            "invent_nin_forbidden": True,
            "client_proposed_nin_forbidden": True,
            "auto_merge_forbidden": True,
            "provisional_algorithm": PROVISIONAL_ALGORITHM_VERSION,
            "block_reason": (
                OFFICIAL_BLOCK_REASON if not OFFICIAL_NIN_FORMAT_CONFIRMED else None
            ),
            "decree_ref": "Décret n° 22/07 du 2 mars 2022, art. 8",
            "endpoints": {
                "catalog": "GET /api/v1/onip/nin/catalog",
                "compliance": "GET /api/v1/onip/nin/compliance",
                "eligible": "GET /api/v1/onip/nin/eligible",
                "status": "GET /api/v1/onip/nin/status/{citizen_id}",
                "assign": "POST /api/v1/onip/nin/assign",
                "allocation_by_key": "GET /api/v1/onip/nin/allocations/{idempotency_key}",
                "issuance_log": "GET /api/v1/onip/nin/issuance-log",
                "exceptions": "GET|POST /api/v1/onip/nin/exceptions",
                "exception_decision": "POST /api/v1/onip/nin/exceptions/{id}/decision",
            },
            "exception_types": sorted(EXCEPTION_TYPES),
            "note": (
                "Service central unique. Pas de NIN inventé. "
                "Générateur officiel bloqué jusqu'à annexe signée. "
                "Exceptions = audit seulement (ne réécrivent pas Citizen.nic)."
            ),
            "audit_doc": "docs/legal/onip/MODULE_7_AUDIT.md",
        }

    @classmethod
    async def find_allocation_by_key(
        cls, session: AsyncSession, idempotency_key: str
    ) -> CitizenHistory | None:
        key = idempotency_key.strip()
        if not key:
            return None
        rows = list(
            (
                await session.execute(
                    select(CitizenHistory)
                    .where(CitizenHistory.event_type == EVENT_NIN_ALLOCATION)
                    .order_by(CitizenHistory.created_at.desc())
                    .limit(300)
                )
            )
            .scalars()
            .all()
        )
        for row in rows:
            payload = row.payload or {}
            if payload.get("idempotency_key") == key:
                return row
        return None

    @classmethod
    async def assign_with_request(
        cls,
        session: AsyncSession,
        *,
        citizen: Citizen,
        mode: str,
        actor_id: uuid.UUID | None = None,
        idempotency_key: str | None = None,
        request_source: str | None = None,
    ) -> dict[str, Any]:
        """Attribution via service central + journal de demande (idempotence clé)."""
        key = (idempotency_key or "").strip() or None
        if key:
            existing = await cls.find_allocation_by_key(session, key)
            if existing is not None:
                payload = existing.payload or {}
                return {
                    "request_id": str(existing.id),
                    "idempotency_key": key,
                    "already_processed": True,
                    "outcome": payload.get("outcome", "CONFIRMED"),
                    "nin": payload.get("nin"),
                    "citizen_id": str(existing.citizen_id),
                    "algorithm_version": payload.get("algorithm_version"),
                    "official": bool(payload.get("official", False)),
                    "already_assigned": True,
                    "nin_status": payload.get("nin_status", "PROVISIONAL"),
                    "mode": payload.get("mode"),
                    "message": "Demande déjà traitée (idempotence) — aucun second NIN",
                }

        if mode == "official":
            raise OfficialNinFormatUnresolvedError(OFFICIAL_BLOCK_REASON)

        result = await cls.assign_provisional_nic(
            session, citizen=citizen, actor_id=actor_id
        )
        now = datetime.now(timezone.utc)
        hist = CitizenHistory(
            citizen_id=citizen.id,
            event_type=EVENT_NIN_ALLOCATION,
            payload={
                "idempotency_key": key,
                "mode": mode,
                "request_source": (request_source or "ONIP").strip()[:64],
                "outcome": "CONFIRMED",
                "nin": result.nin,
                "algorithm_version": result.algorithm_version,
                "official": result.official,
                "already_assigned": result.already_assigned,
                "nin_status": result.nin_status,
            },
            actor_id=actor_id,
            created_at=now,
        )
        session.add(hist)
        await session.flush()
        return {
            "request_id": str(hist.id),
            "idempotency_key": key,
            "already_processed": False,
            "outcome": "CONFIRMED",
            "nin": result.nin,
            "citizen_id": str(result.citizen_id),
            "algorithm_version": result.algorithm_version,
            "official": result.official,
            "already_assigned": result.already_assigned,
            "nin_status": result.nin_status,
            "mode": mode,
            "message": (
                "Attribution provisoire confirmée"
                if not result.already_assigned
                else "NIN déjà présent — résultat existant retourné"
            ),
        }

    @classmethod
    async def open_exception(
        cls,
        session: AsyncSession,
        *,
        citizen_id: uuid.UUID,
        exception_type: str,
        reason: str,
        related_citizen_id: uuid.UUID | None = None,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Ouvre un cas d'exception NIN — audit only, ne mute pas Citizen.nic."""
        et = exception_type.strip().upper()
        if et not in EXCEPTION_TYPES:
            raise ValueError(f"exception_type invalide: {exception_type}")
        motif = reason.strip()
        if len(motif) < 8:
            raise ValueError("reason trop court (min. 8 caractères)")
        citizen = await session.get(Citizen, citizen_id)
        if citizen is None:
            raise LookupError("Citizen not found")
        now = datetime.now(timezone.utc)
        hist = CitizenHistory(
            citizen_id=citizen_id,
            event_type=EVENT_NIN_EXCEPTION,
            payload={
                "exception_type": et,
                "status": "PENDING",
                "reason": motif,
                "related_citizen_id": (
                    str(related_citizen_id) if related_citizen_id else None
                ),
                "decisions": [],
                "nin_snapshot": citizen.nic,
                "nic_mutated": False,
            },
            actor_id=actor_id,
            created_at=now,
        )
        session.add(hist)
        await session.flush()
        return {
            "id": str(hist.id),
            "citizen_id": str(citizen_id),
            "exception_type": et,
            "status": "PENDING",
            "reason": motif,
            "nic_mutated": False,
            "created_at": now.isoformat(),
        }

    @classmethod
    async def list_exceptions(
        cls, session: AsyncSession, *, limit: int = 50
    ) -> list[dict[str, Any]]:
        rows = list(
            (
                await session.execute(
                    select(CitizenHistory)
                    .where(CitizenHistory.event_type == EVENT_NIN_EXCEPTION)
                    .order_by(CitizenHistory.created_at.desc())
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        items: list[dict[str, Any]] = []
        for row in rows:
            p = row.payload or {}
            items.append(
                {
                    "id": str(row.id),
                    "citizen_id": str(row.citizen_id),
                    "exception_type": p.get("exception_type"),
                    "status": p.get("status", "PENDING"),
                    "reason": p.get("reason"),
                    "related_citizen_id": p.get("related_citizen_id"),
                    "nic_mutated": bool(p.get("nic_mutated", False)),
                    "nin_snapshot": p.get("nin_snapshot"),
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
            )
        return items

    @classmethod
    async def decide_exception(
        cls,
        session: AsyncSession,
        *,
        exception_id: uuid.UUID,
        decision: str,
        motif: str,
        actor_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Décision d'exception — jamais de réécriture de Citizen.nic dans ce lot."""
        dec = decision.strip().upper()
        if dec not in EXCEPTION_DECISIONS or dec == "PENDING":
            raise ValueError("decision doit être ACKNOWLEDGED|ESCALATED|CLOSED")
        motif_s = motif.strip()
        if len(motif_s) < 8:
            raise ValueError("motif trop court (min. 8 caractères)")
        row = await session.get(CitizenHistory, exception_id)
        if row is None or row.event_type != EVENT_NIN_EXCEPTION:
            raise LookupError("Exception not found")
        payload = dict(row.payload or {})
        decisions = list(payload.get("decisions") or [])
        decisions.append(
            {
                "decision": dec,
                "motif": motif_s,
                "actor_id": str(actor_id) if actor_id else None,
                "at": datetime.now(timezone.utc).isoformat(),
            }
        )
        payload["decisions"] = decisions
        payload["status"] = dec
        payload["nic_mutated"] = False
        row.payload = payload
        return {
            "id": str(row.id),
            "citizen_id": str(row.citizen_id),
            "status": dec,
            "nic_mutated": False,
            "message": (
                "Décision enregistrée — Citizen.nic non modifié "
                "(procédure officielle requise pour toute rectification)."
            ),
        }


# Alias stables pour les modules appelants
assign_provisional_nic = NationalIdentityNumberService.assign_provisional_nic
assign_official_nin = NationalIdentityNumberService.assign_official_nin
nin_catalog = NationalIdentityNumberService.catalog
