#!/usr/bin/env python3
"""Batch recensement: sync + approve + promote the provided people list."""

from __future__ import annotations

import json
import sys
import uuid
from typing import Any

import httpx

BASE = "http://127.0.0.1:8000"
AGENT_EMAIL = "agent.recensement@example.gov"
AGENT_PASSWORD = "CensusAgent123!"
SUP_EMAIL = "supervisor.recensement@example.gov"
SUP_PASSWORD = "CensusSupervisor123!"
CAMPAIGN_CODE = "RGPH-2026"
DEVICE_UID = "civil-batch-seed-20260913-b2"
BATCH_PREFIX = "batch2-rec-"

# prenom|nom|postnom|sexe|province_code|province|profession|telephone
RAW = """
Alain|Mbemba|Nsaku|M|04|Kongo-Central|Économiste|+243 812 347 651
Chantal|Mbuyi|Kalonji|F|06|Kasaï|Enseignante|+243 821 563 274
Didier|Kanku|Kabongo|M|08|Kasaï-Central|Médecin|+243 895 427 316
Nadège|Mukendi|Tshomba|F|01|Kinshasa|Informaticienne|+243 817 692 435
Benoît|Kyungu|Katumba|M|10|Haut-Katanga|Architecte|+243 977 314 628
Chérie|Lunda|Mbuyi|F|09|Lomami|Commerçante|+243 825 471 936
Fabrice|Musau|Kitenge|M|11|Lualaba|Géologue|+243 991 638 425
Esther|Masele|Lukusa|F|15|Nord-Kivu|Infirmière|+243 814 529 763
Dieudonné|Nlandu|Mavungu|M|04|Kongo-Central|Avocat|+243 856 314 792
Grâce|Kabamba|Muanza|F|01|Kinshasa|Journaliste|+243 822 745 316
Arnaud|Tshibangu|Kalume|M|13|Sud-Kivu|Enseignant|+243 898 361 527
Prisca|Mulamba|Kayembe|F|08|Kasaï-Central|Comptable|+243 816 527 439
Serge|Kambale|Muhindo|M|15|Nord-Kivu|Entrepreneur|+243 973 641 825
Clarisse|Bisimwa|Ndaye|F|13|Sud-Kivu|Pharmacienne|+243 829 316 754
Roland|Lofombo|Nzambe|M|03|Kwango|Agriculteur|+243 810 574 326
Mireille|Mbala|Kiala|F|04|Kongo-Central|Secrétaire|+243 843 725 619
Patrick|Tshilombo|Kabeya|M|06|Kasaï|Fonctionnaire|+243 899 462 713
Jeanne|Kanku|Ilunga|F|10|Haut-Katanga|Sage-femme|+243 815 638 247
Georges|Kalambayi|Mukendi|M|09|Lomami|Mécanicien|+243 827 451 936
Odette|Tshibanda|Mbuyi|F|08|Kasaï-Central|Couturière|+243 891 326 574
Hervé|Nsimba|Makengo|M|01|Kinshasa|Développeur|+243 812 695 431
Béatrice|Mavungu|Luyeye|F|03|Kwango|Agricultrice|+243 824 513 769
Cédric|Matondo|Banza|M|04|Kongo-Central|Électricien|+243 977 625 314
Martine|Bahati|Mugenzi|F|13|Sud-Kivu|Enseignante|+243 817 346 925
André|Kabasele|Tshomba|M|10|Haut-Katanga|Ingénieur|+243 896 571 243
Sylvie|Kasongo|Kabeya|F|12|Haut-Lomami|Infirmière|+243 821 634 759
Jérôme|Mbuyi|Kalala|M|06|Kasaï|Chauffeur|+243 855 427 681
Agnès|Ilunga|Mulamba|F|09|Lomami|Fonctionnaire|+243 814 753 296
Éric|Makengo|Nzita|M|04|Kongo-Central|Technicien|+243 991 362 547
Dorothée|Kiala|Mabiala|F|04|Kongo-Central|Avocate|+243 829 541 376
Marcel|Katumba|Kyungu|M|10|Haut-Katanga|Professeur|+243 975 624 813
Noëlla|Tshomba|Kanku|F|01|Kinshasa|Dentiste|+243 816 439 725
Gilbert|Lwamba|Mungala|M|11|Lualaba|Conducteur|+243 843 617 529
Élodie|Nsoki|Mbemba|F|01|Kinshasa|Psychologue|+243 825 364 791
Théodore|Mavungu|Nsimba|M|03|Kwango|Pasteur|+243 898 527 416
Amanda|Lukusa|Kiala|F|14|Maniema|Agricultrice|+243 812 736 495
Benjamin|Kalume|Bahati|M|13|Sud-Kivu|Militaire|+243 977 451 628
Isabelle|Mbuyi|Tshibanda|F|08|Kasaï-Central|Juriste|+243 821 695 347
Laurent|Kabongo|Mulumba|M|10|Haut-Katanga|Comptable|+243 895 316 742
Hélène|Mukendi|Kabasele|F|01|Kinshasa|Architecte|+243 817 524 639
""".strip()


def parse_people() -> list[dict[str, Any]]:
    rows = []
    for i, line in enumerate(RAW.splitlines(), start=1):
        parts = line.split("|")
        if len(parts) < 8:
            raise SystemExit(f"bad line {i}: {line}")
        prenom, nom, postnom, sexe, pcode, province, profession, tel = [p.strip() for p in parts]
        # Dates fictives distinctes (décalées vs lot 1)
        year = 1965 + (i % 40)
        month = ((i + 3) % 12) + 1
        day = ((i + 5) % 27) + 1
        rows.append(
            {
                "idx": i + 100,
                "prenom": prenom,
                "nom": nom,
                "postnom": postnom,
                "sexe": sexe,
                "province_code": pcode,
                "province": province,
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
    print(f"people={len(people)} campaign={CAMPAIGN_CODE}")

    with httpx.Client(base_url=BASE, timeout=60.0) as client:
        agent_tok = login(client, AGENT_EMAIL, AGENT_PASSWORD)
        me = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {agent_tok}"},
        )
        me.raise_for_status()
        agent_id = me.json()["id"]

        sup_tok = login(client, SUP_EMAIL, SUP_PASSWORD)
        sh = {"Authorization": f"Bearer {sup_tok}", "Accept": "application/json"}

        camps = client.get("/api/v1/census/campaigns", headers=sh)
        camps.raise_for_status()
        camp = next((c for c in camps.json() if c.get("code") == CAMPAIGN_CODE), None)
        if not camp:
            print("FAIL: campaign not found", file=sys.stderr)
            return 1
        campaign_id = camp["id"]
        print(f"campaign_id={campaign_id} agent={agent_id}")

        items: list[dict[str, Any]] = []
        local_ids: list[str] = []
        for p in people:
            hh_local = f"batch2-hh-{p['idx']:03d}-{uuid.uuid4().hex[:8]}"
            rec_local = f"{BATCH_PREFIX}{p['idx']:03d}-{uuid.uuid4().hex[:8]}"
            local_ids.append(rec_local)
            address = f"{p['province']} (code {p['province_code']}) — batch recensement"
            sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))
            from scripts.redistribute_map_rdc import coords_for, jitter  # noqa: WPS433

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
                        "source": "batch_liste_utilisateur",
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

        # Push par lots (évite payload trop gros)
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
            )
            if push.status_code >= 400:
                print(f"FAIL push: {push.status_code} {push.text[:500]}", file=sys.stderr)
                return 1
            body = push.json()
            accepted += int(body.get("accepted") or 0)
            print(f"push chunk accepted={body.get('accepted')} conflicts={body.get('conflicts')}")

        # Charger SYNCED et promouvoir
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
        results: list[dict[str, Any]] = []
        for r in to_process:
            rid = r["id"]
            name = f"{r.get('family_name')} {r.get('given_names')}"
            try:
                a = client.post(
                    f"/api/v1/census/records/{rid}/approve",
                    headers=sh,
                    json={"note": "batch recensement liste utilisateur"},
                )
                if a.status_code >= 400:
                    print(f"  approve fail {name}: {a.status_code} {a.text[:120]}")
                    failed += 1
                    continue
                p = client.post(
                    f"/api/v1/census/records/{rid}/promote",
                    headers=sh,
                    json={},
                )
                if p.status_code >= 400:
                    print(f"  promote fail {name}: {p.status_code} {p.text[:160]}")
                    failed += 1
                    continue
                pj = p.json()
                nic = None
                # fetch citizen nic if possible
                cid = pj.get("citizen_id")
                if cid:
                    # list via search
                    pass
                results.append({"name": name, "record_id": rid, "citizen_id": cid, "already": pj.get("already_promoted")})
                promoted += 1
                print(f"  OK {name} citizen={cid}")
            except Exception as exc:  # noqa: BLE001
                print(f"  ERR {name}: {exc}")
                failed += 1

        print(json.dumps({"accepted_items": accepted, "promoted": promoted, "failed": failed}, ensure_ascii=False))
        print(f"DONE promoted={promoted}/{len(people)} failed={failed}")
        return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
