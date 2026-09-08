"""Refresh sessions + operational indexes.

Revision ID: 011_refresh_sessions
Revises: 010_hardening
"""

from typing import Sequence, Union

from alembic import op

revision: str = "011_refresh_sessions"
down_revision: Union[str, None] = "010_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS identity.refresh_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
            jti_hash VARCHAR(64) NOT NULL UNIQUE,
            family_id UUID NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ NULL,
            replaced_by_jti_hash VARCHAR(64) NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_refresh_sessions_user_id
            ON identity.refresh_sessions (user_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_refresh_sessions_family_id
            ON identity.refresh_sessions (family_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS identity.refresh_sessions CASCADE")
