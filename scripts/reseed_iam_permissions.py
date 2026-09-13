"""One-shot: re-apply IAM role permission grants from seed map."""
import asyncio

from apps.api.db.session import AsyncSessionLocal
from apps.api.domains.identity.seed import seed_roles_and_permissions


async def main() -> None:
    async with AsyncSessionLocal() as db:
        await seed_roles_and_permissions(db)
    print("seed_roles_and_permissions OK")


if __name__ == "__main__":
    asyncio.run(main())
