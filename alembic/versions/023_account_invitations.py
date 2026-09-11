"""Account invitations for PENDING activation.

Revision ID: 023_account_invitations
Revises: 022_etat_civil_juridique
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "023_account_invitations"
down_revision: Union[str, None] = "022_etat_civil_juridique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "account_invitations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("token_hash", sa.String(128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("token_hash", name="uq_account_invitations_token_hash"),
        schema="identity",
    )
    op.create_index(
        "ix_account_invitations_user_id",
        "account_invitations",
        ["user_id"],
        schema="identity",
    )


def downgrade() -> None:
    op.drop_index("ix_account_invitations_user_id", table_name="account_invitations", schema="identity")
    op.drop_table("account_invitations", schema="identity")
