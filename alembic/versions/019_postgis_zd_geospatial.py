"""PostGIS + ZD + citizen GPS/membership + agent↔ZD (gaps only).

Already present elsewhere (not recreated here):
- Province / ville / commune / quartier / localité / voie
- Citizens NIC + civil fields + status
- RBAC roles (agent, ministry, presidency, …)
- Biometric templates + demographic duplicate_candidates
- Census campaigns / teams / agent_assignments / census_records timestamps

Revision ID: 019_postgis_zd_geospatial
Revises: 018_card_commune_delivery
"""

from typing import Sequence, Union

from alembic import op

revision: str = "019_postgis_zd_geospatial"
down_revision: Union[str, None] = "018_card_commune_delivery"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # --- Territoire (niveau rural manquant ; villes existent déjà) ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.territoires (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            province_id UUID NOT NULL
                REFERENCES geography.provinces(id) ON DELETE CASCADE,
            code VARCHAR(32) NOT NULL,
            name VARCHAR(128) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_territoire_province_code UNIQUE (province_id, code)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_territoires_province "
        "ON geography.territoires (province_id)"
    )

    op.execute(
        """
        ALTER TABLE geography.communes
            ADD COLUMN IF NOT EXISTS territoire_id UUID
            REFERENCES geography.territoires(id) ON DELETE SET NULL
        """
    )
    op.execute(
        """
        ALTER TABLE geography.localites
            ADD COLUMN IF NOT EXISTS territoire_id UUID
            REFERENCES geography.territoires(id) ON DELETE SET NULL
        """
    )

    # --- Zones de dénombrement (ZD) officielles ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS geography.enumeration_zones (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(64) NOT NULL,
            name VARCHAR(255) NOT NULL,
            quartier_id UUID
                REFERENCES geography.quartiers(id) ON DELETE SET NULL,
            localite_id UUID
                REFERENCES geography.localites(id) ON DELETE SET NULL,
            estimated_population INTEGER,
            geom geometry(MultiPolygon, 4326),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_enumeration_zone_code UNIQUE (code),
            CONSTRAINT ck_zd_parent CHECK (
                quartier_id IS NOT NULL OR localite_id IS NOT NULL
            )
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_enumeration_zones_quartier "
        "ON geography.enumeration_zones (quartier_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_enumeration_zones_localite "
        "ON geography.enumeration_zones (localite_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_enumeration_zones_geom "
        "ON geography.enumeration_zones USING GIST (geom)"
    )

    # --- Citoyen : ZD d'enregistrement + GPS + statut de vérification ---
    op.execute(
        """
        ALTER TABLE core_registry.citizens
            ADD COLUMN IF NOT EXISTS registration_zd_id UUID
                REFERENCES geography.enumeration_zones(id) ON DELETE SET NULL
        """
    )
    op.execute(
        """
        ALTER TABLE core_registry.citizens
            ADD COLUMN IF NOT EXISTS registration_location geography(Point, 4326)
        """
    )
    op.execute(
        """
        ALTER TABLE core_registry.citizens
            ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32)
                NOT NULL DEFAULT 'UNVERIFIED'
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizens_registration_zd "
        "ON core_registry.citizens (registration_zd_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizens_verification_status "
        "ON core_registry.citizens (verification_status)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizens_registration_location "
        "ON core_registry.citizens USING GIST (registration_location)"
    )

    # Historique ZD (déménagement / migration sans perte)
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS core_registry.citizen_zd_memberships (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            citizen_id UUID NOT NULL
                REFERENCES core_registry.citizens(id) ON DELETE CASCADE,
            zd_id UUID NOT NULL
                REFERENCES geography.enumeration_zones(id) ON DELETE RESTRICT,
            valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
            valid_to TIMESTAMPTZ,
            reason VARCHAR(64) NOT NULL DEFAULT 'REGISTRATION',
            recorded_by UUID,
            location geography(Point, 4326),
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizen_zd_memberships_citizen "
        "ON core_registry.citizen_zd_memberships (citizen_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizen_zd_memberships_zd "
        "ON core_registry.citizen_zd_memberships (zd_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizen_zd_memberships_open "
        "ON core_registry.citizen_zd_memberships (citizen_id) "
        "WHERE valid_to IS NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_citizen_zd_memberships_location "
        "ON core_registry.citizen_zd_memberships USING GIST (location)"
    )

    # --- Agent ↔ ZD (multi-ZD, historique) ---
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS recensement.agent_zd_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_user_id UUID NOT NULL,
            zd_id UUID NOT NULL
                REFERENCES geography.enumeration_zones(id) ON DELETE CASCADE,
            role_label VARCHAR(64) NOT NULL DEFAULT 'CENSUS_AGENT',
            active BOOLEAN NOT NULL DEFAULT TRUE,
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            unassigned_at TIMESTAMPTZ,
            assigned_by UUID,
            CONSTRAINT uq_agent_zd_active UNIQUE (agent_user_id, zd_id, assigned_at)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_agent_zd_assignments_agent "
        "ON recensement.agent_zd_assignments (agent_user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_agent_zd_assignments_zd "
        "ON recensement.agent_zd_assignments (zd_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_agent_zd_assignments_active "
        "ON recensement.agent_zd_assignments (agent_user_id, zd_id) "
        "WHERE active = TRUE"
    )

    # Campagne zones → ZD officielle + polygone / population
    op.execute(
        """
        ALTER TABLE recensement.zones
            ADD COLUMN IF NOT EXISTS enumeration_zone_id UUID
                REFERENCES geography.enumeration_zones(id) ON DELETE SET NULL
        """
    )
    op.execute(
        """
        ALTER TABLE recensement.zones
            ADD COLUMN IF NOT EXISTS estimated_population INTEGER
        """
    )
    op.execute(
        """
        ALTER TABLE recensement.zones
            ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326)
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recensement_zones_zd "
        "ON recensement.zones (enumeration_zone_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_recensement_zones_geom "
        "ON recensement.zones USING GIST (geom)"
    )

    # Ménages : point PostGIS (en plus de lat/lon float)
    op.execute(
        """
        ALTER TABLE recensement.households
            ADD COLUMN IF NOT EXISTS location geography(Point, 4326)
        """
    )
    op.execute(
        """
        UPDATE recensement.households
        SET location = ST_SetSRID(
            ST_MakePoint(longitude, latitude), 4326
        )::geography
        WHERE latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND location IS NULL
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_households_location "
        "ON recensement.households USING GIST (location)"
    )

    # Dédup : typologie biométrie / geo+civil (tables biométriques déjà en 007)
    op.execute(
        """
        ALTER TABLE core_registry.duplicate_candidates
            ADD COLUMN IF NOT EXISTS match_method VARCHAR(32)
                NOT NULL DEFAULT 'DEMOGRAPHIC'
        """
    )
    op.execute(
        """
        ALTER TABLE core_registry.duplicate_candidates
            ADD COLUMN IF NOT EXISTS distance_meters DOUBLE PRECISION
        """
    )
    op.execute(
        """
        ALTER TABLE core_registry.duplicate_candidates
            ADD COLUMN IF NOT EXISTS evidence JSONB
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_duplicate_candidates_method "
        "ON core_registry.duplicate_candidates (match_method)"
    )

    # Rôle administrateur ZD (ministère / présidence existent déjà)
    op.execute(
        """
        INSERT INTO identity.roles (id, code, name, description)
        SELECT gen_random_uuid(), 'ZD_ADMIN', 'Administrateur ZD',
               'Administration d''une ou plusieurs zones de dénombrement'
        WHERE NOT EXISTS (
            SELECT 1 FROM identity.roles WHERE code = 'ZD_ADMIN'
        )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM identity.roles WHERE code = 'ZD_ADMIN'")
    op.execute("ALTER TABLE core_registry.duplicate_candidates DROP COLUMN IF EXISTS evidence")
    op.execute(
        "ALTER TABLE core_registry.duplicate_candidates DROP COLUMN IF EXISTS distance_meters"
    )
    op.execute(
        "ALTER TABLE core_registry.duplicate_candidates DROP COLUMN IF EXISTS match_method"
    )
    op.execute("ALTER TABLE recensement.households DROP COLUMN IF EXISTS location")
    op.execute("ALTER TABLE recensement.zones DROP COLUMN IF EXISTS geom")
    op.execute("ALTER TABLE recensement.zones DROP COLUMN IF EXISTS estimated_population")
    op.execute("ALTER TABLE recensement.zones DROP COLUMN IF EXISTS enumeration_zone_id")
    op.execute("DROP TABLE IF EXISTS recensement.agent_zd_assignments")
    op.execute("DROP TABLE IF EXISTS core_registry.citizen_zd_memberships")
    op.execute("ALTER TABLE core_registry.citizens DROP COLUMN IF EXISTS verification_status")
    op.execute("ALTER TABLE core_registry.citizens DROP COLUMN IF EXISTS registration_location")
    op.execute("ALTER TABLE core_registry.citizens DROP COLUMN IF EXISTS registration_zd_id")
    op.execute("DROP TABLE IF EXISTS geography.enumeration_zones")
    op.execute("ALTER TABLE geography.localites DROP COLUMN IF EXISTS territoire_id")
    op.execute("ALTER TABLE geography.communes DROP COLUMN IF EXISTS territoire_id")
    op.execute("DROP TABLE IF EXISTS geography.territoires")
