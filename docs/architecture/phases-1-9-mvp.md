# Phase overview — Système National d'Identité (Phases 1–9 MVP)

Monorepo modulaire FastAPI + Flutter recensement + React (citoyen / ONIP / institutions).

## Architecture

Monolithe modulaire (un process API) + schemas PostgreSQL par domaine.
Évite la complexité microservices prématurée tout en respectant la
séparation logique (cahier §8, §10).

## Domaines API (`apps/api/domains/`)

| Domaine | Schema PG | Responsabilité |
|---------|-----------|----------------|
| identity | identity | Users, institutions, RBAC, MFA |
| audit | audit | Journal append-only |
| interop | identity | Service clients, client-credentials |
| core_registry | core_registry | Citoyens, NIC, historique, fusion |
| token_service | identity | Tokens sectoriels (hashés) |
| recensement | recensement | Campagnes, sync offline |
| etat_civil | etat_civil | Actes, déclarations, résidence |
| cards | cards | Carte nationale, QR signé |
| documents | documents | Actes PDF / hash / signature |
| citizen_portal | — | API « moi » citoyen |
| biometric | biometric | Vault templates, dédup MVP |
| health | health | Établissements, notif naissance/décès |
| onip | — | Agrégats opérationnels |
| analytics | analytics | Métriques anonymisées, relying party |
| notifications | — | File de notifications |

## Règles respectées

- Un citoyen = une identité de référence (Core Registry)
- NIC opaque (crypto + Luhn), jamais saisi manuellement
- Institutions stockent citizen_reference / tokens, pas une copie d'identité
- QR minimal + HMAC (pas d'identité en clair)
- Biométrie hors table citizens
- Dashboards gov sur agrégats, pas sur PII
- Secrets via environnement uniquement

## Durcissement

Voir [`hardening.md`](hardening.md) — JWT, tokens hashés, audit append-only DB,
NIC anti-doublon, middleware, RBAC domain, clés séparables.

## Reste (prochaines itérations)

- ABIS biométrique réel
- IdP OAuth2/OIDC d'État
- Rate-limit Redis + refresh token store (jti)
- KMS/HSM
- Tests terrain Flutter
