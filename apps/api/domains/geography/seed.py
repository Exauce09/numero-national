"""Idempotent / forceable seed — 26 provinces, villes, communes CENI, quartiers & voies."""

from __future__ import annotations

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.domains.geography.models import (
    Commune,
    District,
    Localite,
    Province,
    Quartier,
    Ville,
    Voie,
)
from apps.api.domains.geography.seed_data import (
    CITY_COMMUNES,
    DEFAULT_QUARTIERS,
    KIN_DISTRICTS,
    KINSHASA_QUARTIERS,
    PROVINCES,
    QUARTIERS_VOIES,
)
from apps.api.domains.geography.kinshasa_avenues_data import avenues_for_commune

# Seuil : au-dessous → rechargement automatique (données anciennes trop pauvres)
MIN_COMMUNES = 150
MIN_QUARTIERS = 700
MIN_VOIES = 2500
MIN_LOCALITES = 1500
SEED_VERSION = 6
# Cap UI : trop d’avenues OSM rendent le sélecteur illisible
MAX_VOIES_PER_QUARTIER = 180


def _slug(name: str) -> str:
    return (
        name.upper()
        .replace(" ", "-")
        .replace("É", "E")
        .replace("È", "E")
        .replace("Ê", "E")
        .replace("À", "A")
        .replace("Ô", "O")
        .replace("Ç", "C")
        .replace("'", "")
        .replace(".", "")
    )


async def _counts(db: AsyncSession) -> dict[str, int]:
    return {
        "provinces": int(await db.scalar(select(func.count()).select_from(Province)) or 0),
        "districts": int(await db.scalar(select(func.count()).select_from(District)) or 0),
        "villes": int(await db.scalar(select(func.count()).select_from(Ville)) or 0),
        "communes": int(await db.scalar(select(func.count()).select_from(Commune)) or 0),
        "quartiers": int(await db.scalar(select(func.count()).select_from(Quartier)) or 0),
        "localites": int(await db.scalar(select(func.count()).select_from(Localite)) or 0),
        "voies": int(await db.scalar(select(func.count()).select_from(Voie)) or 0),
    }


async def clear_geography(db: AsyncSession) -> None:
    """Supprime tout le référentiel geography (CASCADE via FK)."""
    await db.execute(delete(Voie))
    await db.execute(delete(Localite))
    await db.execute(delete(Quartier))
    await db.execute(delete(Commune))
    await db.execute(delete(Ville))
    await db.execute(delete(District))
    await db.execute(delete(Province))
    await db.flush()


def _default_voies_for_quartier(qname: str) -> list[tuple[str, str]]:
    """Avenues de base tant que la liste OSM / officielle n’est pas fournie."""
    return [
        ("AVENUE", qname),
        ("AVENUE", "Principale"),
        ("RUE", "du Marche"),
        ("RUE", "Ecole"),
    ]


def _voies_for_kinshasa_commune(commune: str, qname: str) -> list[tuple[str, str]]:
    """Avenues OSM de la commune (carte), sinon fallback générique."""
    osm = avenues_for_commune(commune)
    if osm:
        return list(osm[:MAX_VOIES_PER_QUARTIER])
    return _default_voies_for_quartier(qname)


def _quartier_defs(ville: str, commune: str) -> list[tuple[str, list[tuple[str, str]]]]:
    if ville == "Kinshasa":
        osm = _voies_for_kinshasa_commune(commune, "Centre")
        if commune in KINSHASA_QUARTIERS:
            return [(q, list(osm)) for q in KINSHASA_QUARTIERS[commune]]
        base = QUARTIERS_VOIES.get(f"{ville}|{commune}", DEFAULT_QUARTIERS)
        if osm and osm != _default_voies_for_quartier("Centre"):
            return [(qname, list(osm)) for qname, _unused in base]
        return base
    return QUARTIERS_VOIES.get(f"{ville}|{commune}", DEFAULT_QUARTIERS)


# Villages / localités générés par commune (référence opérationnelle — la RDC en a
# des dizaines de milliers ; le bouton « Ajouter village » complète le reste).
DEFAULT_VILLAGE_NAMES: list[str] = [
    "Centre",
    "Salongo",
    "Libota",
    "Esengo",
    "Lokole",
    "Boyoma",
    "Kapata",
    "Nganda",
    "Mbanza",
    "Katanga",
    "Libulu",
    "Mongala",
]


async def _add_villages_for_commune(
    db: AsyncSession,
    commune: Commune,
    district_id,
    counts: dict[str, int],
) -> None:
    for i, vname in enumerate(DEFAULT_VILLAGE_NAMES, start=1):
        db.add(
            Localite(
                commune_id=commune.id,
                district_id=district_id,
                code=f"{commune.code}-V{i:02d}",
                name=f"Village {vname}",
            )
        )
        counts["localites"] += 1


async def _add_quartiers_voies(
    db: AsyncSession,
    commune: Commune,
    ville_name: str,
    commune_name: str,
    counts: dict[str, int],
) -> None:
    for qi, (qname, voies) in enumerate(_quartier_defs(ville_name, commune_name), start=1):
        qcode = f"{commune.code}-Q{qi}"
        quar = Quartier(commune_id=commune.id, code=qcode, name=qname)
        db.add(quar)
        await db.flush()
        counts["quartiers"] += 1
        for vi, (vt, vn) in enumerate(voies, start=1):
            db.add(
                Voie(
                    quartier_id=quar.id,
                    code=f"{qcode}-{vt[:3]}-{vi}-{_slug(vn)[:14]}",
                    name=vn,
                    voie_type=vt,
                )
            )
            counts["voies"] += 1


async def _seed_all(db: AsyncSession) -> dict[str, int]:
    counts = {
        "provinces": 0,
        "districts": 0,
        "villes": 0,
        "communes": 0,
        "quartiers": 0,
        "localites": 0,
        "voies": 0,
        "seed_version": SEED_VERSION,
    }

    province_by_name: dict[str, Province] = {}
    for code, name, chef in PROVINCES:
        p = Province(code=code, name=name, chef_lieu=chef)
        db.add(p)
        await db.flush()
        province_by_name[name] = p
        counts["provinces"] += 1

        d_urbain = District(province_id=p.id, code=f"{code}-URB", name=f"District urbain {chef}")
        d_rural = District(province_id=p.id, code=f"{code}-RUR", name=f"District rural {name}")
        db.add_all([d_urbain, d_rural])
        await db.flush()
        counts["districts"] += 2

        cities = CITY_COMMUNES.get(name, {chef: [f"Commune de {chef}"]})
        for ville_name, communes in cities.items():
            is_chef = ville_name == chef or (name == "Kinshasa" and ville_name == "Kinshasa")
            ville = Ville(
                province_id=p.id,
                code=f"{code}-{_slug(ville_name)[:14]}",
                name=ville_name,
                is_chef_lieu=is_chef,
            )
            db.add(ville)
            await db.flush()
            counts["villes"] += 1

            # Districts Kinshasa détaillés
            if name == "Kinshasa" and ville_name == "Kinshasa":
                district_map: dict[str, District] = {}
                for dname, dcommunes in KIN_DISTRICTS.items():
                    dist = District(
                        province_id=p.id,
                        code=f"KIN-D-{_slug(dname)[:12]}",
                        name=dname,
                    )
                    db.add(dist)
                    await db.flush()
                    counts["districts"] += 1
                    district_map[dname] = dist
                    for cname in dcommunes:
                        com = Commune(
                            ville_id=ville.id,
                            district_id=dist.id,
                            code=f"KIN-{_slug(cname)[:16]}",
                            name=cname,
                        )
                        db.add(com)
                        await db.flush()
                        counts["communes"] += 1
                        await _add_quartiers_voies(db, com, "Kinshasa", cname, counts)
                        await _add_villages_for_commune(db, com, dist.id, counts)
                continue

            for cname in communes:
                com = Commune(
                    ville_id=ville.id,
                    district_id=d_urbain.id,
                    code=f"{code}-{_slug(ville_name)[:8]}-{_slug(cname)[:12]}",
                    name=cname,
                )
                db.add(com)
                await db.flush()
                counts["communes"] += 1
                await _add_quartiers_voies(db, com, ville_name, cname, counts)
                await _add_villages_for_commune(db, com, d_urbain.id, counts)

            # Localité périphérique chef-lieu (en plus des villages commune)
            if is_chef:
                db.add(
                    Localite(
                        district_id=d_rural.id,
                        code=f"{code}-LOC-RUR-01",
                        name=f"Périphérie {chef}",
                    )
                )
                counts["localites"] += 1

    await db.commit()
    return counts


async def ensure_geography_seeded(db: AsyncSession, *, force: bool = False) -> dict[str, int]:
    """Charge le référentiel si vide / incomplet, ou force=True pour tout recharger."""
    current = await _counts(db)
    complete = (
        current["provinces"] >= 26
        and current["communes"] >= MIN_COMMUNES
        and current["quartiers"] >= MIN_QUARTIERS
        and current["voies"] >= MIN_VOIES
        and current["localites"] >= MIN_LOCALITES
    )
    if complete and not force:
        return {**current, "skipped": 1, "seed_version": SEED_VERSION}

    if current["provinces"] > 0:
        await clear_geography(db)
        await db.commit()

    # gen_random_uuid nécessite pgcrypto / extension — déjà utilisée en migration
    try:
        await db.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        await db.commit()
    except Exception:
        await db.rollback()

    return await _seed_all(db)
