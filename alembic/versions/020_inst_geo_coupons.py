"""Health province_code + census field coupons for APK sync.

Revision ID: 020_inst_geo_coupons
Revises: 019_postgis_zd_geospatial
"""

from typing import Sequence, Union

from alembic import op

revision: str = "020_inst_geo_coupons"
down_revision: Union[str, None] = "019_postgis_zd_geospatial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE health.health_facilities
            ADD COLUMN IF NOT EXISTS province_code VARCHAR(32)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_health_facilities_province "
        "ON health.health_facilities (province_code)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_health_facilities_commune "
        "ON health.health_facilities (commune_code)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS recensement.field_coupons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_id UUID NOT NULL
                REFERENCES recensement.campaigns(id) ON DELETE CASCADE,
            local_id VARCHAR(128) NOT NULL,
            household_local_id VARCHAR(128),
            family_name VARCHAR(255),
            given_names VARCHAR(255),
            sex VARCHAR(16),
            date_of_birth VARCHAR(32),
            qr_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            agent_user_id UUID,
            device_uid VARCHAR(128),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_field_coupon_campaign_local UNIQUE (campaign_id, local_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_field_coupons_campaign "
        "ON recensement.field_coupons (campaign_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_field_coupons_agent "
        "ON recensement.field_coupons (agent_user_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS recensement.field_coupons")
    op.execute("ALTER TABLE health.health_facilities DROP COLUMN IF EXISTS province_code")
