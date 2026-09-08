"""IAM foundation — identity + audit tables.

Revision ID: 002_iam
Revises: 001_foundation
Create Date: 2026-09-08

Creates users, institutions, RBAC, service clients (identity schema)
and append-only audit events (audit schema).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_iam"
down_revision: Union[str, None] = "001_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

institution_type = postgresql.ENUM(
    "MINISTRY",
    "COMMUNE",
    "HOSPITAL",
    "ONIP",
    "PRESIDENCY",
    "PRIMATURE",
    "ORGANIZATION",
    "RELYING_PARTY",
    "OTHER",
    name="institution_type",
    schema="identity",
    create_type=False,
)

institution_status = postgresql.ENUM(
    "ACTIVE",
    "INACTIVE",
    "SUSPENDED",
    name="institution_status",
    schema="identity",
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE identity.institution_type AS ENUM (
                'MINISTRY', 'COMMUNE', 'HOSPITAL', 'ONIP', 'PRESIDENCY',
                'PRIMATURE', 'ORGANIZATION', 'RELYING_PARTY', 'OTHER'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE identity.institution_status AS ENUM (
                'ACTIVE', 'INACTIVE', 'SUSPENDED'
            );
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    op.create_table(
        "institutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", institution_type, nullable=False),
        sa.Column(
            "status",
            institution_status,
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.UniqueConstraint("code", name="uq_institutions_code"),
        schema="identity",
    )

    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("resource", sa.String(length=128), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.UniqueConstraint("code", name="uq_permissions_code"),
        schema="identity",
    )

    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.UniqueConstraint("code", name="uq_roles_code"),
        schema="identity",
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mfa_secret", sa.Text(), nullable=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["institution_id"],
            ["identity.institutions.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
        schema="identity",
    )

    op.create_table(
        "role_permissions",
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("permission_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["role_id"], ["identity.roles.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["permission_id"], ["identity.permissions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("role_id", "permission_id"),
        schema="identity",
    )

    op.create_table(
        "user_roles",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["identity.users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["role_id"], ["identity.roles.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
        schema="identity",
    )

    op.create_table(
        "service_clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("client_id", sa.String(length=128), nullable=False),
        sa.Column("client_secret_hash", sa.String(length=255), nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "scopes",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["institution_id"],
            ["identity.institutions.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("client_id", name="uq_service_clients_client_id"),
        schema="identity",
    )

    op.create_table(
        "events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("resource_type", sa.String(length=128), nullable=True),
        sa.Column("resource_id", sa.String(length=128), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("device", sa.String(length=512), nullable=True),
        sa.Column("result", sa.String(length=32), nullable=False, server_default="success"),
        sa.Column("old_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("new_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
            nullable=False,
        ),
        schema="audit",
    )
    op.create_index(
        "ix_audit_events_created_at",
        "events",
        ["created_at"],
        schema="audit",
    )
    op.create_index(
        "ix_audit_events_action",
        "events",
        ["action"],
        schema="audit",
    )

    op.execute(
        """
        INSERT INTO identity.system_meta (key, value)
        VALUES ('schema_version', 'phase1-iam')
        ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        """
    )


def downgrade() -> None:
    op.drop_index("ix_audit_events_action", table_name="events", schema="audit")
    op.drop_index("ix_audit_events_created_at", table_name="events", schema="audit")
    op.drop_table("events", schema="audit")
    op.drop_table("service_clients", schema="identity")
    op.drop_table("user_roles", schema="identity")
    op.drop_table("role_permissions", schema="identity")
    op.drop_table("users", schema="identity")
    op.drop_table("roles", schema="identity")
    op.drop_table("permissions", schema="identity")
    op.drop_table("institutions", schema="identity")
    op.execute("DROP TYPE IF EXISTS identity.institution_status")
    op.execute("DROP TYPE IF EXISTS identity.institution_type")
    op.execute(
        """
        INSERT INTO identity.system_meta (key, value)
        VALUES ('schema_version', 'phase1-foundation')
        ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        """
    )
