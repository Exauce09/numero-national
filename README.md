# Système National Intégré d'Identité et de Gestion de la Population

Infrastructure numérique d'État autour du **NIC** (Numéro d'Identification Citoyen).

**Dépôt GitHub :** [https://github.com/Exauce09/numero-national](https://github.com/Exauce09/numero-national)

CI : GitHub Actions (pytest + Postgres + Redis) sur chaque push `main`.

> **Phases livrées : 1 → 9 (domaine) + ops + frontends e-gov**  
> Fondation · IAM · Core Registry · Recensement Flutter · État civil · Cartes ·  
> Biométrie · ONIP · Santé · Analytics · **Géographie RDC · Portails institutionnels** ·  
> Redis rate-limit · refresh rotation · CI

### Données

Les portails **Présidence**, **Primature**, **Intérieur** et **Santé** démarrent **sans données fictives**.  
Les tableaux sont vides jusqu’à saisie réelle (formulaires locaux) ou branchement API PostgreSQL.

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
| 9 | Analytics agrégés, gov portals, relying party, notifications | `domains/analytics`, `notifications`, `009` |
| Geo | Cascade province → territoire/ville → commune → quartier/village → ZD (PostGIS) | `domains/geography`, `alembic/012`–`020` |
| UI | Portails E-GOUV (ONIP, Présidence, Primature, Intérieur, Santé, citoyen, état civil) | `frontends/*` |

---

## Arborescence

```text
.
├── apps/
│   ├── api/                      # FastAPI national
│   │   ├── main.py
│   │   ├── api/v1_router.py
│   │   ├── core/
│   │   ├── db/
│   │   └── domains/
│   └── flutter_recensement/      # App terrain offline-first
├── frontends/
│   ├── onip-dashboard/           # ONIP (port 5183)
│   ├── web-institutional/        # Présidence (port 5174)
│   ├── citizen-portal/           # Citoyen (port 5175)
│   ├── civil-officer/            # État civil commune (port 5176)
│   ├── gov-modules/              # Hub Santé / Admin (port 5177)
│   ├── web-interior/             # Intérieur (port 5178)
│   ├── web-primature/            # Primature (port 5179)
│   └── shared/                   # CSS e-gov partagé
├── alembic/versions/             # 001 … 020
├── scripts/
├── tests/
├── docs/
├── docker-compose.yml
└── README.md
```

---

## Prérequis

- Python **3.11+** (Windows : `py`)
- Node.js **18+**
- PostgreSQL **16+** local (recommandé sous Windows si Docker Desktop indisponible) **ou** Docker Compose
- Extension **PostGIS** (superutilisateur : `CREATE EXTENSION postgis;`)

Sans PostgreSQL joignable, `GET /health` répond `503` avec `"database": "down"`.

---

## Démarrage API (Windows natif — recommandé)

```powershell
# Racine du repo
copy .env.example .env
# POSTGRES_HOST=localhost, POSTGRES_PORT=5433 (ou 5432), ALLOW_OPEN_REGISTRATION=true

# PostGIS (une fois, en superuser postgres) :
# psql -U postgres -d nic_core -c "CREATE EXTENSION IF NOT EXISTS postgis;"

.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\uvicorn.exe apps.api.main:app --host 127.0.0.1 --port 8000

# Seed comptes recensement (API démarrée) :
.\.venv\Scripts\python.exe scripts\seed_census_agent.py
```

Health attendu : `http://127.0.0.1:8000/health` → `"status":"ok","database":"up"`.

Docs OpenAPI : [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Docker (si disponible)

```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:8000/health
```

---

## Frontends (Vite)

| Application | Dossier | Port | URL |
|-------------|---------|------|-----|
| **ONIP** | `frontends/onip-dashboard` | **5183** | http://127.0.0.1:5183/login |
| Présidence | `frontends/web-institutional` | 5174 | http://localhost:5174/ |
| Citoyen | `frontends/citizen-portal` | 5175 | http://localhost:5175/ |
| État civil | `frontends/civil-officer` | 5176 | http://localhost:5176/ |
| **Gov / Santé** | `frontends/gov-modules` | **5177** | http://localhost:5177/ |
| Intérieur | `frontends/web-interior` | 5178 | http://localhost:5178/ |
| Primature | `frontends/web-primature` | 5179 | http://localhost:5179/ |

> **ONIP** n’utilise plus le port 5173 : utilisez **5183** (ou une fenêtre InPrivate).

### Lancer un frontend

Les `node_modules` peuvent être partagés via junction vers `D:\egouv-shared-deps\node_modules` si le disque C: est saturé.

```powershell
cd frontends\gov-modules
npm run dev
# → http://localhost:5177/
```

Ouvrir tous les portails dans Edge :

```powershell
@(
  'http://127.0.0.1:5183/login',
  'http://localhost:5174/',
  'http://localhost:5175/',
  'http://localhost:5176/',
  'http://localhost:5177/',
  'http://localhost:5178/',
  'http://localhost:5179/'
) | ForEach-Object { Start-Process msedge $_ }
```

### Portail gov-modules (5177)

Page d’accueil : choix Santé / Admin (+ liens vers Présidence, Intérieur, Primature).  
Santé : tableaux **vides** par défaut ; formulaire d’ajout de structures ; proxy `/api` → `localhost:8000`.

### ONIP (5183)

Connexion **API uniquement** (JWT). Exemple après seed :

- Email : `admin.recensement@example.gov`
- Mot de passe : `CensusAdmin123!`

Aucune session démo hors API.

---

## Migrations

```bash
alembic upgrade head
alembic history
```

Versions actuelles : `001` … `020` (PostGIS / ZD / comptes géo / coupons terrain).

Seed géographie : `POST /api/v1/geo/seed?force=true` (API authentifiée admin).

---

## Tests

```bash
pytest -q
```

Les tests `/health` acceptent `200` (DB up) ou `503` (DB down).

---

## Sécurité

- Aucun secret dans le code source ; `.env` ignoré par Git
- Utiliser `.env.example` comme modèle
- Remplacer `SECRET_KEY` et `POSTGRES_PASSWORD` avant déploiement
- En production : `ALLOW_OPEN_REGISTRATION=false`, `ALLOW_DEV_AUTH_HEADERS=false`

---

## Endpoints clés

| Méthode | Chemin | Domaine |
|---------|--------|---------|
| POST | `/api/v1/auth/login` | IAM |
| CRUD | `/api/v1/census/campaigns` | Recensement |
| POST | `/api/v1/census/sync/push` / `pull` | Sync offline |
| POST | `/api/v1/biometric/verify` / `identify` | Biométrie |
| GET | `/api/v1/onip/dashboard` | ONIP |
| POST | `/api/v1/health/births/declare` / `deaths/declare` | Santé |
| GET / POST | `/api/v1/analytics/*` | Agrégats |
| GET | `/api/v1/gov/{org}/{domain}` | Portails gov |
| GET / POST | `/api/v1/geo/*` | Géographie RDC |

---

## Licence / usage

Infrastructure critique d'État — développement phase par phase, sécurité et
intégrité prioritaires sur la vitesse de livraison.
