#!/usr/bin/env python3
"""Batch recensement lot 4: Kalume Bwalya … Augustin Bosongo (indices 121–160)."""

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
ADMIN_EMAIL = "admin.recensement@example.gov"
ADMIN_PASSWORD = "CensusAdmin123!"
CAMPAIGN_CODE = "RGPH-2026"
DEVICE_UID = "civil-batch-seed-20260914-b4"
BATCH_PREFIX = "batch4-rec-"

PROV = {
    "Kinshasa": ("01", "Kinshasa"),
    "Nord-Kivu": ("15", "Nord-Kivu"),
    "Sud-Kivu": ("13", "Sud-Kivu"),
    "Mongala": ("17", "Mongala"),
    "Équateur": ("22", "Équateur"),
    "Equateur": ("22", "Équateur"),
    "Tshuapa": ("25", "Tshuapa"),
}

# prenom|nom|postnom|sexe|province|profession|telephone
# Noms saisis : Prenom Nom Postnom (sauf Nyiragasigwa Aline = Prenom composé / Nom / Postnom)
RAW = """
Kalume|Bwalya|Munganga|M|Nord-Kivu|Enseignant|+243 810 463 725
Aline|Nyiragasigwa|Mukamana|F|Sud-Kivu|Infirmière|+243 821 735 418
Ilambo|Tumba|Bosongo|M|Mongala|Agriculteur|+243 895 624 317
Yvette|Mboloko|Lofombo|F|Équateur|Commerçante|+243 817 452 936
Vicky|Kambale|Mathe|M|Nord-Kivu|Technicien|+243 977 316 524
Espérance|Bahati|Ciza|F|Sud-Kivu|Enseignante|+243 825 641 739
Patrice|Lokwa|Bokolo|M|Tshuapa|Fonctionnaire|+243 898 427 516
Grâce|Bolingo|Esengo|F|Kinshasa|Comptable|+243 814 536 927
Jérémie|Mumbere|Paluku|M|Nord-Kivu|Médecin|+243 856 314 729
Ruth|Kavira|Mbusa|F|Nord-Kivu|Pharmacienne|+243 822 675 431
André|Lofombo|Boketshu|M|Mongala|Mécanicien|+243 991 524 637
Nadège|Esengo|Boloko|F|Kinshasa|Journaliste|+243 816 437 925
Oscar|Mathe|Kambale|M|Nord-Kivu|Entrepreneur|+243 973 615 428
Béatrice|Ciza|Ndaya|F|Sud-Kivu|Médecin|+243 829 451 763
Samuel|Bokolo|Lokwa|M|Tshuapa|Agronome|+243 810 637 294
Claudine|Mukamana|Nyiragasigwa|F|Sud-Kivu|Sage-femme|+243 843 526 719
Marcel|Bosongo|Ilambo|M|Mongala|Électricien|+243 899 314 625
Chérie|Lofombo|Mboloko|F|Équateur|Couturière|+243 815 742 631
Jean|Paluku|Mumbere|M|Nord-Kivu|Chauffeur|+243 827 563 914
Alice|Mbusa|Kavira|F|Nord-Kivu|Avocate|+243 975 428 316
Emmanuel|Boketshu|Lofombo|M|Mongala|Ingénieur|+243 812 635 479
Mireille|Boloko|Esengo|F|Kinshasa|Architecte|+243 824 517 693
Emmanuel|Ciza|Bahati|M|Sud-Kivu|Professeur|+243 896 341 725
Solange|Nyiragasigwa|Mukamana|F|Sud-Kivu|Juriste|+243 821 463 957
Mathieu|Lokwa|Bosongo|M|Tshuapa|Informaticien|+243 855 627 314
Carine|Mboloko|Lofombo|F|Équateur|Secrétaire|+243 817 539 624
Patrick|Kambale|Mumbere|M|Nord-Kivu|Géologue|+243 977 451 326
Chantal|Kavira|Mbusa|F|Nord-Kivu|Infirmière|+243 829 617 435
Théodore|Ilambo|Bokolo|M|Mongala|Économiste|+243 898 536 217
Clarisse|Esengo|Bolingo|F|Kinshasa|Psychologue|+243 814 725 693
Daniel|Paluku|Kambale|M|Nord-Kivu|Administrateur|+243 810 394 627
Marie|Bahati|Ciza|F|Sud-Kivu|Enseignante|+243 843 671 529
Étienne|Bosongo|Lokwa|M|Tshuapa|Agriculteur|+243 891 425 736
Diane|Lofombo|Mboloko|F|Équateur|Entrepreneure|+243 825 637 419
Alain|Mumbere|Mathe|M|Nord-Kivu|Électricien|+243 973 524 681
Véronique|Mbusa|Kavira|F|Nord-Kivu|Fonctionnaire|+243 816 359 724
Didier|Bokolo|Ilambo|M|Mongala|Comptable|+243 856 471 329
Esther|Boloko|Esengo|F|Kinshasa|Médecin|+243 822 514 763
Joséphine|Mukamana|Bahati|F|Sud-Kivu|Commerçante|+243 899 637 425
Augustin|Lokwa|Bosongo|M|Tshuapa|Technicien|+243 817 426 935
""".strip()


def parse_people() -> list[dict[str, Any]]:
    rows = []
    for i, line in enumerate(RAW.splitlines(), start=1):
        parts = line.split("|")
        if len(parts) < 7:
            raise SystemExit(f"bad line {i}: {line}")
        prenom, nom, postnom, sexe, province, profession, tel = [p.strip() for p in parts]
        pcode, pname = PROV.get(province, ("01", province))
        year = 1970 + (i % 36)
        month = ((i + 2) % 12) + 1
        day = ((i + 9) % 27) + 1
        rows.append(
            {
                "idx": i + 220,
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

        promo_tok = login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
        sh = {"Authorization": f"Bearer {promo_tok}", "Accept": "application/json"}
        ah = {"Authorization": f"Bearer {agent_tok}", "Accept": "application/json"}

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
            hh_local = f"batch4-hh-{p['idx']:03d}-{uuid.uuid4().hex[:8]}"
            rec_local = f"{BATCH_PREFIX}{p['idx']:03d}-{uuid.uuid4().hex[:8]}"
            address = f"{p['province']} (code {p['province_code']}) — batch recensement lot4"
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
                        "source": "batch_liste_lot4",
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
                json={"note": "batch lot4 liste utilisateur"},
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
                samples.append({"name": name, "nic": nic})
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
