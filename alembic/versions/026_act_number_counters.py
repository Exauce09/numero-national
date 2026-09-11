"""Sequential act numbering counters + correction review fields.

Revision ID: 026_act_number_counters
Revises: 025_address_source_map
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "026_act_number_counters"
down_revision: Union[str, None] = "025_address_source_map"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "act_number_counters",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("commune_code", sa.String(32), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("act_type", sa.String(32), nullable=False),
        sa.Column("last_seq", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "commune_code",
            "year",
            "act_type",
            name="uq_act_number_counters_commune_year_type",
        ),
        schema="etat_civil",
    )
    op.create_index(
        "ix_act_number_counters_lookup",
        "act_number_counters",
        ["commune_code", "year", "act_type"],
        schema="etat_civil",
    )

    op.add_column(
        "correction_requests",
        sa.Column("reviewed_by", sa.UUID(), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "correction_requests",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "correction_requests",
        sa.Column("review_note", sa.Text(), nullable=True),
        schema="etat_civil",
    )
    op.create_index(
        "ix_correction_requests_status",
        "correction_requests",
        ["status"],
        schema="etat_civil",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_correction_requests_status",
        table_name="correction_requests",
        schema="etat_civil",
    )
    op.drop_column("correction_requests", "review_note", schema="etat_civil")
    op.drop_column("correction_requests", "reviewed_at", schema="etat_civil")
    op.drop_column("correction_requests", "reviewed_by", schema="etat_civil")
    op.drop_index(
        "ix_act_number_counters_lookup",
        table_name="act_number_counters",
        schema="etat_civil",
    )
    op.drop_table("act_number_counters", schema="etat_civil")
