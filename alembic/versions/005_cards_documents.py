"""Cards, digital identity, and documents (Phase 5).

Revision ID: 005_cards_documents
Revises: 004_etat_civil
Create Date: 2026-09-08
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_cards_documents"
down_revision: Union[str, None] = "004_etat_civil"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS cards")
    op.execute("CREATE SCHEMA IF NOT EXISTS documents")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        "national_cards",
        sa.Column(
            "card_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("serial_number", sa.String(64), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("replaced_by_id", postgresql.UUID(as_uuid=True), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["replaced_by_id"],
            ["cards.national_cards.card_id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("serial_number", name="uq_national_cards_serial"),
        schema="cards",
    )
    op.create_index(
        "ix_national_cards_citizen_id", "national_cards", ["citizen_id"], schema="cards"
    )
    op.create_index("ix_national_cards_status", "national_cards", ["status"], schema="cards")

    op.create_table(
        "card_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.ForeignKeyConstraint(
            ["card_id"],
            ["cards.national_cards.card_id"],
            ondelete="CASCADE",
        ),
        schema="cards",
    )
    op.create_index("ix_card_history_card_id", "card_history", ["card_id"], schema="cards")

    op.create_table(
        "digital_identities",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("citizen_id", name="uq_digital_identities_citizen"),
        schema="cards",
    )
    op.create_index(
        "ix_digital_identities_citizen_id",
        "digital_identities",
        ["citizen_id"],
        schema="cards",
    )

    op.create_table(
        "documents",
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="ISSUED"),
        sa.Column("content_hash", sa.String(128), nullable=False),
        sa.Column("signature", sa.Text(), nullable=False),
        sa.Column("qr_payload", postgresql.JSONB(), nullable=True),
        sa.Column("storage_uri", sa.String(512), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="documents",
    )
    op.create_index("ix_documents_type", "documents", ["type"], schema="documents")
    op.create_index(
        "ix_documents_institution_id", "documents", ["institution_id"], schema="documents"
    )
    op.create_index(
        "ix_documents_citizen_id", "documents", ["citizen_id"], schema="documents"
    )


def downgrade() -> None:
    op.drop_table("documents", schema="documents")
    op.drop_table("digital_identities", schema="cards")
    op.drop_table("card_history", schema="cards")
    op.drop_table("national_cards", schema="cards")
    op.execute("DROP SCHEMA IF EXISTS documents CASCADE")
