"""Module 12 — schéma population_movements (événements mobilité liés FGP).

Revision ID: 030_population_movements
Revises: 029_citizen_person_kind
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "030_population_movements"
down_revision: Union[str, None] = "029_citizen_person_kind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS population_movements")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "population_movements",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("movement_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="DRAFT", nullable=False),
        sa.Column(
            "declared_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("observed_date", sa.Date(), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_type", sa.String(length=32), server_default="AGENT", nullable=False),
        sa.Column("source_reference", sa.String(length=128), nullable=True),
        sa.Column("reason_code", sa.String(length=64), nullable=True),
        sa.Column("notes_minimal", sa.String(length=500), nullable=True),
        sa.Column("origin_province_code", sa.String(length=32), nullable=True),
        sa.Column("origin_commune_code", sa.String(length=64), nullable=True),
        sa.Column("origin_label", sa.String(length=255), nullable=True),
        sa.Column("destination_province_code", sa.String(length=32), nullable=True),
        sa.Column("destination_commune_code", sa.String(length=64), nullable=True),
        sa.Column("destination_city", sa.String(length=128), nullable=True),
        sa.Column("destination_line1", sa.String(length=255), nullable=True),
        sa.Column("destination_label", sa.String(length=255), nullable=True),
        sa.Column(
            "sensitivity_class",
            sa.String(length=32),
            server_default="STANDARD",
            nullable=False,
        ),
        sa.Column(
            "update_fgp_residence",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "fgp_residence_applied",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("validated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("decision_reason", sa.String(length=500), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["citizen_id"],
            ["core_registry.citizens.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_type",
            "source_reference",
            name="uq_population_movements_source_ref",
        ),
        schema="population_movements",
    )
    op.create_index(
        "ix_population_movements_citizen_id",
        "population_movements",
        ["citizen_id"],
        schema="population_movements",
    )
    op.create_index(
        "ix_population_movements_movement_type",
        "population_movements",
        ["movement_type"],
        schema="population_movements",
    )
    op.create_index(
        "ix_population_movements_status",
        "population_movements",
        ["status"],
        schema="population_movements",
    )

    op.create_table(
        "movement_event_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("movement_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("old_status", sa.String(length=32), nullable=True),
        sa.Column("new_status", sa.String(length=32), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["movement_id"],
            ["population_movements.population_movements.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="population_movements",
    )
    op.create_index(
        "ix_movement_event_history_movement_id",
        "movement_event_history",
        ["movement_id"],
        schema="population_movements",
    )


def downgrade() -> None:
    op.drop_table("movement_event_history", schema="population_movements")
    op.drop_table("population_movements", schema="population_movements")
    op.execute("DROP SCHEMA IF EXISTS population_movements CASCADE")
