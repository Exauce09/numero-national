"""Grant missing role permissions via SQL (reliable under AsyncSession)."""
from __future__ import annotations

import asyncio

from sqlalchemy import text

from apps.api.db.session import AsyncSessionLocal
from apps.api.domains.identity.seed import ROLE_PERMISSION_MAP

SQL = """
INSERT INTO identity.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM identity.roles r
CROSS JOIN identity.permissions p
WHERE r.code = :role_code
  AND p.code = :perm_code
ON CONFLICT DO NOTHING
"""


async def main() -> None:
    async with AsyncSessionLocal() as db:
        total = 0
        for role_code, perms in ROLE_PERMISSION_MAP.items():
            for perm_code in perms:
                res = await db.execute(
                    text(SQL),
                    {"role_code": role_code, "perm_code": perm_code},
                )
                total += res.rowcount or 0
        await db.commit()
    print(f"granted/ensured role permissions (insert attempts touched ~{total} rows)")


if __name__ == "__main__":
    asyncio.run(main())
