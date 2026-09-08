# Portail Officier d'état civil (E-GOUV Commune)

React + Vite + TypeScript — registre local + menu latéral style e-gov.

```bash
cd frontends/civil-officer
npm install --legacy-peer-deps
npm run dev
```

URL : http://localhost:5176/login

Identifiants démo : `officier` / `DemoCivil2026!`

## Menus

- Tableau de bord
- Naissances
- Recensement
- Décès
- Mariages
- Adoption
- Déplacement
- Divorce
- Documents
- Actes
- Recherche

Les données sont persistées dans `localStorage` (`nn_civil_registry_v1`). Chaque acte tente aussi un `POST /api/v1/civil/{endpoint}` (commune `KIN-GOMBE`) ; l’échec API est ignoré.
