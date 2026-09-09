"""Census zones geo refs + unique campaign zone codes.

Revision ID: 013_census_ops
Revises: 012_geography
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013_census_ops"
down_revision: Union[str, None] = "012_geography"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "zones",
        sa.Column("geo_level", sa.String(32), nullable=True),
        schema="recensement",
    )
    op.add_column(
        "zones",
        sa.Column("geo_ref_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="recensement",
    )
    op.create_index(
        "ix_recensement_zones_geo_ref",
        "zones",
        ["geo_level", "geo_ref_id"],
        schema="recensement",
    )
    op.create_unique_constraint(
        "uq_recensement_zones_campaign_code",
        "zones",
        ["campaign_id", "code"],
        schema="recensement",
    )
    op.create_index(
        "ix_recensement_assignments_agent",
        "agent_assignments",
        ["agent_user_id"],
        schema="recensement",
    )


def downgrade() -> None:
    op.drop_index("ix_recensement_assignments_agent", table_name="agent_assignments", schema="recensement")
    op.drop_constraint("uq_recensement_zones_campaign_code", "zones", schema="recensement", type_="unique")
    op.drop_index("ix_recensement_zones_geo_ref", table_name="zones", schema="recensement")
    op.drop_column("zones", "geo_ref_id", schema="recensement")
    op.drop_column("zones", "geo_level", schema="recensement")
