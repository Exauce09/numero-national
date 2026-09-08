# Portail Citoyen (Phase 5)

Frontend minimal **React + Vite + TypeScript** pour le self-service citoyen.

## Pages (placeholders)

| Route | API cible |
|-------|-----------|
| `/identity` | `GET /api/v1/me/identity` |
| `/card` | `GET /api/v1/me/card`, `POST /api/v1/me/card/report-lost` |
| `/documents` | `GET /api/v1/me/documents` |
| `/access-log` | `GET /api/v1/me/access-log` |

Auth MVP côté API : header `X-Citizen-Id: <uuid>`.

## Démarrage

```bash
cd frontends/citizen-portal
npm install
npm run dev
```

Le proxy Vite renvoie `/api` vers `http://localhost:8000`.
