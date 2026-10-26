"""Citizen person_kind: NEWBORN vs ADULT (bébé / parent).

Revision ID: 029_citizen_person_kind
Revises: 028_citizen_fgp_identity_fields
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "029_citizen_person_kind"
down_revision: Union[str, None] = "028_citizen_fgp_identity_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "citizens",
        sa.Column(
            "person_kind",
            sa.String(length=16),
            nullable=False,
            server_default="ADULT",
        ),
        schema="core_registry",
    )
    op.create_index(
        "ix_core_registry_citizens_person_kind",
        "citizens",
        ["person_kind"],
        schema="core_registry",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_core_registry_citizens_person_kind",
        table_name="citizens",
        schema="core_registry",
    )
    op.drop_column("citizens", "person_kind", schema="core_registry")
