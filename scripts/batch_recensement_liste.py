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
DEVICE_UID = "civil-batch-seed-20260913"

# nom, postnom, prenom | sexe | province_code | province | profession | telephone
RAW = """
Emmanuel|Kabasele|Mulumba|M|10|Haut-Katanga|Ingénieur|+243 977 325 418
Christine|Mbayo|Mukendi|F|01|Kinshasa|Infirmière|+243 825 631 947
Joseph|Kasongo|Lwamba|M|11|Lualaba|Agriculteur|+243 991 458 276
Thérèse|Nsimba|Mabiala|F|01|Kinshasa|Avocate|+243 814 729 563
Daniel|Banza|Makengo|M|04|Kongo-Central|Entrepreneur|+243 856 310 000
Jacqueline|Lukusa|Kiala|F|04|Kongo-Central|Pharmacienne|+243 822 547 316
François|Mungala|Nzambe|M|03|Kwango|Enseignant|+243 899 632 154
Angélique|Nsoki|Matondo|F|01|Kinshasa|Commerçante|+243 817 425 638
Michel|Kimbangu|Mavungu|M|04|Kongo-Central|Journaliste|+243 843 716 295
Solange|Kalume|Bahati|F|13|Sud-Kivu|Médecin|+243 975 284 631
André|Ilunga|Kabeya|M|09|Lomami|Agriculteur|+243 816 539 742
Bernadette|Mulumba|Tshibanda|F|08|Kasaï-Central|Couturière|+243 829 641 573
Christian|Mbuyi|Kalambayi|M|06|Kasaï|Fonctionnaire|+243 898 315 624
Joséphine|Tshilombo|Kanku|F|10|Haut-Katanga|Enseignante|+243 824 753 916
Albert|Mukendi|Kasongo|M|12|Haut-Lomami|Chauffeur|+243 973 426 185
Pauline|Kabeya|Luyeye|F|01|Kinshasa|Architecte|+243 815 672 439
Robert|Mabiala|Nsimba|M|04|Kongo-Central|Policier|+243 891 347 526
Marthe|Kiala|Lukusa|F|14|Maniema|Infirmière|+243 827 516 394
Serge|Makengo|Banza|M|01|Kinshasa|Développeur|+243 810 683 257
Véronique|Matondo|Nsoki|F|04|Kongo-Central|Avocate|+243 855 429 713
Théophile|Nzita|Mbemba|M|15|Nord-Kivu|Commerçant|+243 975 613 482
Cécile|Mavungu|Kimbangu|F|04|Kongo-Central|Agricultrice|+243 821 754 369
Christophe|Lwamba|Kasongo|M|13|Sud-Kivu|Enseignant|+243 896 235 714
Madeleine|Bahati|Kalume|F|13|Sud-Kivu|Sage-femme|+243 814 563 927
Bernard|Tshibanda|Mbuyi|M|08|Kasaï-Central|Ingénieur|+243 977 418 625
Germaine|Ilunga|Mulumba|F|09|Lomami|Fonctionnaire|+243 825 739 416
Augustin|Kabeya|Kabasele|M|10|Haut-Katanga|Électricien|+243 812 654 783
Monique|Kanku|Tshilombo|F|06|Kasaï|Commerçante|+243 899 247 531
Roger|Kalambayi|Mukendi|M|01|Kinshasa|Chauffeur|+243 816 425 897
Suzanne|Mbuyi|Kabeya|F|07|Sankuru|Enseignante|+243 843 591 726
Denis|Nsimba|Matondo|M|04|Kongo-Central|Technicien|+243 822 638 451
Rosalie|Mabiala|Kiala|F|14|Maniema|Agricultrice|+243 991 524 637
Olivier|Banza|Makengo|M|03|Kwango|Entrepreneur|+243 857 316 942
Alice|Lukusa|Nsimba|F|16|Nord-Ubangi|Infirmière|+243 817 649 325
Mathieu|Kasongo|Lwamba|M|11|Lualaba|Mécanicien|+243 975 831 264
Florence|Mbayo|Tshibanda|F|08|Kasaï-Central|Secrétaire|+243 829 475 613
""".strip()


def parse_people() -> list[dict[str, Any]]:
    rows = []
    for i, line in enumerate(RAW.splitlines(), start=1):
        parts = line.split("|")
        if len(parts) < 8:
            raise SystemExit(f"bad line {i}: {line}")
        prenom, nom, postnom, sexe, pcode, province, profession, tel = [p.strip() for p in parts]
        # Dates fictives distinctes (année 1970+i) pour éviter collisions NIC exactes.
        year = 1970 + (i % 35)
        month = (i % 12) + 1
        day = (i % 27) + 1
        rows.append(
            {
                "idx": i,
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
            hh_local = f"batch-hh-{p['idx']:02d}-{uuid.uuid4().hex[:8]}"
            rec_local = f"batch-rec-{p['idx']:02d}-{uuid.uuid4().hex[:8]}"
            local_ids.append(rec_local)
            address = f"{p['province']} (code {p['province_code']}) — batch recensement"
            items.append(
                {
                    "entity_type": "household",
                    "local_id": hh_local,
                    "version": 1,
                    "data": {
                        "address_line": address,
                        "member_count": 1,
                        "address_source": "manual",
                        "latitude": -4.32 + (p["idx"] * 0.001),
                        "longitude": 15.30 + (p["idx"] * 0.001),
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
        to_process = [r for r in rows if str(r.get("local_id") or "").startswith("batch-rec-")]
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
