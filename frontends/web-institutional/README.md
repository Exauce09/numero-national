# Web institutionnel — multi-portail (Phase 9)

Coquille React + Vite + TypeScript pour :

- **État civil** (`/civil`) — saisie / suivi actes (API Phase 4)
- **Ministère — stats** (`/ministry`) — agrégats via `/api/v1/gov/ministry/overview`
- **Présidence / Primature / Intérieur** (`/gov/:org/:domain`) — tableaux stratégiques sans PII

## Démarrage

```bash
cd frontends/web-institutional
npm install
npm run dev
```

Proxy Vite : `/api` → `http://localhost:8000`.

## Politique données

Les portails gouvernementaux consomment uniquement `AggregateMetric`
(`POST /api/v1/analytics/refresh` puis `GET /api/v1/gov/...`). Aucun dossier
citoyen complet n’est exposé côté relying party (`POST /api/v1/identity/verify`
retourne `{verified, status, claims}` seulement).
