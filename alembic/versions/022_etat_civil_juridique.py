"""État civil juridique — filiation, mentions, transcriptions, enrichment actes.

Revision ID: 022_etat_civil_juridique
Revises: 021_iam_personnel_bureaux
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "022_etat_civil_juridique"
down_revision: Union[str, None] = "021_iam_personnel_bureaux"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "civil_acts",
        sa.Column(
            "bureau_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.bureaux_etat_civil.id", ondelete="SET NULL"),
            nullable=True,
        ),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("declaration_date", sa.Date(), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        schema="etat_civil",
    )
    op.add_column(
        "civil_acts",
        sa.Column("verification_code", sa.String(64), nullable=True),
        schema="etat_civil",
    )
    op.create_index(
        "ix_civil_acts_bureau",
        "civil_acts",
        ["bureau_id"],
        schema="etat_civil",
    )
    op.create_index(
        "ix_civil_acts_verification",
        "civil_acts",
        ["verification_code"],
        schema="etat_civil",
        unique=True,
    )

    op.create_table(
        "filiations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("parent_citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("child_citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("parent_label", sa.String(255), nullable=True),
        sa.Column("child_label", sa.String(255), nullable=True),
        sa.Column("relation_type", sa.String(32), nullable=False),
        sa.Column("source", sa.String(64), nullable=False, server_default="ACT"),
        sa.Column(
            "act_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_acts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="ACTIVE"),
        sa.Column("established_at", sa.Date(), nullable=True),
        sa.Column("ended_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        schema="etat_civil",
    )
    op.create_index("ix_filiations_child", "filiations", ["child_citizen_id"], schema="etat_civil")
    op.create_index("ix_filiations_parent", "filiations", ["parent_citizen_id"], schema="etat_civil")

    op.create_table(
        "mentions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "target_act_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_acts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mention_type", sa.String(64), nullable=False),
        sa.Column(
            "source_act_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_acts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("authority", sa.String(255), nullable=True),
        sa.Column("mention_date", sa.Date(), nullable=True),
        sa.Column("reference", sa.String(255), nullable=True),
        sa.Column("justificatif", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="etat_civil",
    )
    op.create_index("ix_mentions_target", "mentions", ["target_act_id"], schema="etat_civil")

    op.create_table(
        "transcriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("source_act_ref", sa.String(255), nullable=False),
        sa.Column("source_place", sa.String(255), nullable=True),
        sa.Column("source_authority", sa.String(255), nullable=True),
        sa.Column("source_date", sa.Date(), nullable=True),
        sa.Column("source_number", sa.String(128), nullable=True),
        sa.Column(
            "bureau_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.bureaux_etat_civil.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "resulting_act_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_acts.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="REGISTERED"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="etat_civil",
    )

    op.create_table(
        "declarants",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "act_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_acts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column(
            "declaration_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_declarations.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("relation_to_subject", sa.String(128), nullable=True),
        sa.Column("phone", sa.String(64), nullable=True),
        sa.Column("justificatif", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="etat_civil",
    )

    op.create_table(
        "documents_justificatifs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "act_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("etat_civil.civil_acts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("doc_type", sa.String(64), nullable=False),
        sa.Column("number", sa.String(128), nullable=True),
        sa.Column("issued_on", sa.Date(), nullable=True),
        sa.Column("issuer", sa.String(255), nullable=True),
        sa.Column("storage_key", sa.String(512), nullable=True),
        sa.Column("file_hash", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="DEPOSITED"),
        sa.Column("deposited_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "deposited_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        schema="etat_civil",
    )


def downgrade() -> None:
    op.drop_table("documents_justificatifs", schema="etat_civil")
    op.drop_table("declarants", schema="etat_civil")
    op.drop_table("transcriptions", schema="etat_civil")
    op.drop_table("mentions", schema="etat_civil")
    op.drop_table("filiations", schema="etat_civil")
    op.drop_index("ix_civil_acts_verification", table_name="civil_acts", schema="etat_civil")
    op.drop_index("ix_civil_acts_bureau", table_name="civil_acts", schema="etat_civil")
    for col in (
        "verification_code",
        "version",
        "deleted_at",
        "created_by",
        "archived_at",
        "registered_at",
        "declaration_date",
        "bureau_id",
    ):
        op.drop_column("civil_acts", col, schema="etat_civil")
