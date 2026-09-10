# Schéma géospatial & ZD (écarts comblés)

Backend : **FastAPI + SQLAlchemy + Alembic + PostgreSQL/PostGIS**.

Ce document décrit uniquement ce qui manquait par rapport au besoin
Province → Territoire/Ville → Commune → Quartier/Village → ZD, citoyens GPS,
agents multi-ZD, historique de migration et index spatiaux. Le reste du
système (IAM/RBAC, NIC, biométrie, dédup démographique, campagnes de
recensement) existait déjà.

Migration : `alembic/versions/019_postgis_zd_geospatial.py`  
Image DB : `postgis/postgis:16-3.5-alpine` (`docker-compose.yml` + CI).

---

## Déjà en place (non recréé)

| Besoin | Emplacement |
|--------|-------------|
| Province, ville, commune, quartier, localité (village), voie | `geography.*` (`012`) |
| NIC + état civil + `status` citoyen | `core_registry.citizens` |
| Rôles agent / ministère / présidence | `identity.roles` |
| Empreintes / visage / iris (templates) | `biometric.*` (`007`) |
| Candidats doublons démographiques | `core_registry.duplicate_candidates` |
| Agents, équipes, fiches + horodatage | `recensement.*` |

---

## Diagramme conceptuel (relations ajoutées)

```text
geography.provinces
        ├── geography.villes ──────────────┐
        └── geography.territoires ─────────┤
                                           ▼
                              geography.communes
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
             geography.quartiers  geography.localites
                    │              │
                    └──────┬───────┘
                           ▼
              geography.enumeration_zones  (ZD)
                 geom MultiPolygon 4326
                 estimated_population
                           │
     ┌─────────────────────┼──────────────────────────┐
     ▼                     ▼                          ▼
core_registry.citizens   recensement.zones      recensement.agent_zd_assignments
 registration_zd_id       enumeration_zone_id     agent_user_id ↔ zd_id
 registration_location    geom / population       assigned_at / unassigned_at
 verification_status
     │
     ▼
core_registry.citizen_zd_memberships   (historique SCD2-like)
  valid_from / valid_to / reason

core_registry.duplicate_candidates
  match_method ∈ {DEMOGRAPHIC, BIOMETRIC, GEO_CIVIL}
  distance_meters, evidence

identity.roles (+ ZD_ADMIN)
```

Hiérarchie cible :

**Province → Territoire | Ville → Commune → Quartier | Village (localité) → ZD**

---

## SQL (extrait) — tables / colonnes nouvelles

Exécuté par Alembic `019`. Référence :

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

-- Territoire rural
CREATE TABLE geography.territoires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  province_id UUID NOT NULL REFERENCES geography.provinces(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (province_id, code)
);

-- ZD officielle
CREATE TABLE geography.enumeration_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  quartier_id UUID REFERENCES geography.quartiers(id),
  localite_id UUID REFERENCES geography.localites(id),
  estimated_population INTEGER,
  geom geometry(MultiPolygon, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (quartier_id IS NOT NULL OR localite_id IS NOT NULL)
);

-- Citoyen géolocalisé + vérification
ALTER TABLE core_registry.citizens
  ADD COLUMN registration_zd_id UUID REFERENCES geography.enumeration_zones(id),
  ADD COLUMN registration_location geography(Point, 4326),
  ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED';

-- Historique de ZD (déménagement sans perte)
CREATE TABLE core_registry.citizen_zd_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  citizen_id UUID NOT NULL REFERENCES core_registry.citizens(id) ON DELETE CASCADE,
  zd_id UUID NOT NULL REFERENCES geography.enumeration_zones(id) ON DELETE RESTRICT,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ,
  reason VARCHAR(64) NOT NULL DEFAULT 'REGISTRATION',
  recorded_by UUID,
  location geography(Point, 4326),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent multi-ZD
CREATE TABLE recensement.agent_zd_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_user_id UUID NOT NULL,
  zd_id UUID NOT NULL REFERENCES geography.enumeration_zones(id) ON DELETE CASCADE,
  role_label VARCHAR(64) NOT NULL DEFAULT 'CENSUS_AGENT',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  assigned_by UUID
);
```

Géométries : `geometry` pour polygones administratifs (affichage carte),
`geography` pour distances en mètres (GPS citoyen / ménage).

---

## Index spatiaux recommandés (inclus en 019)

| Index | Usage |
|-------|--------|
| `GIST (enumeration_zones.geom)` | ZD contenant un point ; intersection de polygones |
| `GIST (citizens.registration_location)` | Citoyens dans un rayon / dans une ZD |
| `GIST (households.location)` | Ménages proches / dans polygone |
| `GIST (citizen_zd_memberships.location)` | Audit GPS historique |
| `GIST (recensement.zones.geom)` | Zones de campagne vs ZD |

### Requêtes types

Citoyens dans un rayon de **X km** autour d’un point :

```sql
SELECT id, nic, given_names, family_name
FROM core_registry.citizens
WHERE registration_location IS NOT NULL
  AND ST_DWithin(
        registration_location,
        ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
        :radius_m   -- ex. 2000 pour 2 km
      );
```

Citoyens dans une ZD (polygone) :

```sql
SELECT c.id, c.nic
FROM core_registry.citizens c
JOIN geography.enumeration_zones z ON z.id = :zd_id
WHERE c.registration_location IS NOT NULL
  AND ST_Within(
        c.registration_location::geometry,
        z.geom
      );
```

Doublons **geo + civil** (proximité + identité) — à brancher côté service :

```sql
-- Exemple : candidats GEO_CIVIL à < 50 m + même année / sexe
SELECT a.id AS citizen_a, b.id AS citizen_b,
       ST_Distance(a.registration_location, b.registration_location) AS meters
FROM core_registry.citizens a
JOIN core_registry.citizens b ON a.id < b.id
WHERE a.sex = b.sex
  AND EXTRACT(YEAR FROM a.date_of_birth) = EXTRACT(YEAR FROM b.date_of_birth)
  AND ST_DWithin(a.registration_location, b.registration_location, 50);
```

---

## Contrôle d’accès (schéma)

| Rôle | Usage |
|------|--------|
| `CENSUS_AGENT` | Terrain Flutter |
| `ZD_ADMIN` | **nouveau** — admin d’une/plusieurs ZD |
| `CENSUS_SUPERVISOR` | Validation fiches |
| `MINISTRY_*` / `INTERIOR_VIEW` | Monitoring ministère |
| `PRESIDENCY_VIEW` | Monitoring présidence |
| `CENTRAL_ADMIN` / `ONIP_OPS` | Pilotage national |

Scopes géographiques utilisateur déjà présents : `identity.users.province_id` /
`ville_id` / `commune_id` (`016`).

---

## Évolutivité ZD

1. À l’enregistrement : créer `citizen_zd_memberships` (`reason=REGISTRATION`,
   `valid_to=NULL`) + renseigner `citizens.registration_zd_id` / `registration_location`.
2. Au déménagement : fermer la ligne ouverte (`valid_to=now()`), ouvrir une
   nouvelle membership, mettre à jour `registration_zd_id`, journaliser
   `citizen_history` avec `event_type=ZD_CHANGED`.
3. Le NIC et l’historique civil / biométrique restent inchangés.
