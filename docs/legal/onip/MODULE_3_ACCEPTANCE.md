# Module 3 — Critères d’acceptation (livrable)

**Date :** 2026-10-25  
**Cahier :** `Module_3_Enrolement_Population_ONIP_Detaille_FINAL.docx`

| Critère | Statut | Preuve |
|---------|--------|--------|
| Accueil enrôlement (compteurs / files) | OK | `frontends/onip-dashboard` `/enrolement` |
| Catalogue statuts + NIN offline interdit | OK | `GET /census/enrollment-status-catalog` |
| Transitions serveur contrôlées | OK | `assert_transition` dans approve / reject / promote |
| Contrôle approve / reject / promote | OK | API + UI Enrôlement |
| Promote lot | OK | `POST /census/campaigns/{id}/promote` + bouton UI |
| Sync terrain existante | OK | `/census/sync/*` (non régressé) |
| Pas de NIN inventé par le module | OK | `offline_nin_forbidden` ; NIC seulement via `assign_nic` + service central |
| Pas de fusion auto | OK | `auto_merge_forbidden` ; doublons → CONFLICT / revue |
| Documents / RDV / reçus | Partiel / hors lot | — |

## Tests

`pytest tests/test_enrollment_status.py tests/test_module3_enrolement.py`
