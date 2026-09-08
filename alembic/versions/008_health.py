"""Health confidentiality schema tables — Phase 8.

Revision ID: 008_health
Revises: 007_biometric
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "008_health"
down_revision: Union[str, None] = "007_biometric"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS health")

    facility_type = postgresql.ENUM(
        "HOSPITAL", "CLINIC", "MATERNITY", "OTHER",
        name="facility_type",
        schema="health",
        create_type=False,
    )
    notif_status = postgresql.ENUM(
        "DRAFT", "SUBMITTED", "FORWARDED_CIVIL", "REJECTED",
        name="health_notification_status",
        schema="health",
        create_type=False,
    )
    facility_type.create(op.get_bind(), checkfirst=True)
    notif_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "health_facilities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("facility_type", facility_type, nullable=False, server_default="HOSPITAL"),
        sa.Column("commune_code", sa.String(32)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="health",
    )

    op.create_table(
        "health_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("citizen_reference", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("facility_id", postgresql.UUID(as_uuid=True)),
        sa.Column("record_type", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="health",
    )
    op.create_index(
        "ix_health_records_citizen_ref",
        "health_records",
        ["citizen_reference"],
        schema="health",
    )

    op.create_table(
        "birth_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("facility_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mother_citizen_reference", postgresql.UUID(as_uuid=True)),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", notif_status, nullable=False, server_default="DRAFT"),
        sa.Column("civil_declaration_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="health",
    )

    op.create_table(
        "death_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("facility_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("citizen_reference", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", notif_status, nullable=False, server_default="DRAFT"),
        sa.Column("civil_declaration_id", postgresql.UUID(as_uuid=True)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="health",
    )


def downgrade() -> None:
    op.drop_table("death_notifications", schema="health")
    op.drop_table("birth_notifications", schema="health")
    op.drop_table("health_records", schema="health")
    op.drop_table("health_facilities", schema="health")
    op.execute("DROP TYPE IF EXISTS health.health_notification_status")
    op.execute("DROP TYPE IF EXISTS health.facility_type")
