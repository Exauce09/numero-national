"""Biometric enrollment: fingers, matches, thresholds, devices.

Revision ID: 024_biometric_enrollment
Revises: 023_account_invitations
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "024_biometric_enrollment"
down_revision: Union[str, None] = "023_account_invitations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    finger_status = postgresql.ENUM(
        "ACTIVE",
        "REVOKED",
        "REPLACED",
        "INVALID",
        "PENDING",
        name="fingerprint_status",
        schema="biometric",
        create_type=False,
    )
    enroll_status = postgresql.ENUM(
        "OPEN",
        "COMPLETED",
        "BLOCKED",
        "CANCELLED",
        name="enrollment_status",
        schema="biometric",
        create_type=False,
    )
    match_decision = postgresql.ENUM(
        "NO_MATCH",
        "REVIEW",
        "STRONG_MATCH",
        "EXCEPTION_APPROVED",
        "REJECTED",
        name="match_decision",
        schema="biometric",
        create_type=False,
    )
    finger_status.create(op.get_bind(), checkfirst=True)
    enroll_status.create(op.get_bind(), checkfirst=True)
    match_decision.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "biometric_devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_code", sa.String(64), nullable=False, unique=True),
        sa.Column("manufacturer", sa.String(128)),
        sa.Column("model", sa.String(128)),
        sa.Column("serial_number", sa.String(128)),
        sa.Column("location_id", postgresql.UUID(as_uuid=True)),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="biometric",
    )

    op.create_table(
        "biometric_thresholds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("biometric_type", sa.String(32), nullable=False, server_default="FINGERPRINT"),
        sa.Column("environment", sa.String(32), nullable=False, server_default="demo"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="biometric",
    )
    op.create_index(
        "ix_biometric_thresholds_active",
        "biometric_thresholds",
        ["biometric_type", "active"],
        schema="biometric",
    )

    op.create_table(
        "biometric_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", enroll_status, nullable=False, server_default="OPEN"),
        sa.Column("enrollment_date", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("enrolled_by", postgresql.UUID(as_uuid=True)),
        sa.Column("device_id", postgresql.UUID(as_uuid=True)),
        sa.Column("location_id", postgresql.UUID(as_uuid=True)),
        sa.Column("required_fingers", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="biometric",
    )
    op.create_index(
        "ix_biometric_enrollments_citizen",
        "biometric_enrollments",
        ["citizen_id"],
        schema="biometric",
    )

    op.add_column(
        "biometric_templates",
        sa.Column("enrollment_id", postgresql.UUID(as_uuid=True)),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("finger_position", sa.String(32)),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("hand", sa.String(16)),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("status", finger_status, server_default="ACTIVE"),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("template_hash", sa.String(64)),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("device_id", postgresql.UUID(as_uuid=True)),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("capture_device", sa.String(128)),
        schema="biometric",
    )
    op.add_column(
        "biometric_templates",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        schema="biometric",
    )
    op.create_index(
        "ix_biometric_templates_finger",
        "biometric_templates",
        ["citizen_id", "finger_position", "status"],
        schema="biometric",
    )
    op.create_index(
        "ix_biometric_templates_hash",
        "biometric_templates",
        ["template_hash"],
        schema="biometric",
    )

    op.create_table(
        "biometric_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("source_citizen_id", postgresql.UUID(as_uuid=True)),
        sa.Column("matched_citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_fingerprint_id", postgresql.UUID(as_uuid=True)),
        sa.Column("matched_fingerprint_id", postgresql.UUID(as_uuid=True)),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("threshold_used", sa.Float(), nullable=False),
        sa.Column("decision", match_decision, nullable=False),
        sa.Column("review_status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True)),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("reason", sa.Text()),
        sa.Column("finger_position", sa.String(32)),
        sa.Column("enrollment_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="biometric",
    )
    op.create_index(
        "ix_biometric_matches_matched",
        "biometric_matches",
        ["matched_citizen_id"],
        schema="biometric",
    )

    # Demo thresholds (clearly environment=demo — not official national thresholds)
    op.execute(
        """
        INSERT INTO biometric.biometric_thresholds (id, name, value, biometric_type, environment, active)
        VALUES
          (gen_random_uuid(), 'fingerprint_strong', 0.90, 'FINGERPRINT', 'demo', true),
          (gen_random_uuid(), 'fingerprint_review', 0.70, 'FINGERPRINT', 'demo', true),
          (gen_random_uuid(), 'fingerprint_min_quality', 60.0, 'FINGERPRINT', 'demo', true)
        """
    )


def downgrade() -> None:
    op.drop_table("biometric_matches", schema="biometric")
    op.drop_index("ix_biometric_templates_hash", table_name="biometric_templates", schema="biometric")
    op.drop_index("ix_biometric_templates_finger", table_name="biometric_templates", schema="biometric")
    for col in (
        "enrollment_id",
        "finger_position",
        "hand",
        "status",
        "template_hash",
        "device_id",
        "capture_device",
        "updated_at",
    ):
        op.drop_column("biometric_templates", col, schema="biometric")
    op.drop_table("biometric_enrollments", schema="biometric")
    op.drop_table("biometric_thresholds", schema="biometric")
    op.drop_table("biometric_devices", schema="biometric")
    op.execute("DROP TYPE IF EXISTS biometric.match_decision")
    op.execute("DROP TYPE IF EXISTS biometric.enrollment_status")
    op.execute("DROP TYPE IF EXISTS biometric.fingerprint_status")
