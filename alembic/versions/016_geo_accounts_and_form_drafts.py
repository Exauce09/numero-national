"""User geo scope (province→ville) + shared form drafts.

Revision ID: 016_geo_accounts_drafts
Revises: 015_census_promote
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016_geo_accounts_drafts"
down_revision: Union[str, None] = "015_census_promote"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("province_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="identity",
    )
    op.add_column(
        "users",
        sa.Column("ville_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="identity",
    )
    op.add_column(
        "users",
        sa.Column("commune_id", postgresql.UUID(as_uuid=True), nullable=True),
        schema="identity",
    )
    op.create_foreign_key(
        "fk_users_province_id",
        "users",
        "provinces",
        ["province_id"],
        ["id"],
        source_schema="identity",
        referent_schema="geography",
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_ville_id",
        "users",
        "villes",
        ["ville_id"],
        ["id"],
        source_schema="identity",
        referent_schema="geography",
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_commune_id",
        "users",
        "communes",
        ["commune_id"],
        ["id"],
        source_schema="identity",
        referent_schema="geography",
        ondelete="SET NULL",
    )
    op.create_index("ix_users_province_id", "users", ["province_id"], schema="identity")
    op.create_index("ix_users_ville_id", "users", ["ville_id"], schema="identity")

    op.create_table(
        "form_drafts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("system", sa.String(32), nullable=False),
        sa.Column("form_type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False, server_default=""),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="DRAFT"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("local_id", sa.String(128), nullable=True),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("province_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ville_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("claimed_by", postgresql.UUID(as_uuid=True), nullable=True),
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
        schema="recensement",
    )
    op.create_index("ix_form_drafts_system", "form_drafts", ["system"], schema="recensement")
    op.create_index("ix_form_drafts_status", "form_drafts", ["status"], schema="recensement")
    op.create_index("ix_form_drafts_owner", "form_drafts", ["owner_user_id"], schema="recensement")
    op.create_index("ix_form_drafts_local_id", "form_drafts", ["local_id"], schema="recensement")
    op.create_index(
        "ix_form_drafts_province_ville",
        "form_drafts",
        ["province_id", "ville_id"],
        schema="recensement",
    )


def downgrade() -> None:
    op.drop_table("form_drafts", schema="recensement")
    op.drop_index("ix_users_ville_id", table_name="users", schema="identity")
    op.drop_index("ix_users_province_id", table_name="users", schema="identity")
    op.drop_constraint("fk_users_commune_id", "users", schema="identity", type_="foreignkey")
    op.drop_constraint("fk_users_ville_id", "users", schema="identity", type_="foreignkey")
    op.drop_constraint("fk_users_province_id", "users", schema="identity", type_="foreignkey")
    op.drop_column("users", "commune_id", schema="identity")
    op.drop_column("users", "ville_id", schema="identity")
    op.drop_column("users", "province_id", schema="identity")
