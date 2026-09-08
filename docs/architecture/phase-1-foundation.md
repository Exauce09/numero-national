# Phase 1 — Fondation architecture

## Objectif

Mettre en place une base technique propre, sécurisable et extensible pour le
Système National Intégré d'Identité, **sans** domaines métier (citoyens, NIC, etc.).

## Décisions retenues

1. **Monolithe modulaire** pour le MVP Phase 1  
   Un seul service FastAPI (`apps/api`) avec packages internes. Les frontières
   métiers arriveront ensuite (Core Registry, Audit, Token Service…).

2. **Séparation logique PostgreSQL via schemas**  
   Migration `001_foundation` crée les schemas : `identity`, `core_registry`,
   `audit`, `recensement`, `etat_civil`, `cards`, `biometric`, `health`,
   `analytics`. Aucune table citoyen.

3. **Configuration via environnement**  
   `pydantic-settings` + `.env`. Aucun secret dans le code source.

4. **Migrations Alembic obligatoires**  
   Aucune création de schéma « à la volée » en production.

5. **Healthcheck explicite**  
   `GET /health` vérifie API + PostgreSQL (utilisé par Docker HEALTHCHECK).

## Hors scope (phases suivantes)

- 1.6+ utilisateurs, institutions, RBAC, OAuth2/OIDC, MFA, audit applicatif
- Phase 2+ NIC, citoyens, Flutter, biométrie, état civil, cartes, analytics
