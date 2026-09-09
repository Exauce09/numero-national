"""NIC génération — format RDC structuré 14 chiffres (v2-rdc-14).

Format (14 chiffres) ::
  CC PP TT S YY NNNN L
  │  │  │  │ │  │    └─ chiffre de contrôle Luhn
  │  │  │  │ │  └────── séquence anti-collision (0000–9999)
  │  │  │  │ └───────── année de naissance (2 chiffres)
  │  │  │  └─────────── sexe (1=H, 2=F, 0=autre/inconnu)
  │  │  └────────────── territoire / ville (01–99, 00 si inconnu)
  │  └───────────────── province (01–26)
  └──────────────────── pays (18 = RDC / COD)

Le NIC n'est jamais accepté en entrée API publique ; seul ce service l'attribue.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.core_registry.enums import CitizenEventType, CitizenStatus, Sex
from apps.api.domains.core_registry.models import Citizen, CitizenHistory, NicIssuanceLog
from apps.api.domains.geography.seed_data import PROVINCES

ALGORITHM_VERSION = "v2-rdc-14"
ACTOR_SYSTEM = "CORE_REGISTRY"
NIC_PAYLOAD_LENGTH = 13
NIC_TOTAL_LENGTH = 14
MAX_COLLISION_RETRIES = 64

# ISO 3166-1 numeric COD = 180 → compact 2 digits pour le NIC national.
COUNTRY_CODE_RDC = "18"

# Ordre stable des 26 provinces (index 1..26).
PROVINCE_NUMERIC: dict[str, str] = {
    code: f"{i:02d}" for i, (code, _name, _chef) in enumerate(PROVINCES, start=1)
}


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


def encode_sex(sex: str | Sex | None) -> str:
    """1 = masculin, 2 = féminin, 0 = autre / inconnu."""
    raw = sex.value if isinstance(sex, Sex) else (sex or "")
    key = str(raw).strip().upper()
    if key in {"M", "MALE", "H", "HOMME", "MASCULIN"}:
        return "1"
    if key in {"F", "FEMALE", "FEMME", "FEMININ", "FÉMININ"}:
        return "2"
    return "0"


def encode_province(province_code: str | None) -> str:
    if not province_code:
        return "00"
    code = province_code.strip().upper()
    if code in PROVINCE_NUMERIC:
        return PROVINCE_NUMERIC[code]
    # Tolère un code déjà numérique 01–26
    if code.isdigit() and 1 <= int(code) <= 26:
        return f"{int(code):02d}"
    return "00"


def encode_territory(*parts: str | None) -> str:
    """Territoire / ville → 01–99 déterministe ; 00 si aucune info."""
    key = "|".join(p.strip().upper() for p in parts if p and str(p).strip())
    if not key:
        return "00"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    n = (int(digest[:8], 16) % 99) + 1
    return f"{n:02d}"


def encode_birth_year(dob: date | None) -> str:
    if dob is None:
        return "00"
    return f"{dob.year % 100:02d}"


def build_semantic_prefix(
    *,
    nationality: str | None = "COD",
    province_code: str | None = None,
    territory_key: str | None = None,
    city: str | None = None,
    commune_code: str | None = None,
    sex: str | Sex | None = None,
    date_of_birth: date | None = None,
) -> str:
    """9 chiffres : CC PP TT S YY."""
    country = COUNTRY_CODE_RDC if (nationality or "COD").upper() in {"COD", "CD", "RDC", "18", "180"} else "00"
    province = encode_province(province_code)
    territory = encode_territory(territory_key, commune_code, city)
    sex_d = encode_sex(sex)
    year = encode_birth_year(date_of_birth)
    return f"{country}{province}{territory}{sex_d}{year}"


def generate_candidate_nic(
    *,
    nationality: str | None = "COD",
    province_code: str | None = None,
    territory_key: str | None = None,
    city: str | None = None,
    commune_code: str | None = None,
    sex: str | Sex | None = None,
    date_of_birth: date | None = None,
    sequence: int | None = None,
) -> str:
    """Génère un candidat NIC 14 chiffres (sans contrôle unicité DB)."""
    prefix = build_semantic_prefix(
        nationality=nationality,
        province_code=province_code,
        territory_key=territory_key,
        city=city,
        commune_code=commune_code,
        sex=sex,
        date_of_birth=date_of_birth,
    )
    assert len(prefix) == 9
    seq = sequence if sequence is not None else secrets.randbelow(10_000)
    seq_s = f"{seq % 10_000:04d}"
    payload = prefix + seq_s
    return payload + luhn_check_digit(payload)


def is_valid_nic_format(nic: str) -> bool:
    """Longueur 14 + Luhn (ne prouve pas l'émission)."""
    return len(nic) == NIC_TOTAL_LENGTH and nic.isdigit() and verify_luhn(nic)


def parse_nic_fields(nic: str) -> dict[str, str]:
    """Découpe un NIC v2 pour affichage / debug (sans valider l'émission)."""
    if not is_valid_nic_format(nic):
        raise ValueError("invalid_nic_format")
    return {
        "country": nic[0:2],
        "province": nic[2:4],
        "territory": nic[4:6],
        "sex": nic[6],
        "birth_year": nic[7:9],
        "sequence": nic[9:13],
        "check": nic[13],
    }


async def nic_exists(session: AsyncSession, nic: str) -> bool:
    """Anti-collision contre citizens.nic et journal d'émission."""
    citizen_hit = await session.scalar(select(Citizen.id).where(Citizen.nic == nic).limit(1))
    if citizen_hit is not None:
        return True
    log_hit = await session.scalar(
        select(NicIssuanceLog.id).where(NicIssuanceLog.nic == nic).limit(1)
    )
    return log_hit is not None


def _geo_from_citizen(citizen: Citizen) -> dict[str, str | None]:
    primary = None
    for addr in getattr(citizen, "addresses", None) or []:
        if addr.is_primary:
            primary = addr
            break
    if primary is None and getattr(citizen, "addresses", None):
        primary = citizen.addresses[0] if citizen.addresses else None
    if primary is None:
        return {
            "province_code": None,
            "commune_code": None,
            "city": None,
        }
    return {
        "province_code": primary.province_code,
        "commune_code": primary.commune_code,
        "city": primary.city,
    }


async def generate_unique_nic(session: AsyncSession, citizen: Citizen) -> str:
    """Génère un NIC unique à partir des données du citoyen."""
    geo = _geo_from_citizen(citizen)
    for _ in range(MAX_COLLISION_RETRIES):
        candidate = generate_candidate_nic(
            nationality=citizen.nationality,
            province_code=geo["province_code"],
            commune_code=geo["commune_code"],
            city=geo["city"],
            sex=citizen.sex,
            date_of_birth=citizen.date_of_birth,
        )
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
    Attribue un NIC système structuré et journalise l'émission.
    """
    if citizen.nic is not None:
        raise NicGenerationError("Citizen already has a NIC; re-attribution forbidden")

    nic = await generate_unique_nic(session, citizen)
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
                "fields": parse_nic_fields(nic),
                "previous_status": CitizenStatus.PENDING_VALIDATION.value,
                "new_status": CitizenStatus.ACTIVE.value,
            },
            actor_id=actor_id,
            created_at=now,
        )
    )
    await session.flush()
    return nic
