"""Citizen FGP identity fields (décret 22/07 art. 8) — postnom, filiation, etc.

Revision ID: 028_citizen_fgp_identity_fields
Revises: 027_act_number_unique_type
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "028_citizen_fgp_identity_fields"
down_revision: Union[str, None] = "027_act_number_unique_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "citizens",
        sa.Column("post_name", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("other_names", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("birth_certificate_number", sa.String(length=128), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("height_cm", sa.Float(), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("eye_color", sa.String(length=64), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("occupation", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("marital_status", sa.String(length=32), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("phone", sa.String(length=64), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("email", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("origin_province", sa.String(length=128), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("origin_territory", sa.String(length=128), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("origin_secteur", sa.String(length=128), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("origin_groupement", sa.String(length=128), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("origin_localite", sa.String(length=128), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("father_full_name", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("father_occupation", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("father_nationality", sa.String(length=3), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("mother_full_name", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("mother_occupation", sa.String(length=255), nullable=True),
        schema="core_registry",
    )
    op.add_column(
        "citizens",
        sa.Column("mother_nationality", sa.String(length=3), nullable=True),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizens_post_name",
        "citizens",
        ["post_name"],
        schema="core_registry",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_core_registry_citizens_post_name",
        table_name="citizens",
        schema="core_registry",
    )
    for col in (
        "mother_nationality",
        "mother_occupation",
        "mother_full_name",
        "father_nationality",
        "father_occupation",
        "father_full_name",
        "origin_localite",
        "origin_groupement",
        "origin_secteur",
        "origin_territory",
        "origin_province",
        "email",
        "phone",
        "marital_status",
        "occupation",
        "eye_color",
        "height_cm",
        "birth_certificate_number",
        "other_names",
        "post_name",
    ):
        op.drop_column("citizens", col, schema="core_registry")
