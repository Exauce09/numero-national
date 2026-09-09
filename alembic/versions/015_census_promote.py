"""Census → core_registry promotion link.

Revision ID: 015_census_promote
Revises: 014_census_review
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "015_census_promote"
down_revision: Union[str, None] = "014_census_review"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE recensement.census_record_status ADD VALUE IF NOT EXISTS 'PROMOTED'"
    )
    op.add_column(
        "census_records",
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="recensement",
    )
    op.add_column(
        "census_records",
        sa.Column("promoted_by", postgresql.UUID(as_uuid=True), nullable=True),
        schema="recensement",
    )
    op.add_column(
        "census_records",
        sa.Column("promoted_at", sa.DateTime(timezone=True), nullable=True),
        schema="recensement",
    )
    op.create_index(
        "ix_recensement_records_citizen_id",
        "census_records",
        ["citizen_id"],
        unique=True,
        schema="recensement",
        postgresql_where=sa.text("citizen_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_recensement_records_citizen_id",
        table_name="census_records",
        schema="recensement",
    )
    op.drop_column("census_records", "promoted_at", schema="recensement")
    op.drop_column("census_records", "promoted_by", schema="recensement")
    op.drop_column("census_records", "citizen_id", schema="recensement")
