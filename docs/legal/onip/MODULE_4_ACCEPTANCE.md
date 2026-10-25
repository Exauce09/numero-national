# Module 4 — Critères d’acceptation

| Critère | Statut | Preuve |
|---------|--------|--------|
| Liste / création campagne (période, objectif) | OK | `CampaignsPage` + `CampaignCreate` |
| Transitions statut contrôlées | OK | `assert_campaign_transition` |
| Sync refusée hors ACTIVE | OK | `sync_push` → 409 |
| Zones / équipes / retrait agent | OK | `deactivate` assignment |
| Stats couverture + coupons + sync | OK | `CampaignStatsOut` |
| Supervision lots sync | OK | `/sync-batches` + onglet Sync |
| Pas de NIN inventé | OK | catalogue `offline_nin_forbidden` |
| CONFLICT dans file contrôle | OK | menu Contrôle |

## Tests

`pytest tests/test_module4_campaigns.py tests/test_census_sync.py -q`
