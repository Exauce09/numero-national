"""Biometric vault tables — Phase 6.

Revision ID: 007_biometric
Revises: 006_recensement
Create Date: 2026-09-08

Templates live ONLY in schema biometric — never in citizens tables.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "007_biometric"
down_revision: Union[str, None] = "006_recensement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS biometric")

    modality = postgresql.ENUM(
        "FINGERPRINT", "FACE", "IRIS",
        name="biometric_modality",
        schema="biometric",
        create_type=False,
    )
    decision = postgresql.ENUM(
        "MATCH_CONFIRMED", "NO_MATCH", "MANUAL_REVIEW",
        name="dedup_decision",
        schema="biometric",
        create_type=False,
    )
    modality.create(op.get_bind(), checkfirst=True)
    decision.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "biometric_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("modality", modality, nullable=False),
        sa.Column("template_encrypted", sa.LargeBinary(), nullable=False),
        sa.Column("quality_score", sa.Float()),
        sa.Column("algorithm_version", sa.String(64), nullable=False, server_default="mvp-hash-v1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="biometric",
    )
    op.create_index(
        "ix_biometric_templates_citizen",
        "biometric_templates",
        ["citizen_id"],
        schema="biometric",
    )

    op.create_table(
        "identity_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("media_type", sa.String(64), nullable=False, server_default="OFFICIAL_PHOTO"),
        sa.Column("storage_uri", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.String(128)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="biometric",
    )
    op.create_index(
        "ix_identity_media_citizen",
        "identity_media",
        ["citizen_id"],
        schema="biometric",
    )

    op.create_table(
        "dedup_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("probe_citizen_id", postgresql.UUID(as_uuid=True)),
        sa.Column("modality", modality, nullable=False),
        sa.Column("candidates", postgresql.JSONB()),
        sa.Column("scores", postgresql.JSONB()),
        sa.Column("decision", decision),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="biometric",
    )


def downgrade() -> None:
    op.drop_table("dedup_sessions", schema="biometric")
    op.drop_table("identity_media", schema="biometric")
    op.drop_table("biometric_templates", schema="biometric")
    op.execute("DROP TYPE IF EXISTS biometric.dedup_decision")
    op.execute("DROP TYPE IF EXISTS biometric.biometric_modality")
