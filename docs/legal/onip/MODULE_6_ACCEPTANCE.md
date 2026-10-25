# Module 6 — Critères d’acceptation

| Critère | Statut | Preuve |
|---------|--------|--------|
| Catalogue anti-fraude / anti-merge / anti-NIN | OK | `/biometric/catalog` |
| File matches avec contexte | OK | `source_citizen_id`, `enrollment_id` |
| Déblocage enrôlement après revue | OK | `review_match` → OPEN |
| File dédup sessions | OK | `/dedup/pending` + review |
| Legacy templates bloqué | OK | 409 sans ack |
| Pas de templates dans réponses | OK | `TemplateOut` / UI |
| UI Module 6 | OK | `BiometriePage` onglets |

## Tests

`pytest tests/test_module6_biometric.py tests/test_biometric_enrollment.py -q`
