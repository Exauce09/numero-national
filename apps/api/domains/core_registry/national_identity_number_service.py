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

from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.models import Citizen
from apps.api.domains.core_registry.nic_service import (
    ALGORITHM_VERSION as PROVISIONAL_ALGORITHM_VERSION,
    NicGenerationError,
    assign_nic as _assign_provisional_nic_impl,
    is_valid_nic_format,
    nic_exists,
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


@dataclass(frozen=True)
class NinAssignmentResult:
    nin: str
    citizen_id: uuid.UUID
    algorithm_version: str
    official: bool
    already_assigned: bool = False


class NationalIdentityNumberService:
    """Façade unique — idempotente, sans réattribution silencieuse."""

    @staticmethod
    def official_format_ready() -> bool:
        return OFFICIAL_NIN_FORMAT_CONFIRMED

    @staticmethod
    def is_valid_provisional_format(value: str) -> bool:
        return is_valid_nic_format(value)

    @staticmethod
    async def already_issued(session: AsyncSession, nin: str) -> bool:
        return await nic_exists(session, nin)

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
    ) -> NinAssignmentResult:
        """Chemin DEV / transition : format v3-rdc-14 provisoire (non officiel).

        Idempotent : si un NIC est déjà présent, le retourne sans en générer un autre.
        """
        if citizen.nic is not None:
            return NinAssignmentResult(
                nin=citizen.nic,
                citizen_id=citizen.id,
                algorithm_version=PROVISIONAL_ALGORITHM_VERSION,
                official=False,
                already_assigned=True,
            )
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
        )


# Alias stables pour les modules appelants
assign_provisional_nic = NationalIdentityNumberService.assign_provisional_nic
assign_official_nin = NationalIdentityNumberService.assign_official_nin
