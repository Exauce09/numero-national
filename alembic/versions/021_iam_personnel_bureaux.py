"""IAM personnel, bureaux EC, assignments, scopes, account requests.

Revision ID: 021_iam_personnel_bureaux
Revises: 020_inst_geo_coupons
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "021_iam_personnel_bureaux"
down_revision: Union[str, None] = "020_inst_geo_coupons"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS etat_civil")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "bureaux_etat_civil",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("bureau_type", sa.String(32), nullable=False, server_default="PRINCIPAL"),
        sa.Column(
            "province_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geography.provinces.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "ville_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geography.villes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "commune_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geography.communes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("commune_code", sa.String(32), nullable=True),
        sa.Column("address", sa.String(512), nullable=True),
        sa.Column(
            "ressort",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("code", name="uq_bureaux_etat_civil_code"),
        schema="etat_civil",
    )
    op.create_index(
        "ix_bureaux_etat_civil_commune",
        "bureaux_etat_civil",
        ["commune_id"],
        schema="etat_civil",
    )
    op.create_index(
        "ix_bureaux_etat_civil_status",
        "bureaux_etat_civil",
        ["status"],
        schema="etat_civil",
    )

    op.create_table(
        "personnel",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("matricule", sa.String(64), nullable=False),
        sa.Column("family_name", sa.String(128), nullable=False),
        sa.Column("postnom", sa.String(128), nullable=True),
        sa.Column("given_names", sa.String(128), nullable=False),
        sa.Column("function_title", sa.String(128), nullable=True),
        sa.Column("phone_pro", sa.String(64), nullable=True),
        sa.Column("email_pro", sa.String(320), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("date_entree", sa.Date(), nullable=True),
        sa.Column("date_sortie", sa.Date(), nullable=True),
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
        sa.UniqueConstraint("matricule", name="uq_personnel_matricule"),
        schema="identity",
    )

    op.create_table(
        "assignments",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "personnel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.personnel.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "bureau_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.bureaux_etat_civil.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "province_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("geography.provinces.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("function_code", sa.String(64), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column(
            "assigned_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("document_reference", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="identity",
    )
    op.create_index(
        "ix_assignments_personnel",
        "assignments",
        ["personnel_id"],
        schema="identity",
    )
    op.create_index(
        "ix_assignments_bureau_status",
        "assignments",
        ["bureau_id", "status"],
        schema="identity",
    )

    op.create_table(
        "territorial_scopes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("scope_type", sa.String(32), nullable=False),
        sa.Column("territory_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "bureau_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.bureaux_etat_civil.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="identity",
    )
    op.create_index(
        "ix_territorial_scopes_user",
        "territorial_scopes",
        ["user_id"],
        schema="identity",
    )

    op.create_table(
        "account_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "personnel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.personnel.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "requested_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("requested_role", sa.String(64), nullable=False),
        sa.Column("requested_scope_type", sa.String(32), nullable=True),
        sa.Column("requested_bureau_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("requested_province_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="identity",
    )
    op.create_index(
        "ix_account_requests_status",
        "account_requests",
        ["status"],
        schema="identity",
    )

    op.add_column(
        "users",
        sa.Column(
            "personnel_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.personnel.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="identity",
    )
    op.add_column(
        "users",
        sa.Column("account_status", sa.String(32), nullable=False, server_default="ACTIVE"),
        schema="identity",
    )
    op.add_column(
        "users",
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        schema="identity",
    )
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        schema="identity",
    )
    op.execute(
        """
        UPDATE identity.users
        SET account_status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'DISABLED' END
        """
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at", schema="identity")
    op.drop_column("users", "disabled_at", schema="identity")
    op.drop_column("users", "account_status", schema="identity")
    op.drop_column("users", "personnel_id", schema="identity")
    op.drop_table("account_requests", schema="identity")
    op.drop_table("territorial_scopes", schema="identity")
    op.drop_table("assignments", schema="identity")
    op.drop_table("personnel", schema="identity")
    op.drop_table("bureaux_etat_civil", schema="etat_civil")
