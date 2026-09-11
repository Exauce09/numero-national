"""NIC génération — format RDC structuré 14 chiffres (v3-rdc-14).

Format (14 chiffres) ::
  PP TTT S YYYY NNNN
  │  │   │ │    └─ séquence anti-collision (0000–9999)
  │  │   │ └────── année de naissance (4 chiffres)
  │  │   └──────── sexe (1=H, 2=F, 0=autre/inconnu)
  │  └──────────── territoire / ville (001–999, 000 si inconnu)
  └─────────────── province (01–26)

Pas de code pays dans le NIC : comme dans la plupart des pays, le numéro
national est déjà scopé à un État (la RDC) — le pays n’est pas répété dedans.

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

ALGORITHM_VERSION = "v3-rdc-14"
ACTOR_SYSTEM = "CORE_REGISTRY"
NIC_PAYLOAD_LENGTH = 14
NIC_TOTAL_LENGTH = 14
MAX_COLLISION_RETRIES = 64

# Ordre / codes province pour NIC 14 chiffres (PP…).
# Kinshasa = 15 (code métier SIGPOP) — jamais 00.
PROVINCE_NUMERIC: dict[str, str] = {
    "KIN": "15",
    "BC": "01",
    "KWG": "02",
    "KWL": "03",
    "MND": "04",
    "EQT": "05",
    "MNG": "06",
    "NUB": "07",
    "SUB": "08",
    "TSH": "09",
    "TSHO": "10",
    "BUE": "11",
    "HUE": "12",
    "ITU": "13",
    "NKV": "14",
    "SKV": "16",
    "MNM": "17",
    "HKT": "18",
    "LLB": "19",
    "HLM": "20",
    "TGY": "21",
    "KAS": "22",
    "KAC": "23",
    "KAO": "24",
    "LOM": "25",
    "SNK": "26",
}

DEFAULT_PROVINCE_CODE = "15"  # Kinshasa — défaut national SIGPOP (pas 00)


class NicGenerationError(RuntimeError):
    """Raised when a unique NIC cannot be attributed."""


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
        return DEFAULT_PROVINCE_CODE
    code = province_code.strip().upper()
    if code in PROVINCE_NUMERIC:
        return PROVINCE_NUMERIC[code]
    if code.isdigit() and 1 <= int(code) <= 26:
        # Never emit 00; map bare "0" / invalid to Kinshasa 15
        n = int(code)
        if n == 0:
            return DEFAULT_PROVINCE_CODE
        return f"{n:02d}"
    # Alias textuels fréquents
    if "KINSHASA" in code or code in {"KIN", "15"}:
        return "15"
    return DEFAULT_PROVINCE_CODE


def encode_territory(*parts: str | None) -> str:
    """Territoire / ville → 001–999 déterministe ; 000 si aucune info."""
    key = "|".join(p.strip().upper() for p in parts if p and str(p).strip())
    if not key:
        return "000"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    n = (int(digest[:8], 16) % 999) + 1
    return f"{n:03d}"


def encode_birth_year(dob: date | None) -> str:
    if dob is None:
        return "0000"
    return f"{dob.year:04d}"


def build_semantic_prefix(
    *,
    nationality: str | None = "COD",  # conservé pour compat API ; non encodé dans le NIC
    province_code: str | None = None,
    territory_key: str | None = None,
    city: str | None = None,
    commune_code: str | None = None,
    sex: str | Sex | None = None,
    date_of_birth: date | None = None,
) -> str:
    """10 chiffres : PP TTT S YYYY (sans code pays)."""
    _ = nationality
    province = encode_province(province_code)
    territory = encode_territory(territory_key, commune_code, city)
    sex_d = encode_sex(sex)
    year = encode_birth_year(date_of_birth)
    return f"{province}{territory}{sex_d}{year}"


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
    assert len(prefix) == 10
    seq = sequence if sequence is not None else secrets.randbelow(10_000)
    seq_s = f"{seq % 10_000:04d}"
    return prefix + seq_s


def is_valid_nic_format(nic: str) -> bool:
    """Longueur 14, numérique uniquement."""
    return len(nic) == NIC_TOTAL_LENGTH and nic.isdigit()


def parse_nic_fields(nic: str) -> dict[str, str]:
    """Découpe un NIC v3 pour affichage / debug."""
    if not is_valid_nic_format(nic):
        raise ValueError("invalid_nic_format")
    return {
        "province": nic[0:2],
        "territory": nic[2:5],
        "sex": nic[5],
        "birth_year": nic[6:10],
        "sequence": nic[10:14],
    }


# Compat : anciens tests / imports Luhn (plus utilisés dans le format v3).
def luhn_check_digit(payload_digits: str) -> str:
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
    if not number.isdigit() or len(number) < 2:
        return False
    payload, check = number[:-1], number[-1]
    return luhn_check_digit(payload) == check


async def nic_exists(session: AsyncSession, nic: str) -> bool:
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
        # Défaut Kinshasa (15) — jamais province 00
        return {"province_code": "KIN", "commune_code": None, "city": "Kinshasa"}
    return {
        "province_code": primary.province_code or "KIN",
        "commune_code": primary.commune_code,
        "city": primary.city,
    }


async def generate_unique_nic(session: AsyncSession, citizen: Citizen) -> str:
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
