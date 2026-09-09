# Système National Intégré d'Identité et de Gestion de la Population

Infrastructure numérique d'État autour du **NIC** (Numéro d'Identification Citoyen).

**Dépôt GitHub :** [https://github.com/Exauce09/numero-national](https://github.com/Exauce09/numero-national)

CI : GitHub Actions (pytest + Postgres + Redis) sur chaque push `main`.

> **Phases livrées : 1 → 9 (domaine) + ops + frontends e-gov**  
> Fondation · IAM · Core Registry · Recensement Flutter · État civil · Cartes ·  
> Biométrie · ONIP · Santé · Analytics · **Géographie RDC · Portail officier commune** ·  
> Redis rate-limit · refresh rotation · CI

### Sync Git automatique

Chaque commit pousse vers `origin` via le hook `.githooks/post-commit`  
(installé localement dans `.git/hooks`). Cursor rappelle aussi un commit+push
en fin de session agent (`.cursor/hooks` + règle `auto-push-github`).

```bash
# Sur un nouveau clone, réactiver le hook local :
copy .githooks\post-commit .git\hooks\post-commit   # Windows
# cp .githooks/post-commit .git/hooks/post-commit   # Linux/macOS
```

---

## Phases implémentées

| Phase | Contenu | Emplacement principal |
|-------|---------|------------------------|
| 1 | Fondation API, PostgreSQL, Docker, `/health` | `apps/api`, `alembic/001` |
| 1.6–1.17 | IAM, OAuth/MFA, audit, interop | `domains/identity`, `audit`, `interop` |
| 2 | Core Registry + NIC + tokens sectoriels | `domains/core_registry`, `token_service` |
| 3 | Flutter recensement offline-first + sync API | `apps/flutter_recensement`, `domains/recensement`, `006` |
| 4 | État civil | `domains/etat_civil`, `004` |
| 5 | Cartes / QR / Digital ID / portail citoyen | `domains/cards`, `documents`, `citizen_portal`, `005` |
| 6 | Biométrie (vault + stubs ABIS) | `domains/biometric`, `007` |
| 7 | Dashboard ONIP | `domains/onip`, `frontends/onip-dashboard` |
| 8 | Santé (schéma confidentiel) | `domains/health`, `008` |
| 9 | Analytics agrégés, gov portals, relying party, notifications | `domains/analytics`, `notifications`, `009`, `frontends/web-institutional` |
| Geo | Cascade province → ville → commune → quartier → voie (seed RDC) | `domains/geography`, `alembic/012` |
| UI | Portail officier d’état civil (style E-GOUV / Justicia) | `frontends/civil-officer` |

---

## Arborescence

```text
.
├── apps/
│   ├── api/                      # FastAPI national
│   │   ├── main.py
│   │   ├── api/v1_router.py      # Agrège tous les domaines
│   │   ├── core/
│   │   ├── db/
│   │   └── domains/              # identity, registry, geography, …
│   └── flutter_recensement/      # App terrain offline-first (Phase 3)
├── frontends/
│   ├── civil-officer/            # Officier d’état civil — commune (port 5176)
│   ├── onip-dashboard/           # React Vite ONIP (port 5173)
│   ├── web-institutional/        # Multi-portail État (port 5174)
│   ├── citizen-portal/           # Portail citoyen (port 5175)
│   ├── gov-modules/              # Modules ministériels (port 5177)
│   └── shared/                   # CSS e-gov partagé (egouv.css)
├── alembic/versions/             # 001 … 012
├── scripts/
├── tests/
├── docs/architecture/
├── docker-compose.yml
└── README.md
```

| Dossier / fichier | Rôle |
|-------------------|------|
| `apps/api` | API HTTP nationale multi-domaines |
| `apps/api/domains` | Modules métier (schemas PostgreSQL séparés) |
| `apps/api/domains/geography` | Référentiel territorial RDC + seed + anti-doublon |
| `apps/api/api/v1_router.py` | Montage unique `/api/v1/*` |
| `apps/flutter_recensement` | Agents recensement offline-first |
| `frontends/civil-officer` | Console commune : actes, population, manage-* |
| `frontends/onip-dashboard` | Console ONIP |
| `frontends/web-institutional` | État civil + stats ministères + gov |
| `frontends/citizen-portal` | Portail citoyen |
| `frontends/gov-modules` | Modules Présidence / Intérieur / Santé / Admin |
| `alembic/` | Migrations 001–012 |

---

## Prérequis

- Python **3.11+** (sous Windows : lanceur `py`)
- Node.js **18+** (frontends Vite)
- Docker & Docker Compose (**recommandé** pour API + PostgreSQL)
- ou PostgreSQL 16 local si Docker n’est pas disponible

Sans PostgreSQL joignable, `GET /health` répond `503` avec `"database": "down"`
(l’API reste démarrable ; les tests acceptent ce cas).

---

## Démarrage rapide (Docker — recommandé)

```bash
# 1. Configuration
cp .env.example .env
# Éditer .env : remplacer SECRET_KEY et POSTGRES_PASSWORD

# 2. Lancer API + PostgreSQL
docker compose up --build -d

# 3. Vérifier la santé
curl http://localhost:8000/health
```

Réponse attendue :

```json
{
  "status": "ok",
  "api": "up",
  "database": "up"
}
```

Documentation interactive (hors production) : [http://localhost:8000/docs](http://localhost:8000/docs)

Arrêt :

```bash
docker compose down
```

---

## Démarrage local (sans Docker pour l'API)

```bash
# 1. Environnement Python
# Windows :
py -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS :
# python3 -m venv .venv && source .venv/bin/activate

# 2. Dépendances
pip install -e ".[dev]"

# 3. Configuration
cp .env.example .env

# 4. PostgreSQL (Docker DB seule, si Docker est installé)
docker compose up -d db

# 5. Migrations (nécessite PostgreSQL joignable)
alembic upgrade head

# 6. API
uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Frontends (Vite)

| Application | Dossier | Port | Lancer |
|-------------|---------|------|--------|
| Officier d’état civil | `frontends/civil-officer` | **5176** | `npm run dev` |
| ONIP | `frontends/onip-dashboard` | 5173 | `npm run dev` |
| Web institutionnel | `frontends/web-institutional` | 5174 | `npm run dev` |
| Portail citoyen | `frontends/citizen-portal` | 5175 | `npm run dev` |
| Modules gov | `frontends/gov-modules` | 5177 | `npm run dev` |

### Portail officier d’état civil (principal)

Console commune style [E-GOUV Justicia](https://www.justicia.website/egouv/COMMUNE/) : tableau de bord cliquable, pages **manage-*** (liste / recherche / export / détail), formulaires d’enregistrement, géographie cascade, thème clair/sombre.

```bash
cd frontends/civil-officer
npm install
npm run dev
```

- URL : [http://localhost:5176/](http://localhost:5176/)
- Démo : utilisateur `officier` / mot de passe `DemoCivil2026!`

| Zone | Routes |
|------|--------|
| Tableau de bord | `/` — cartes → population, nouveaux-nés, manage actes |
| Listes manage | `/manage/naissance`, `/manage/deces`, `/manage/mariage`, `/manage/divorce`, `/manage/adoption`, `/manage/deplacement`, `/manage/document` |
| Création d’actes | `/births`, `/deaths`, `/marriages`, … (bouton **+ Ajouter**) |
| Population / N-nés | `/population`, `/newborns` |
| Territoire | `/territory` |
| Actes / Recherche | `/acts`, `/search` |

Les données d’actes sont persistées en `localStorage` ; les appels API (`/api` → proxy Vite vers `localhost:8000`) sont optionnels (échec silencieux en démo).

Ouvrir dans Edge (Windows) :

```powershell
Start-Process msedge http://localhost:5176/
```

---

## Migrations

```bash
# Appliquer
alembic upgrade head

# Historique
alembic history

# Nouvelle migration (phases suivantes)
alembic revision -m "description" --autogenerate
```

La migration `001_foundation` crée les **schemas PostgreSQL** logiques
(`identity`, `core_registry`, `audit`, …) et une table technique
`identity.system_meta`. La géographie RDC est dans `012_geography`
(seed via `POST /api/v1/geo/seed?force=true`).

---

## Tests

```bash
# Avec PostgreSQL joignable (idéal) :
pytest -q

# Les tests /health acceptent 200 (DB up) ou 503 (DB down),
# et vérifient toujours la forme du JSON et api=up.
```

---

## Sécurité (Phase 1)

- Aucun secret dans le code source
- `.env` ignoré par Git (voir `.gitignore`)
- Utiliser `.env.example` comme modèle uniquement
- Remplacer `SECRET_KEY` et `POSTGRES_PASSWORD` avant tout déploiement

Les briques OAuth2 / OIDC / MFA / RBAC / audit sont livrées en Phase 1.6+ (voir table ci-dessus).

Le mot de passe démo du portail officier (`DemoCivil2026!`) est **uniquement** pour le développement local.

---

## Endpoints clés (Phases 3, 6–9 + géo)

| Méthode | Chemin | Domaine |
|---------|--------|---------|
| CRUD | `/api/v1/census/campaigns` | Recensement |
| POST | `/api/v1/census/sync/push` / `pull` | Sync offline |
| POST | `/api/v1/biometric/verify` / `identify` | Biométrie (stub ABIS) |
| GET | `/api/v1/onip/dashboard` | ONIP |
| POST | `/api/v1/health/births/declare` / `deaths/declare` | Santé → état civil |
| GET / POST | `/api/v1/analytics/*` | Agrégats sans PII |
| GET | `/api/v1/gov/{org}/{domain}` | Portails gouvernementaux |
| POST | `/api/v1/identity/verify` | Relying party (`verified`, `status`, `claims` only) |
| GET / POST | `/api/v1/geo/*` | Géographie RDC (cascade + seed + create) |

---

## Licence / usage

Infrastructure critique d'État — développement phase par phase, sécurité et
intégrité prioritaires sur la vitesse de livraison.
