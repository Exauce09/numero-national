# Module 8 — Critères d’acceptation

| Critère | Statut | Preuve |
|---------|--------|--------|
| Sources documentées | OK | catalog `authorized_sources` |
| États distincts reçu / appliqué | OK | `processing_status` + flags |
| Idempotence `source_event_id` | OK | replay → `already_processed` |
| Payload conflict → quarantaine | OK | pas d’écrasement |
| Ambigu → MATCH_REVIEW | OK | pas de création irréversible |
| Pas de NIN client | OK | rejet payload `nin`/`nic` |
| Pas de NIC inventé sur DRAFT | OK | `create_act` |
| UI Module 8 | OK | `/etat-civil` |

## Tests

`pytest tests/test_module8_civil_interconnect.py tests/test_civil_onip_scenarios.py -q`
