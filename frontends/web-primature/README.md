# E-GOUV — Primature

Portail institutionnel (même logique que la Présidence) en **lecture seule** des données du système qui concernent la coordination gouvernementale.

## Démarrage

```bash
cd frontends/web-primature
npm install
npm run dev
```

> Si le disque est saturé, réutiliser les deps d’un autre frontend :
> `mklink /J node_modules ..\web-interior\node_modules` puis `npx vite`.

Ouvrir : http://localhost:5179/login

**Démo :** `primature` / `DemoPrimature2026!`

## Menus

| Route | Contenu |
|-------|---------|
| `/` | Tableau de bord consolidé + graphiques |
| `/ministeres` | État des ministères / modules du système |
| `/indicateurs` | Indicateurs transversaux (civil, santé, intérieur, ONIP) |
| `/dossiers` | Dossiers de coordination Primature |
| `/alertes` | Alertes remontées par les modules |
| `/briefing` | Briefing exécutif consolidé |
| `/systeme` | Cartographie des portails E-GOUV (lecture) |

Exports : **CSV · Excel · PDF · Imprimer · SQL**.

## Portails liés

| Portail | URL |
|---------|-----|
| Présidence | http://localhost:5174 |
| Primature | http://localhost:5179 |
| Intérieur | http://localhost:5178 |
| Santé (gov) | http://localhost:5177/sante |
| État civil | http://localhost:5176 |
| Citoyen | http://localhost:5175 |
| ONIP | http://localhost:5173 |