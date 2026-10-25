# Module 1 — critères d’acceptation (cahier §14)

**Commit de référence :** Module 1 complet (périmètre + export + KPI)  
**Permission :** `onip:dashboard` obligatoire sur tous les endpoints dashboard.

| ID | Scénario | Statut implémentation |
|----|----------|----------------------|
| DASH-001 | Ouverture avec rôle autorisé | OK — KPI + meta + fraîcheur |
| DASH-002 | Sans droit module | OK — 403 `require_permissions` |
| DASH-003 | Filtre province uniforme | OK — mêmes filtres sur widgets |
| DASH-004 | Forcer province non autorisée | OK — `scope.enforce_dashboard_filters` 403 |
| DASH-005 | Période sans donnée | OK — `empty` + message UI |
| DASH-006 | Dénominateur nul | OK — taux `null` → N/A |
| DASH-007 | Clic doublons | OK — drill-down `/anomalies` |
| DASH-008 | Carte produite ≠ remise | OK — KPI séparés + expired |
| DASH-009 | Sonde absente | OK — état `unknown` |
| DASH-010 | Erreur partielle widget | OK — `widgetErrors` UI |
| DASH-011 | Export non habilité | OK — permission + audit `onip.dashboard.export` |
| DASH-012 | Rafraîchir | OK — bouton Appliquer / presets |
| DASH-013 | Comparaison période | Partiel — presets 1/7/30 ; delta % non affiché |
| DASH-014 | Mobile | OK — grille responsive + filtres repliables |
| DASH-015 | Logs sans secrets | OK — audit filtres agrégés seulement |

## Endpoints

- `GET /api/v1/onip/dashboard`
- `GET /api/v1/onip/dashboard/trends`
- `GET /api/v1/onip/dashboard/territories`
- `GET /api/v1/onip/dashboard/alerts`
- `GET /api/v1/onip/dashboard/health`
- `GET /api/v1/onip/dashboard/export` (CSV agrégats, audité)

## Hors scope volontaire

- Attribution NIN / fusion / production CIN depuis KPI
- Affichage nominatif / NIN complet / biométrie
