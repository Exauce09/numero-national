"""Recensement (census) tables — Phase 3.

Revision ID: 006_recensement
Revises: 005_cards_documents
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_recensement"
down_revision: Union[str, None] = "005_cards_documents"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS recensement")

    campaign_status = postgresql.ENUM(
        "DRAFT", "ACTIVE", "PAUSED", "CLOSED",
        name="campaign_status",
        schema="recensement",
        create_type=False,
    )
    sync_batch_status = postgresql.ENUM(
        "PENDING", "PROCESSING", "ACCEPTED", "PARTIAL", "REJECTED",
        name="sync_batch_status",
        schema="recensement",
        create_type=False,
    )
    census_record_status = postgresql.ENUM(
        "DRAFT", "QUEUED", "SYNCED", "CONFLICT", "REJECTED",
        name="census_record_status",
        schema="recensement",
        create_type=False,
    )
    campaign_status.create(op.get_bind(), checkfirst=True)
    sync_batch_status.create(op.get_bind(), checkfirst=True)
    census_record_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("status", campaign_status, nullable=False, server_default="DRAFT"),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="recensement",
    )
    op.create_index("ix_recensement_campaigns_code", "campaigns", ["code"], schema="recensement")

    op.create_table(
        "zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.campaigns.id"), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("commune_code", sa.String(32)),
        sa.Column("province_code", sa.String(32)),
        sa.Column("geo_bounds", postgresql.JSONB()),
        schema="recensement",
    )
    op.create_index("ix_recensement_zones_campaign", "zones", ["campaign_id"], schema="recensement")

    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.campaigns.id"), nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.zones.id")),
        schema="recensement",
    )

    op.create_table(
        "agent_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.teams.id"), nullable=False),
        sa.Column("agent_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_label", sa.String(64), server_default="CENSUS_AGENT"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="recensement",
    )

    op.create_table(
        "devices",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_uid", sa.String(128), nullable=False, unique=True),
        sa.Column("agent_user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("platform", sa.String(64)),
        sa.Column("app_version", sa.String(32)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        schema="recensement",
    )

    op.create_table(
        "households",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.campaigns.id"), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.zones.id")),
        sa.Column("local_id", sa.String(128)),
        sa.Column("address_line", sa.String(512)),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("member_count", sa.Integer(), server_default="0"),
        sa.Column("collected_by", postgresql.UUID(as_uuid=True)),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.devices.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="recensement",
    )

    op.create_table(
        "census_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("household_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.households.id"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.campaigns.id"), nullable=False),
        sa.Column("local_id", sa.String(128)),
        sa.Column("given_names", sa.String(255)),
        sa.Column("family_name", sa.String(255)),
        sa.Column("sex", sa.String(16)),
        sa.Column("date_of_birth", sa.String(32)),
        sa.Column("payload", postgresql.JSONB()),
        sa.Column("photo_ref", sa.String(512)),
        sa.Column("status", census_record_status, nullable=False, server_default="DRAFT"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("collected_by", postgresql.UUID(as_uuid=True)),
        sa.Column("synced_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        schema="recensement",
    )

    op.create_table(
        "sync_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("device_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recensement.devices.id")),
        sa.Column("agent_user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("direction", sa.String(16), nullable=False),
        sa.Column("status", sync_batch_status, nullable=False, server_default="PENDING"),
        sa.Column("item_count", sa.Integer(), server_default="0"),
        sa.Column("accepted_count", sa.Integer(), server_default="0"),
        sa.Column("conflict_count", sa.Integer(), server_default="0"),
        sa.Column("payload_summary", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False"),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        schema="recensement",
    )


def downgrade() -> None:
    for table in (
        "sync_batches",
        "census_records",
        "households",
        "devices",
        "agent_assignments",
        "teams",
        "zones",
        "campaigns",
    ):
        op.drop_table(table, schema="recensement")
    op.execute("DROP TYPE IF EXISTS recensement.census_record_status")
    op.execute("DROP TYPE IF EXISTS recensement.sync_batch_status")
    op.execute("DROP TYPE IF EXISTS recensement.campaign_status")
