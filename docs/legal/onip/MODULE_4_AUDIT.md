# Module 4 — Audit recensement / campagnes (cahier)

**Source :** `Module_4_Recensement_Campagnes_ONIP_Detaille.docx`  
**Date :** 2026-10-25  
**Principe :** réutiliser `recensement` ; pas de NIN inventé ; sync idempotente ; pas de fusion auto.

| Fonction | Statut | Preuve | Action Module 4 |
|----------|--------|--------|-----------------|
| CRUD campagnes | terminé | `/census/campaigns` | + dates / description UI |
| Cycle de vie contrôlé | partiel → OK | `campaign_lifecycle.py` | transitions serveur |
| Sync si ACTIVE seulement | absent → OK | `sync_push` + `campaign_accepts_sync` | 409 sinon |
| Zones / équipes / affectations | terminé | routes existantes | + désactivation affectation |
| Stats campagne | partiel → OK | `CampaignStatsOut` enrichi | couverture, coupons, sync |
| Lots sync supervision | absent → OK | `GET …/sync-batches` + onglet UI | |
| Contrôle fiches + CONFLICT | partiel → OK | menu Contrôle | |
| Coupons format officiel | hors lot | `FieldCoupon` existant | ne pas inventer format |
| Doublons intercampagnes | partiel | CONFLICT + Anomalies | revue humaine |
| Agent↔ZD HTTP | hors lot | modèle seul | |

## Mapping cahier → enum

| Cahier | `CampaignStatus` |
|--------|------------------|
| BROUILLON / A_APPROUVER / PLANIFIEE | DRAFT |
| ACTIVE | ACTIVE |
| SUSPENDUE | PAUSED |
| EN_CLOTURE / CLOTUREE / ANNULEE | CLOSED |
