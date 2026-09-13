#!/usr/bin/env python3
"""Batch recensement lot 3: Mokili Nzambe … Aurélie Bongongo (indices 81–120)."""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path
from typing import Any

import httpx

BASE = "http://127.0.0.1:8000"
AGENT_EMAIL = "agent.recensement@example.gov"
AGENT_PASSWORD = "CensusAgent123!"
SUP_EMAIL = "supervisor.recensement@example.gov"
SUP_PASSWORD = "CensusSupervisor123!"
ADMIN_EMAIL = "admin.recensement@example.gov"
ADMIN_PASSWORD = "CensusAdmin123!"
CAMPAIGN_CODE = "RGPH-2026"
DEVICE_UID = "civil-batch-seed-20260913-b3"
BATCH_PREFIX = "batch3-rec-"

PROV = {
    "Kinshasa": ("01", "Kinshasa"),
    "Kongo-Central": ("04", "Kongo-Central"),
    "Kwango": ("03", "Kwango"),
    "Équateur": ("22", "Équateur"),
    "Equateur": ("22", "Équateur"),
    "Tshopo": ("16", "Tshopo"),
    "Kasaï": ("06", "Kasaï"),
    "Kasai": ("06", "Kasaï"),
    "Mai-Ndombe": ("05", "Mai-Ndombe"),
    "Kwilu": ("02", "Kwilu"),
}

# prenom nom postnom | sexe | province | profession | telephone
RAW = """
Mokili|Nzambe|Bompengo|M|Kinshasa|Informaticien|+243 810 284 631
Léonie|Mputu|Kisolokele|F|Kongo-Central|Enseignante|+243 821 547 362
Léandre|Nsenga|Mavungu|M|Kwango|Médecin|+243 895 316 724
Clarisse|Bongongo|Liyongo|F|Équateur|Comptable|+243 817 635 492
Dieudonné|Kisimba|Lokonda|M|Tshopo|Agriculteur|+243 977 421 638
Marthe|Mansanga|Tshilomba|F|Kasaï|Infirmière|+243 825 714 365
Célestin|Nsimba|Kudia|M|Kongo-Central|Avocat|+243 898 526 417
Grâce|Lukoki|Kimpanga|F|Kinshasa|Journaliste|+243 814 693 527
Théophile|Wendo|Kifuta|M|Mai-Ndombe|Fonctionnaire|+243 856 317 429
Adèle|Mabiala|Sengo|F|Kongo-Central|Pharmacienne|+243 822 541 736
Norbert|Maseka|Kimpanga|M|Kwilu|Entrepreneur|+243 991 428 635
Rosine|Liyongo|Bompengo|F|Équateur|Couturière|+243 816 573 924
Albert|Kisolokele|Mputu|M|Kinshasa|Architecte|+243 973 615 482
Esther|Lokonda|Kisimba|F|Tshopo|Sage-femme|+243 829 364 751
Patrice|Kifuta|Wendo|M|Mai-Ndombe|Mécanicien|+243 810 527 693
Noëlla|Kudia|Nsenga|F|Kwango|Juriste|+243 843 716 295
Firmin|Tshilomba|Mansanga|M|Kasaï|Technicien|+243 899 435 721
Béatrice|Sengo|Mabiala|F|Kongo-Central|Commerçante|+243 815 624 937
Joachim|Bompengo|Liyongo|M|Équateur|Enseignant|+243 977 318 624
Delphine|Kimpanga|Lukoki|F|Kinshasa|Psychologue|+243 827 451 639
Séraphin|Mavungu|Nsenga|M|Kwango|Agronome|+243 891 627 453
Hélène|Kisolokele|Mputu|F|Kinshasa|Secrétaire|+243 824 539 716
Augustin|Kifuta|Nsimba|M|Kongo-Central|Électricien|+243 856 472 319
Mireille|Kimpanga|Sengo|F|Mai-Ndombe|Enseignante|+243 812 695 437
Benoît|Lokonda|Maseka|M|Tshopo|Ingénieur|+243 975 314 862
Chantal|Bompengo|Wendo|F|Équateur|Médecin|+243 829 531 764
Évariste|Kudia|Mavungu|M|Kwango|Chauffeur|+243 898 417 625
Nathalie|Mansanga|Lukoki|F|Kasaï|Avocate|+243 817 624 395
Grégoire|Liyongo|Kisimba|M|Tshopo|Géologue|+243 991 536 724
Suzanne|Mputu|Mabiala|F|Kongo-Central|Infirmière|+243 821 475 639
Jérôme|Sengo|Kisolokele|M|Kinshasa|Économiste|+243 810 637 425
Florence|Wendo|Bongongo|F|Équateur|Commerçante|+243 843 529 716
Marcel|Kimpanga|Tshilomba|M|Kasaï|Professeur|+243 896 314 527
Pauline|Maseka|Kudia|F|Mai-Ndombe|Agricultrice|+243 815 742 693
Oscar|Mavungu|Lokonda|M|Tshopo|Administrateur|+243 973 426 815
Élise|Lukoki|Mansanga|F|Kasaï|Pharmacienne|+243 825 631 479
Constant|Bompengo|Nsenga|M|Équateur|Technicien|+243 855 417 326
Judith|Kisolokele|Wendo|F|Kinshasa|Architecte|+243 822 574 631
Rodrigue|Mabiala|Kifuta|M|Kongo-Central|Entrepreneur|+243 898 361 527
Aurélie|Bongongo|Kudia|F|Mai-Ndombe|Comptable|+243 814 625 793
""".strip()


def parse_people() -> list[dict[str, Any]]:
    rows = []
    for i, line in enumerate(RAW.splitlines(), start=1):
        parts = line.split("|")
        if len(parts) < 7:
            raise SystemExit(f"bad line {i}: {line}")
        prenom, nom, postnom, sexe, province, profession, tel = [p.strip() for p in parts]
        pcode, pname = PROV.get(province, ("01", province))
        year = 1968 + (i % 38)
        month = ((i + 5) % 12) + 1
        day = ((i + 7) % 27) + 1
        rows.append(
            {
                "idx": i + 180,
                "prenom": prenom,
                "nom": nom,
                "postnom": postnom,
                "sexe": sexe,
                "province_code": pcode,
                "province": pname,
                "profession": profession,
                "telephone": tel,
                "date_naissance": f"{year:04d}-{month:02d}-{day:02d}",
            }
        )
    return rows


def login(client: httpx.Client, email: str, password: str) -> str:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def main() -> int:
    people = parse_people()
    print(f"people={len(people)} campaign={CAMPAIGN_CODE} prefix={BATCH_PREFIX}")

    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))
    from scripts.redistribute_map_rdc import coords_for, jitter  # noqa: WPS433

    with httpx.Client(base_url=BASE, timeout=90.0) as client:
        agent_tok = login(client, AGENT_EMAIL, AGENT_PASSWORD)
        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {agent_tok}"})
        me.raise_for_status()
        agent_id = me.json()["id"]

        # Promote+NIC: admin (permission validate)
        promo_tok = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
        try:
            login(client, SUP_EMAIL, SUP_PASSWORD)
        except Exception:
            pass
        sh = {"Authorization": f"Bearer {promo_tok}", "Accept": "application/json"}

        camps = client.get("/api/v1/census/campaigns", headers=sh)
        camps.raise_for_status()
        camp = next((c for c in camps.json() if c.get("code") == CAMPAIGN_CODE), None)
        if not camp:
            print("FAIL: campaign not found", file=sys.stderr)
            return 1
        campaign_id = camp["id"]
        print(f"campaign_id={campaign_id} agent={agent_id}")

        items: list[dict[str, Any]] = []
        for p in people:
            hh_local = f"batch3-hh-{p['idx']:03d}-{uuid.uuid4().hex[:8]}"
            rec_local = f"{BATCH_PREFIX}{p['idx']:03d}-{uuid.uuid4().hex[:8]}"
            address = f"{p['province']} (code {p['province_code']}) — batch recensement lot3"
            base = coords_for(p["province_code"]) or coords_for(p["province"]) or (-4.3276, 15.3136)
            lat, lng = jitter(base[0], base[1], rec_local)
            items.append(
                {
                    "entity_type": "household",
                    "local_id": hh_local,
                    "version": 1,
                    "data": {
                        "address_line": address,
                        "member_count": 1,
                        "address_source": "manual",
                        "province": p["province"],
                        "province_code": p["province_code"],
                        "province_origine": p["province"],
                        "latitude": lat,
                        "longitude": lng,
                    },
                }
            )
            items.append(
                {
                    "entity_type": "census_record",
                    "local_id": rec_local,
                    "version": 1,
                    "data": {
                        "household_local_id": hh_local,
                        "status": "SYNCED",
                        "sex": p["sexe"],
                        "date_of_birth": p["date_naissance"],
                        "family_name": p["nom"],
                        "given_names": p["prenom"],
                        "postnom": p["postnom"],
                        "nom": p["nom"],
                        "prenom": p["prenom"],
                        "profession": p["profession"],
                        "telephone": p["telephone"],
                        "province_origine": p["province"],
                        "province_code": p["province_code"],
                        "source": "batch_liste_lot3",
                        "payload": {
                            "nom": p["nom"],
                            "postnom": p["postnom"],
                            "prenom": p["prenom"],
                            "sexe": p["sexe"],
                            "date_naissance": p["date_naissance"],
                            "profession": p["profession"],
                            "telephone": p["telephone"],
                            "province_origine": p["province"],
                            "province_code": p["province_code"],
                            "nationalite": "Congolaise",
                            "pays_residence": "RDC",
                        },
                    },
                }
            )

        accepted = 0
        ah = {"Authorization": f"Bearer {agent_tok}", "Accept": "application/json"}
        # Agent push may need agent token; use agent for push
        for start in range(0, len(items), 20):
            chunk = items[start : start + 20]
            push = client.post(
                "/api/v1/census/sync/push",
                json={
                    "device_uid": DEVICE_UID,
                    "agent_user_id": agent_id,
                    "campaign_id": campaign_id,
                    "items": chunk,
                },
                headers=ah,
            )
            if push.status_code >= 400:
                # retry without auth header if open
                push = client.post(
                    "/api/v1/census/sync/push",
                    json={
                        "device_uid": DEVICE_UID,
                        "agent_user_id": agent_id,
                        "campaign_id": campaign_id,
                        "items": chunk,
                    },
                )
            if push.status_code >= 400:
                print(f"FAIL push: {push.status_code} {push.text[:500]}", file=sys.stderr)
                return 1
            body = push.json()
            accepted += int(body.get("accepted") or 0)
            print(f"push chunk accepted={body.get('accepted')} conflicts={body.get('conflicts')}")

        synced = client.get(
            f"/api/v1/census/campaigns/{campaign_id}/records",
            params={"status": "SYNCED", "limit": 500},
            headers=sh,
        )
        synced.raise_for_status()
        rows = synced.json()
        to_process = [r for r in rows if str(r.get("local_id") or "").startswith(BATCH_PREFIX)]
        print(f"synced_total={len(rows)} to_process={len(to_process)}")

        promoted = 0
        failed = 0
        with_nic = 0
        samples: list[dict[str, Any]] = []
        for r in to_process:
            rid = r["id"]
            name = f"{r.get('given_names')} {r.get('family_name')}"
            a = client.post(
                f"/api/v1/census/records/{rid}/approve",
                headers=sh,
                json={"note": "batch lot3 liste utilisateur"},
            )
            if a.status_code >= 400:
                print(f"  approve fail {name}: {a.status_code} {a.text[:120]}")
                failed += 1
                continue
            p = client.post(
                f"/api/v1/census/records/{rid}/promote",
                headers=sh,
                json={"assign_nic": True},
            )
            if p.status_code >= 400:
                print(f"  promote fail {name}: {p.status_code} {p.text[:160]}")
                failed += 1
                continue
            pj = p.json()
            nic = pj.get("nic")
            if nic:
                with_nic += 1
            if len(samples) < 5:
                samples.append({"name": name, "nic": nic, "citizen_id": pj.get("citizen_id")})
            promoted += 1
            print(f"  OK {name} nic={nic}")

        print(
            json.dumps(
                {
                    "accepted_items": accepted,
                    "promoted": promoted,
                    "with_nic": with_nic,
                    "failed": failed,
                    "samples": samples,
                },
                ensure_ascii=False,
            )
        )
        print(f"DONE promoted={promoted}/{len(people)} nic={with_nic} failed={failed}")
        return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
