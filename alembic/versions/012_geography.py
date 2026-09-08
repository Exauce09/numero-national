"""RDC geography schema + tables.

Revision ID: 012_geography
Revises: 011_refresh_sessions
"""

from typing import Sequence, Union

from alembic import op

revision: str = "012_geography"
down_revision: Union[str, None] = "011_refresh_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS geography")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.provinces (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(16) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL,
            chef_lieu VARCHAR(128) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.districts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            province_id UUID NOT NULL REFERENCES geography.provinces(id) ON DELETE CASCADE,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(128) NOT NULL,
            UNIQUE (province_id, code)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.villes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            province_id UUID NOT NULL REFERENCES geography.provinces(id) ON DELETE CASCADE,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(128) NOT NULL,
            is_chef_lieu BOOLEAN NOT NULL DEFAULT FALSE,
            UNIQUE (province_id, code)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.communes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            ville_id UUID NOT NULL REFERENCES geography.villes(id) ON DELETE CASCADE,
            district_id UUID NULL REFERENCES geography.districts(id) ON DELETE SET NULL,
            code VARCHAR(32) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.quartiers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            commune_id UUID NOT NULL REFERENCES geography.communes(id) ON DELETE CASCADE,
            code VARCHAR(48) NOT NULL,
            name VARCHAR(128) NOT NULL,
            UNIQUE (commune_id, code)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.localites (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            district_id UUID NULL REFERENCES geography.districts(id) ON DELETE SET NULL,
            commune_id UUID NULL REFERENCES geography.communes(id) ON DELETE SET NULL,
            code VARCHAR(48) NOT NULL UNIQUE,
            name VARCHAR(128) NOT NULL
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.voies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            quartier_id UUID NOT NULL REFERENCES geography.quartiers(id) ON DELETE CASCADE,
            code VARCHAR(64) NOT NULL,
            name VARCHAR(128) NOT NULL,
            voie_type VARCHAR(16) NOT NULL,
            UNIQUE (quartier_id, code)
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS geography.voies CASCADE")
    op.execute("DROP TABLE IF EXISTS geography.localites CASCADE")
    op.execute("DROP TABLE IF EXISTS geography.quartiers CASCADE")
    op.execute("DROP TABLE IF EXISTS geography.communes CASCADE")
    op.execute("DROP TABLE IF EXISTS geography.villes CASCADE")
    op.execute("DROP TABLE IF EXISTS geography.districts CASCADE")
    op.execute("DROP TABLE IF EXISTS geography.provinces CASCADE")
    op.execute("DROP SCHEMA IF EXISTS geography CASCADE")
