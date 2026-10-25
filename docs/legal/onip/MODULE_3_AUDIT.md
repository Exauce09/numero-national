# Module 3 — Audit enrôlement (cahier FINAL)

**Source :** `Module_3_Enrolement_Population_ONIP_Detaille_FINAL.docx`  
**Date :** 2026-10-25  
**Principe :** réutiliser `recensement` (`/census`) ; pas de domaine `enrollment` dupliqué ; pas de NIN inventé ; pas de fusion auto.

| Fonction cahier | Statut | Preuve | Action Module 3 |
|-----------------|--------|--------|-----------------|
| Accueil enrôlement (compteurs) | partiel → OK | `EnrolementPage` + `CampaignStats` | page `/enrolement` |
| Campagnes / centres / équipes | terminé | `CampaignsPage`, CRUD `/census/campaigns` | — |
| Collecte biographique terrain | terminé | Flutter APK + `CensusPage` civil-officer | hors ONIP dashboard |
| Sync hors-ligne idempotente | terminé | `POST /census/sync/push|pull` | — |
| Brouillons / reprise | terminé | `form-drafts` | — |
| File contrôle approve/reject | terminé | routes records + UI | transitions `can_transition` |
| Promote FGP | terminé | `promote` + batch | UI lot sur `/enrolement` |
| Catalogue statuts plan | partiel → OK | `GET /enrollment-status-catalog` | enrichi + UI |
| Capture biométrique | partiel | `/biometric/enrollments` (après citizen) | hors lot NIN |
| Documents justificatifs | partiel | domaine documents | hors lot |
| Rendez-vous / reçus | absent | — | hors lot (à valider métier) |
| Permissions `enrollment.*` | absent | `census:sync` / `census:manage` | mapping documenté |
| Agent ↔ ZD HTTP | absent | modèle `AgentZdAssignment` | hors lot |

## Mapping statuts

Voir `apps/api/domains/recensement/enrollment_status.py` (`ENROLLMENT_STATUS_MAP`, `ALLOWED_TRANSITIONS`).
