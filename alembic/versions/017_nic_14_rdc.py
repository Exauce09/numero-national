"""Widen NIC columns to 14 digits (structured RDC format).

Revision ID: 017_nic_14_rdc
Revises: 016_geo_accounts_drafts
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_nic_14_rdc"
down_revision: Union[str, None] = "016_geo_accounts_drafts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "citizens",
        "nic",
        existing_type=sa.String(length=13),
        type_=sa.String(length=14),
        existing_nullable=True,
        schema="core_registry",
    )
    op.alter_column(
        "nic_issuance_log",
        "nic",
        existing_type=sa.String(length=13),
        type_=sa.String(length=14),
        existing_nullable=False,
        schema="core_registry",
    )


def downgrade() -> None:
    op.alter_column(
        "nic_issuance_log",
        "nic",
        existing_type=sa.String(length=14),
        type_=sa.String(length=13),
        existing_nullable=False,
        schema="core_registry",
    )
    op.alter_column(
        "citizens",
        "nic",
        existing_type=sa.String(length=14),
        type_=sa.String(length=13),
        existing_nullable=True,
        schema="core_registry",
    )
