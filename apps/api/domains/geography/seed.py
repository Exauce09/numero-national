"""Idempotent seed — 26 provinces RDC + Kinshasa detail + chefs-lieux."""

from __future__ import annotations

from sqlalchemy import func, select
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

# 26 provinces (réforme 2015) — codes ISO-like internes
PROVINCES: list[tuple[str, str, str]] = [
    ("KIN", "Kinshasa", "Kinshasa"),
    ("BC", "Kongo Central", "Matadi"),
    ("KWG", "Kwango", "Kenge"),
    ("KWL", "Kwilu", "Bandundu"),
    ("MND", "Mai-Ndombe", "Inongo"),
    ("EQT", "Équateur", "Mbandaka"),
    ("MNG", "Mongala", "Lisala"),
    ("NUB", "Nord-Ubangi", "Gbadolite"),
    ("SUB", "Sud-Ubangi", "Gemena"),
    ("TSH", "Tshuapa", "Boende"),
    ("TSHO", "Tshopo", "Kisangani"),
    ("BUE", "Bas-Uélé", "Buta"),
    ("HUE", "Haut-Uélé", "Isiro"),
    ("ITU", "Ituri", "Bunia"),
    ("NKV", "Nord-Kivu", "Goma"),
    ("SKV", "Sud-Kivu", "Bukavu"),
    ("MNM", "Maniema", "Kindu"),
    ("HKT", "Haut-Katanga", "Lubumbashi"),
    ("LLB", "Lualaba", "Kolwezi"),
    ("HLM", "Haut-Lomami", "Kamina"),
    ("TGY", "Tanganyika", "Kalemie"),
    ("KAS", "Kasaï", "Tshikapa"),
    ("KAC", "Kasaï Central", "Kananga"),
    ("KAO", "Kasaï Oriental", "Mbuji-Mayi"),
    ("LOM", "Lomami", "Kabinda"),
    ("SNK", "Sankuru", "Lusambo"),
]

# Kinshasa districts → communes
KIN_DISTRICTS: dict[str, list[str]] = {
    "Lukunga": ["Gombe", "Kinshasa", "Barumbu", "Kintambo", "Lingwala", "Ngaliema"],
    "Funa": ["Kasa-Vubu", "Kalamu", "Ngiri-Ngiri", "Bandalungwa", "Bumbu", "Makala", "Selembao"],
    "Mont-Amba": ["Lemba", "Mont-Ngafula", "Kisenso", "Limete", "Matete", "Ngaba"],
    "Tshangu": ["Ndjili", "Kimbanseke", "Masina", "Nsele", "Maluku"],
}

# Sample quartiers + voies for key communes
KIN_QUARTIERS: dict[str, list[tuple[str, list[tuple[str, str]]]]] = {
    "Gombe": [
        ("Centre-ville", [("AVENUE", "du Port"), ("AVENUE", "de la Justice"), ("RUE", "Bureau")]),
        ("Batetela", [("AVENUE", "Batetela"), ("AVENUE", "Wagenia"), ("RUE", "Cliniques")]),
        ("Golf", [("AVENUE", "du Golf"), ("AVENUE", "Roi Baudouin")]),
    ],
    "Ngaliema": [
        ("Ma Campagne", [("AVENUE", "de la Libération"), ("RUE", "Pere Boka")]),
        ("Binza Poids Lourds", [("AVENUE", "Kasa-Vubu"), ("AVENUE", "de l'Université")]),
        ("Djelo Binza", [("AVENUE", "By Pass"), ("RUE", "Mukoso")]),
    ],
    "Limete": [
        ("Résidentiel", [("AVENUE", "de la Science"), ("AVENUE", "Sendwe")]),
        ("Industriel", [("AVENUE", "des Usines"), ("RUE", "Trou du Loup")]),
    ],
    "Ndjili": [
        ("Quartier 1", [("AVENUE", "Sapeur"), ("RUE", "Salongo")]),
        ("Quartier 7", [("AVENUE", "Kimbangu"), ("RUE", "Mbenseke")]),
    ],
    "Kalamu": [
        ("Yolo Nord", [("AVENUE", "Kasa-Vubu"), ("RUE", "Kwango")]),
        ("Matonge", [("AVENUE", "Victoire"), ("RUE", "Forescom")]),
    ],
    "Masina": [
        ("Sans Fil", [("AVENUE", "de la Libération"), ("RUE", "Mpasa")]),
        ("Marché", [("AVENUE", "Bangala"), ("RUE", "Lokole")]),
    ],
}

# Extra villes importantes hors chef-lieu
EXTRA_VILLES: dict[str, list[str]] = {
    "Kongo Central": ["Boma", "Muanda", "Kisantu"],
    "Haut-Katanga": ["Likasi", "Kipushi"],
    "Nord-Kivu": ["Butembo", "Beni"],
    "Sud-Kivu": ["Uvira", "Baraka"],
    "Kasaï Oriental": ["Miabi"],
    "Kwilu": ["Kikwit"],
}


def _slug(name: str) -> str:
    return (
        name.upper()
        .replace(" ", "-")
        .replace("É", "E")
        .replace("È", "E")
        .replace("Ê", "E")
        .replace("À", "A")
        .replace("'", "")
    )


async def ensure_geography_seeded(db: AsyncSession) -> dict[str, int]:
    existing = await db.scalar(select(func.count()).select_from(Province))
    if existing and existing >= 26:
        return {
            "provinces": int(existing),
            "skipped": 1,
        }

    counts = {
        "provinces": 0,
        "districts": 0,
        "villes": 0,
        "communes": 0,
        "quartiers": 0,
        "localites": 0,
        "voies": 0,
    }

    province_by_name: dict[str, Province] = {}
    for code, name, chef in PROVINCES:
        p = Province(code=code, name=name, chef_lieu=chef)
        db.add(p)
        await db.flush()
        province_by_name[name] = p
        counts["provinces"] += 1

        # Ville chef-lieu
        v = Ville(
            province_id=p.id,
            code=f"{code}-{_slug(chef)[:12]}",
            name=chef,
            is_chef_lieu=True,
        )
        db.add(v)
        await db.flush()
        counts["villes"] += 1

        # District administratif générique (territoire / zone)
        d_urbain = District(province_id=p.id, code=f"{code}-URB", name=f"District urbain {chef}")
        d_rural = District(province_id=p.id, code=f"{code}-RUR", name=f"District rural {name}")
        db.add_all([d_urbain, d_rural])
        await db.flush()
        counts["districts"] += 2

        # Commune centre du chef-lieu
        c_centre = Commune(
            ville_id=v.id,
            district_id=d_urbain.id,
            code=f"{code}-COM-CENTRE",
            name=f"Commune de {chef}",
        )
        db.add(c_centre)
        await db.flush()
        counts["communes"] += 1

        q = Quartier(commune_id=c_centre.id, code=f"{c_centre.code}-Q1", name="Centre")
        db.add(q)
        await db.flush()
        counts["quartiers"] += 1
        for vt, vn in (("AVENUE", "Principale"), ("RUE", "du Marché"), ("AVENUE", "de l'Indépendance")):
            db.add(
                Voie(
                    quartier_id=q.id,
                    code=f"{q.code}-{vt[:3]}-{_slug(vn)[:10]}",
                    name=vn,
                    voie_type=vt,
                )
            )
            counts["voies"] += 1

        loc = Localite(
            district_id=d_rural.id,
            commune_id=c_centre.id,
            code=f"{code}-LOC-01",
            name=f"Localité {chef} périphérie",
        )
        db.add(loc)
        counts["localites"] += 1

        # Extra villes
        for extra in EXTRA_VILLES.get(name, []):
            ve = Ville(
                province_id=p.id,
                code=f"{code}-{_slug(extra)[:12]}",
                name=extra,
                is_chef_lieu=False,
            )
            db.add(ve)
            await db.flush()
            counts["villes"] += 1
            ce = Commune(
                ville_id=ve.id,
                district_id=d_urbain.id,
                code=f"{code}-COM-{_slug(extra)[:10]}",
                name=f"Commune de {extra}",
            )
            db.add(ce)
            await db.flush()
            counts["communes"] += 1
            qe = Quartier(commune_id=ce.id, code=f"{ce.code}-Q1", name="Centre")
            db.add(qe)
            await db.flush()
            counts["quartiers"] += 1
            db.add(
                Voie(
                    quartier_id=qe.id,
                    code=f"{qe.code}-AVE-PRINC",
                    name="Principale",
                    voie_type="AVENUE",
                )
            )
            counts["voies"] += 1

    # Kinshasa détail (24 communes, 4 districts)
    kin = province_by_name["Kinshasa"]
    # Replace generic with detailed structure
    kin_ville = (
        await db.execute(select(Ville).where(Ville.province_id == kin.id, Ville.is_chef_lieu.is_(True)))
    ).scalar_one()

    district_map: dict[str, District] = {}
    for dname, communes in KIN_DISTRICTS.items():
        dcode = f"KIN-D-{_slug(dname)[:10]}"
        existing_d = await db.scalar(select(District).where(District.code == dcode))
        if existing_d:
            district_map[dname] = existing_d
            continue
        dist = District(province_id=kin.id, code=dcode, name=dname)
        db.add(dist)
        await db.flush()
        counts["districts"] += 1
        district_map[dname] = dist

        for cname in communes:
            ccode = f"KIN-{_slug(cname)[:14]}"
            if await db.scalar(select(Commune).where(Commune.code == ccode)):
                continue
            com = Commune(
                ville_id=kin_ville.id,
                district_id=dist.id,
                code=ccode,
                name=cname,
            )
            db.add(com)
            await db.flush()
            counts["communes"] += 1

            qdefs = KIN_QUARTIERS.get(
                cname,
                [
                    ("Quartier 1", [("AVENUE", "Principale"), ("RUE", "Commerciale")]),
                    ("Quartier 2", [("AVENUE", "de la Paix"), ("RUE", "École")]),
                ],
            )
            for qi, (qname, voies) in enumerate(qdefs, start=1):
                qcode = f"{ccode}-Q{qi}"
                quar = Quartier(commune_id=com.id, code=qcode, name=qname)
                db.add(quar)
                await db.flush()
                counts["quartiers"] += 1
                for vt, vn in voies:
                    db.add(
                        Voie(
                            quartier_id=quar.id,
                            code=f"{qcode}-{vt[:3]}-{_slug(vn)[:12]}",
                            name=vn,
                            voie_type=vt,
                        )
                    )
                    counts["voies"] += 1

            # Localités périurbaines pour Maluku / Nsele
            if cname in {"Maluku", "Nsele", "Mont-Ngafula"}:
                for i in range(1, 4):
                    db.add(
                        Localite(
                            district_id=dist.id,
                            commune_id=com.id,
                            code=f"{ccode}-LOC-{i}",
                            name=f"Localité {cname} {i}",
                        )
                    )
                    counts["localites"] += 1

    await db.commit()
    return counts
