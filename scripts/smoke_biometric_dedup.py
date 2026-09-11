"""Smoke: 3-finger enroll then duplicate blocked."""
from __future__ import annotations

import asyncio
import base64
from uuid import uuid4

from httpx import AsyncClient

from apps.api.main import app  # noqa: F401 — ensure app importable in container


def tpl(key: str, finger: str) -> str:
    return base64.b64encode(f"FINGERPRINT|{key}|{finger}|v1".encode()).decode()


async def main() -> None:
    async with AsyncClient(base_url="http://127.0.0.1:8000", timeout=60.0) as c:
        r = await c.post(
            "/api/v1/auth/login",
            json={"email": "officier.etatcivil@example.gov", "password": "CivilOfficer123!"},
        )
        if r.status_code != 200:
            r = await c.post(
                "/api/v1/auth/login",
                data={
                    "username": "officier.etatcivil@example.gov",
                    "password": "CivilOfficer123!",
                },
            )
        print("login", r.status_code, r.text[:240])
        r.raise_for_status()
        tok = r.json().get("access_token")
        h = {"Authorization": f"Bearer {tok}"}

        # Ensure biometric perms present (re-login after seed if needed)
        me = await c.get("/api/v1/auth/me", headers=h)
        print("me perms biometric", [p for p in (me.json().get("permissions") or []) if "bio" in p])

        cit = await c.get("/api/v1/registry/citizens", headers=h, params={"page_size": 5})
        print("citizens", cit.status_code)
        payload = cit.json()
        items = payload.get("items") or payload.get("results") or []
        if isinstance(payload, list):
            items = payload
        assert len(items) >= 1, "need at least one citizen"
        c1 = items[0]["id"]
        c2 = items[1]["id"] if len(items) > 1 else None
        if not c2:
            create = await c.post(
                "/api/v1/registry/citizens",
                headers=h,
                json={
                    "family_name": "BIOTEST",
                    "given_names": "Dedup",
                    "sex": "M",
                    "birth_date": "1990-01-01",
                },
            )
            print("create citizen", create.status_code, create.text[:200])
            if create.status_code < 400:
                c2 = create.json().get("id")
            else:
                c2 = str(uuid4())
        print("c1", c1, "c2", c2)

        e1 = await c.post("/api/v1/biometric/enrollments", headers=h, json={"citizen_id": c1})
        print("enroll1", e1.status_code, e1.text[:200])
        e1.raise_for_status()
        eid = e1.json()["id"]
        for f in ("INDEX_DROIT", "POUCE_DROIT", "INDEX_GAUCHE"):
            cap = await c.post(
                f"/api/v1/biometric/enrollments/{eid}/capture",
                headers=h,
                json={
                    "finger_position": f,
                    "template_b64": tpl("demo-print-SMOKE", f),
                    "quality_score": 95,
                },
            )
            body = cap.json()
            print("cap", f, cap.status_code, body.get("blocked"), body.get("accepted"))
            cap.raise_for_status()
            assert body["accepted"] and not body["blocked"]
        fin = await c.post(f"/api/v1/biometric/enrollments/{eid}/finalize", headers=h, json={})
        print("finalize", fin.status_code, fin.text[:120])
        fin.raise_for_status()

        e2 = await c.post("/api/v1/biometric/enrollments", headers=h, json={"citizen_id": c2})
        print("enroll2", e2.status_code, e2.text[:200])
        e2.raise_for_status()
        eid2 = e2.json()["id"]
        cap2 = await c.post(
            f"/api/v1/biometric/enrollments/{eid2}/capture",
            headers=h,
            json={
                "finger_position": "INDEX_DROIT",
                "template_b64": tpl("demo-print-SMOKE", "INDEX_DROIT"),
                "quality_score": 97,
            },
        )
        body = cap2.json()
        print(
            "dup",
            cap2.status_code,
            "blocked=",
            body.get("blocked"),
            "score=",
            (body.get("match") or {}).get("match_score"),
        )
        assert body.get("blocked") is True
        assert body.get("accepted") is False
        assert "template_encrypted" not in body
        print("OK dedup blocked")


if __name__ == "__main__":
    asyncio.run(main())
