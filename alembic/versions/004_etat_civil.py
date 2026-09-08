"""État civil tables (Phase 4).

Revision ID: 004_etat_civil
Revises: 003_core_registry
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "004_etat_civil"
down_revision: Union[str, None] = "003_core_registry"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS etat_civil")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "civil_acts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("act_type", sa.String(32), nullable=False),
        sa.Column("act_number", sa.String(64), nullable=False),
        sa.Column("commune_code", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("related_citizen_ids", postgresql.JSONB(), nullable=True),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("act_number", "commune_code", name="uq_civil_acts_number_commune"),
        schema="etat_civil",
    )
    op.create_index("ix_civil_acts_act_type", "civil_acts", ["act_type"], schema="etat_civil")
    op.create_index(
        "ix_civil_acts_commune_code", "civil_acts", ["commune_code"], schema="etat_civil"
    )
    op.create_index("ix_civil_acts_status", "civil_acts", ["status"], schema="etat_civil")
    op.create_index("ix_civil_acts_citizen", "civil_acts", ["citizen_id"], schema="etat_civil")
    op.create_index(
        "ix_civil_acts_commune_type",
        "civil_acts",
        ["commune_code", "act_type"],
        schema="etat_civil",
    )

    op.create_table(
        "civil_declarations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("source", sa.String(32), nullable=False, server_default="HOSPITAL"),
        sa.Column("declaration_type", sa.String(32), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="RECEIVED"),
        sa.Column("linked_act_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["linked_act_id"],
            ["etat_civil.civil_acts.id"],
            ondelete="SET NULL",
        ),
        schema="etat_civil",
    )
    op.create_index(
        "ix_civil_declarations_status",
        "civil_declarations",
        ["status"],
        schema="etat_civil",
    )

    op.create_table(
        "residence_records",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line1", sa.String(255), nullable=False),
        sa.Column("line2", sa.String(255), nullable=True),
        sa.Column("city", sa.String(128), nullable=False),
        sa.Column("commune_code", sa.String(32), nullable=False),
        sa.Column("province_code", sa.String(32), nullable=True),
        sa.Column("country_code", sa.String(3), nullable=False, server_default="COD"),
        sa.Column("attestation_number", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.UniqueConstraint("attestation_number", name="uq_residence_attestation_number"),
        schema="etat_civil",
    )
    op.create_index(
        "ix_residence_citizen", "residence_records", ["citizen_id"], schema="etat_civil"
    )

    op.create_table(
        "correction_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("field_name", sa.String(128), nullable=False),
        sa.Column("current_value", sa.Text(), nullable=True),
        sa.Column("requested_value", sa.Text(), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="SUBMITTED"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="etat_civil",
    )
    op.create_index(
        "ix_correction_requests_citizen",
        "correction_requests",
        ["citizen_id"],
        schema="etat_civil",
    )


def downgrade() -> None:
    op.drop_table("correction_requests", schema="etat_civil")
    op.drop_table("residence_records", schema="etat_civil")
    op.drop_table("civil_declarations", schema="etat_civil")
    op.drop_table("civil_acts", schema="etat_civil")
