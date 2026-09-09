"""Census supervisor review — APPROVED status + review audit columns.

Revision ID: 014_census_review
Revises: 013_census_ops
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "014_census_review"
down_revision: Union[str, None] = "013_census_ops"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE recensement.census_record_status ADD VALUE IF NOT EXISTS 'APPROVED'"
    )
    op.add_column(
        "census_records",
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        schema="recensement",
    )
    op.add_column(
        "census_records",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        schema="recensement",
    )
    op.add_column(
        "census_records",
        sa.Column("review_note", sa.Text(), nullable=True),
        schema="recensement",
    )
    op.create_index(
        "ix_recensement_records_status",
        "census_records",
        ["campaign_id", "status"],
        schema="recensement",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_recensement_records_status",
        table_name="census_records",
        schema="recensement",
    )
    op.drop_column("census_records", "review_note", schema="recensement")
    op.drop_column("census_records", "reviewed_at", schema="recensement")
    op.drop_column("census_records", "reviewed_by", schema="recensement")
    # PostgreSQL cannot easily remove enum values; leave APPROVED in place.
