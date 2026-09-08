"""Initial foundation schema.

Revision ID: 001_foundation
Revises:
Create Date: 2026-09-08

Creates logical PostgreSQL schemas for future domain separation.
No citizen / NIC / métier tables yet (Phase 2+).
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001_foundation"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Logical schemas reserved for later phases (cahier §10).
FOUNDATION_SCHEMAS = (
    "identity",
    "core_registry",
    "audit",
    "recensement",
    "etat_civil",
    "cards",
    "biometric",
    "health",
    "analytics",
)


def upgrade() -> None:
    for schema in FOUNDATION_SCHEMAS:
        op.execute(f"CREATE SCHEMA IF NOT EXISTS {schema}")

    # Lightweight system metadata table — proves migrations work end-to-end.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS identity.system_meta (
            key VARCHAR(128) PRIMARY KEY,
            value TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        INSERT INTO identity.system_meta (key, value)
        VALUES ('schema_version', 'phase1-foundation')
        ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS identity.system_meta")
    for schema in reversed(FOUNDATION_SCHEMAS):
        op.execute(f"DROP SCHEMA IF EXISTS {schema} CASCADE")
