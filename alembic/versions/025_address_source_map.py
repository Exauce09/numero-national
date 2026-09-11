"""Household address_source for map filter (manual vs GPS).

Revision ID: 025_address_source_map
Revises: 024_biometric_enrollment
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "025_address_source_map"
down_revision: Union[str, None] = "024_biometric_enrollment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "households",
        sa.Column("address_source", sa.String(32), nullable=True),
        schema="recensement",
    )
    op.create_index(
        "ix_households_address_source",
        "households",
        ["address_source"],
        schema="recensement",
    )


def downgrade() -> None:
    op.drop_index("ix_households_address_source", table_name="households", schema="recensement")
    op.drop_column("households", "address_source", schema="recensement")
