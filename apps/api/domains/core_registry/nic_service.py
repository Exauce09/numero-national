"""NIC generation — cryptographically random, integrity-checked, never PII-encoded.

Format (algorithm v1-luhn-13):
  - 12 cryptographically secure random decimal digits (payload)
  - 1 Luhn check digit
  - Total length: 13 digits

NICs are NEVER accepted from public API input; only this service attributes them.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.enums import CitizenEventType, CitizenStatus
from apps.api.domains.core_registry.models import Citizen, CitizenHistory, NicIssuanceLog

ALGORITHM_VERSION = "v1-luhn-13"
ACTOR_SYSTEM = "CORE_REGISTRY"
NIC_PAYLOAD_LENGTH = 12
NIC_TOTAL_LENGTH = 13
MAX_COLLISION_RETRIES = 32


class NicGenerationError(RuntimeError):
    """Raised when a unique NIC cannot be attributed."""


def luhn_check_digit(payload_digits: str) -> str:
    """Compute the Luhn check digit for a numeric payload string."""
    if not payload_digits.isdigit():
        raise ValueError("payload must be numeric")
    total = 0
    reverse = payload_digits[::-1]
    for i, ch in enumerate(reverse):
        n = int(ch)
        if i % 2 == 0:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return str((10 - (total % 10)) % 10)


def verify_luhn(number: str) -> bool:
    """Return True if number passes Luhn (full value including check digit)."""
    if not number.isdigit() or len(number) < 2:
        return False
    payload, check = number[:-1], number[-1]
    return luhn_check_digit(payload) == check


def generate_candidate_nic() -> str:
    """Generate one cryptographically secure candidate NIC (no DB check)."""
    payload = "".join(str(secrets.randbelow(10)) for _ in range(NIC_PAYLOAD_LENGTH))
    return payload + luhn_check_digit(payload)


def is_valid_nic_format(nic: str) -> bool:
    """NIC length + Luhn integrity check (does not prove issuance)."""
    return len(nic) == NIC_TOTAL_LENGTH and verify_luhn(nic)


async def nic_exists(session: AsyncSession, nic: str) -> bool:
    """Anti-collision probe against citizens.nic and issuance journal."""
    citizen_hit = await session.scalar(select(Citizen.id).where(Citizen.nic == nic).limit(1))
    if citizen_hit is not None:
        return True
    log_hit = await session.scalar(
        select(NicIssuanceLog.id).where(NicIssuanceLog.nic == nic).limit(1)
    )
    return log_hit is not None


async def generate_unique_nic(session: AsyncSession) -> str:
    """Generate a unique NIC with anti-collision retries."""
    for _ in range(MAX_COLLISION_RETRIES):
        candidate = generate_candidate_nic()
        if not await nic_exists(session, candidate):
            return candidate
    raise NicGenerationError(
        f"Unable to generate unique NIC after {MAX_COLLISION_RETRIES} attempts"
    )


async def assign_nic(
    session: AsyncSession,
    *,
    citizen: Citizen,
    actor_id: uuid.UUID | None = None,
) -> str:
    """
    Attribute a system-generated NIC and journal issuance.

    Unique indexes provide the final race guard; outer unit of work may retry
    on IntegrityError.
    """
    if citizen.nic is not None:
        raise NicGenerationError("Citizen already has a NIC; re-attribution forbidden")

    nic = await generate_unique_nic(session)
    now = datetime.now(timezone.utc)

    citizen.nic = nic
    citizen.status = CitizenStatus.ACTIVE.value
    citizen.validated_at = now
    citizen.updated_at = now

    session.add(
        NicIssuanceLog(
            citizen_id=citizen.id,
            nic=nic,
            issued_at=now,
            algorithm_version=ALGORITHM_VERSION,
            actor_system=ACTOR_SYSTEM,
        )
    )
    session.add(
        CitizenHistory(
            citizen_id=citizen.id,
            event_type=CitizenEventType.NIC_ASSIGNED.value,
            payload={
                "nic": nic,
                "algorithm_version": ALGORITHM_VERSION,
                "actor_system": ACTOR_SYSTEM,
                "previous_status": CitizenStatus.PENDING_VALIDATION.value,
                "new_status": CitizenStatus.ACTIVE.value,
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    await session.flush()
    return nic
