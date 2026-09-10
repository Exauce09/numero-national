"""Card delivery routing to commune.

Revision ID: 018_card_commune_delivery
Revises: 017_nic_14_rdc
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018_card_commune_delivery"
down_revision: Union[str, None] = "017_nic_14_rdc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "national_cards",
        sa.Column("commune_code", sa.String(length=64), nullable=True),
        schema="cards",
    )
    op.add_column(
        "national_cards",
        sa.Column("commune_name", sa.String(length=128), nullable=True),
        schema="cards",
    )
    op.add_column(
        "national_cards",
        sa.Column("delivery_address", sa.Text(), nullable=True),
        schema="cards",
    )
    op.add_column(
        "national_cards",
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
        schema="cards",
    )
    op.add_column(
        "national_cards",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        schema="cards",
    )
    op.create_index(
        "ix_national_cards_commune_code",
        "national_cards",
        ["commune_code"],
        schema="cards",
    )
    op.create_index(
        "ix_national_cards_status_commune",
        "national_cards",
        ["status", "commune_code"],
        schema="cards",
    )


def downgrade() -> None:
    op.drop_index("ix_national_cards_status_commune", table_name="national_cards", schema="cards")
    op.drop_index("ix_national_cards_commune_code", table_name="national_cards", schema="cards")
    op.drop_column("national_cards", "delivered_at", schema="cards")
    op.drop_column("national_cards", "dispatched_at", schema="cards")
    op.drop_column("national_cards", "delivery_address", schema="cards")
    op.drop_column("national_cards", "commune_name", schema="cards")
    op.drop_column("national_cards", "commune_code", schema="cards")
