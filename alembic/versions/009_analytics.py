"""Analytics aggregates + notifications — Phase 9.

Revision ID: 009_analytics
Revises: 008_health
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "009_analytics"
down_revision: Union[str, None] = "008_health"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")
    op.execute("CREATE SCHEMA IF NOT EXISTS notifications")

    op.create_table(
        "aggregate_metrics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("metric_key", sa.String(128), nullable=False),
        sa.Column("dimension", postgresql.JSONB()),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("period", sa.String(64), nullable=False),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        schema="analytics",
    )
    op.create_index(
        "ix_aggregate_metrics_key",
        "aggregate_metrics",
        ["metric_key"],
        schema="analytics",
    )
    op.create_index(
        "ix_aggregate_metrics_period",
        "aggregate_metrics",
        ["period"],
        schema="analytics",
    )

    channel = postgresql.ENUM(
        "EMAIL", "SMS", "PUSH", "IN_APP",
        name="notification_channel",
        schema="notifications",
        create_type=False,
    )
    nstatus = postgresql.ENUM(
        "PENDING", "SENT", "FAILED", "CANCELLED",
        name="notification_status",
        schema="notifications",
        create_type=False,
    )
    channel.create(op.get_bind(), checkfirst=True)
    nstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("channel", channel, nullable=False),
        sa.Column("recipient", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255)),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", nstatus, nullable=False, server_default="PENDING"),
        sa.Column("meta", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        schema="notifications",
    )


def downgrade() -> None:
    op.drop_table("notifications", schema="notifications")
    op.execute("DROP TYPE IF EXISTS notifications.notification_status")
    op.execute("DROP TYPE IF EXISTS notifications.notification_channel")
    op.drop_table("aggregate_metrics", schema="analytics")
    op.execute("DROP SCHEMA IF EXISTS notifications CASCADE")
