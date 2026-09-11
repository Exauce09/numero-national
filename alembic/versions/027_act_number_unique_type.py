"""Relax act_number uniqueness to include act_type (per-type sequences).

Revision ID: 027_act_number_unique_type
Revises: 026_act_number_counters
"""

from typing import Sequence, Union

from alembic import op

revision: str = "027_act_number_unique_type"
down_revision: Union[str, None] = "026_act_number_counters"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_civil_acts_number_commune",
        "civil_acts",
        schema="etat_civil",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_civil_acts_number_commune_type",
        "civil_acts",
        ["act_number", "commune_code", "act_type"],
        schema="etat_civil",
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_civil_acts_number_commune_type",
        "civil_acts",
        schema="etat_civil",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_civil_acts_number_commune",
        "civil_acts",
        ["act_number", "commune_code"],
        schema="etat_civil",
    )
