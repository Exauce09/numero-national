# E-GOUV — Modules gouvernementaux

React + Vite + TypeScript — quatre portails institutionnels (sidebar style e-gov).

```bash
cd frontends/gov-modules
npm install --legacy-peer-deps
npm run dev
```

URL d’accueil : http://localhost:5177/

| Portail | URL login | Identifiant | Mot de passe |
|---------|-----------|-------------|--------------|
| Santé | http://localhost:5177/sante/login | `sante` | `DemoSante2026!` |
| Intérieur | http://localhost:5177/interieur/login | `interieur` | `DemoInterieur2026!` |
| Présidence | http://localhost:5177/presidence/login | `presidence` | `DemoPresidence2026!` |
| Administration | http://localhost:5177/admin/login | `admin` | `Admin2026!` |

Proxy Vite : `/api` → `http://localhost:8000`.

Fonctionnalités :

- **Santé** — tableau de bord, indicateurs, structures, export anonymisé
- **Intérieur** — ONIP / overview, supervision état civil, cartes, audit, anomalies
- **Présidence** — KPI stratégiques, domaines, alertes, briefing JSON
- **Admin** — utilisateurs, rôles, institutions, audit paginé, rafraîchissement analytics + checklist
