"""Core Registry + sectoral identity tokens.

Revision ID: 003_core_registry
Revises: 001_foundation
Create Date: 2026-09-08

Creates citizen registry tables (schema core_registry) and opaque sectoral
tokens (schema identity). NIC is system-attributed only.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003_core_registry"
down_revision: Union[str, None] = "002_iam"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pgcrypto for gen_random_uuid on older PG; no-op if already in core.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "citizens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("nic", sa.String(length=13), nullable=True),
        sa.Column("status", sa.String(length=32), server_default="DRAFT", nullable=False),
        sa.Column("sex", sa.String(length=16), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("place_of_birth", sa.String(length=255), nullable=True),
        sa.Column("nationality", sa.String(length=3), nullable=False),
        sa.Column("given_names", sa.String(length=255), nullable=False),
        sa.Column("family_name", sa.String(length=255), nullable=False),
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
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deceased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merged_into_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["merged_into_id"], ["core_registry.citizens.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nic"),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizens_nic",
        "citizens",
        ["nic"],
        unique=False,
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizens_status",
        "citizens",
        ["status"],
        unique=False,
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizens_name_dob",
        "citizens",
        ["family_name", "given_names", "date_of_birth"],
        unique=False,
        schema="core_registry",
    )

    op.create_table(
        "citizen_addresses",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("address_type", sa.String(length=32), nullable=False),
        sa.Column("line1", sa.String(length=255), nullable=False),
        sa.Column("line2", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("commune_code", sa.String(length=32), nullable=True),
        sa.Column("province_code", sa.String(length=32), nullable=True),
        sa.Column("country_code", sa.String(length=3), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(
            ["citizen_id"], ["core_registry.citizens.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizen_addresses_citizen_id",
        "citizen_addresses",
        ["citizen_id"],
        unique=False,
        schema="core_registry",
    )

    op.create_table(
        "family_relations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("related_citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("relation_type", sa.String(length=32), nullable=False),
        sa.Column("legal_basis", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["citizen_id"], ["core_registry.citizens.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["related_citizen_id"], ["core_registry.citizens.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "citizen_id",
            "related_citizen_id",
            "relation_type",
            name="uq_family_relation_pair_type",
        ),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_family_relations_citizen_id",
        "family_relations",
        ["citizen_id"],
        unique=False,
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_family_relations_related_citizen_id",
        "family_relations",
        ["related_citizen_id"],
        unique=False,
        schema="core_registry",
    )

    op.create_table(
        "citizen_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["citizen_id"], ["core_registry.citizens.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizen_history_citizen_id",
        "citizen_history",
        ["citizen_id"],
        unique=False,
        schema="core_registry",
    )

    op.create_table(
        "nic_issuance_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nic", sa.String(length=13), nullable=False),
        sa.Column(
            "issued_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("algorithm_version", sa.String(length=64), nullable=False),
        sa.Column(
            "actor_system",
            sa.String(length=64),
            server_default="CORE_REGISTRY",
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["citizen_id"], ["core_registry.citizens.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nic"),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_nic_issuance_log_citizen_id",
        "nic_issuance_log",
        ["citizen_id"],
        unique=False,
        schema="core_registry",
    )

    op.create_table(
        "duplicate_candidates",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_a_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("citizen_b_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="OPEN", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["citizen_a_id"], ["core_registry.citizens.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["citizen_b_id"], ["core_registry.citizens.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("citizen_a_id", "citizen_b_id", name="uq_duplicate_pair"),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_duplicate_candidates_status",
        "duplicate_candidates",
        ["status"],
        unique=False,
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_duplicate_candidates_citizen_a_id",
        "duplicate_candidates",
        ["citizen_a_id"],
        unique=False,
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_duplicate_candidates_citizen_b_id",
        "duplicate_candidates",
        ["citizen_b_id"],
        unique=False,
        schema="core_registry",
    )

    op.create_table(
        "identity_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sector", sa.String(length=32), nullable=False),
        sa.Column("token_value", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="ACTIVE", nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["citizen_id"], ["core_registry.citizens.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_value"),
        schema="identity",
    )
    op.create_index(
        "ix_identity_tokens_citizen_id",
        "identity_tokens",
        ["citizen_id"],
        unique=False,
        schema="identity",
    )
    op.create_index(
        "ix_identity_tokens_token_value",
        "identity_tokens",
        ["token_value"],
        unique=False,
        schema="identity",
    )
    op.create_index(
        "ix_identity_tokens_status",
        "identity_tokens",
        ["status"],
        unique=False,
        schema="identity",
    )
    op.create_index(
        "ix_identity_tokens_citizen_sector",
        "identity_tokens",
        ["citizen_id", "sector"],
        unique=False,
        schema="identity",
    )

    op.create_table(
        "token_usage_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("token_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["token_id"], ["identity.identity_tokens.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="identity",
    )
    op.create_index(
        "ix_identity_token_usage_log_token_id",
        "token_usage_log",
        ["token_id"],
        unique=False,
        schema="identity",
    )

    op.execute(
        """
        INSERT INTO identity.system_meta (key, value)
        VALUES ('schema_version', 'phase2-core-registry')
        ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        """
    )


def downgrade() -> None:
    op.drop_table("token_usage_log", schema="identity")
    op.drop_table("identity_tokens", schema="identity")
    op.drop_table("duplicate_candidates", schema="core_registry")
    op.drop_table("nic_issuance_log", schema="core_registry")
    op.drop_table("citizen_history", schema="core_registry")
    op.drop_table("family_relations", schema="core_registry")
    op.drop_table("citizen_addresses", schema="core_registry")
    op.drop_table("citizens", schema="core_registry")
    op.execute(
        """
        INSERT INTO identity.system_meta (key, value)
        VALUES ('schema_version', 'phase1-foundation')
        ON CONFLICT (key) DO UPDATE
            SET value = EXCLUDED.value,
                updated_at = NOW()
        """
    )
