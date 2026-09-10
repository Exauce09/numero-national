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
| `/synoptique` | Synoptique Primature (coordination, domaines, dossiers, alertes) |
| `/ministeres` | État des ministères / modules du système |
| `/indicateurs` | Indicateurs transversaux (civil, santé, intérieur, ONIP) |
| `/dossiers` | Dossiers de coordination Primature |
| `/alertes` | Alertes remontées par les modules |
| `/briefing` | Briefing exécutif consolidé |

Exports : **CSV · Excel · PDF · Imprimer · SQL**.
