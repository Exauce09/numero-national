# Module 7 — Critères d’acceptation

| Critère | Statut | Preuve |
|---------|--------|--------|
| Générateur officiel désactivé | OK | flag False + 423 |
| Service central seul chemin | OK | `NationalIdentityNumberService` |
| Prérequis dossier / doublons | OK | codes `incomplete_dossier`, `open_duplicates` |
| Idempotence clé de demande | OK | `assign_with_request` |
| Catalogue anti-invention | OK | `/onip/nin/catalog` |
| Statut dossier | OK | `/onip/nin/status/{id}` |
| Exceptions sans mutation NIC | OK | `nic_mutated=False` |
| UI Module 7 | OK | `NicNumbersPage` |
| Pas de NIN client proposé | OK | contrat assign sans champ NIN |

## Tests

`pytest tests/test_module7_nin.py tests/test_nin_prerequisites.py tests/test_nin_compliance.py tests/test_onip_nin_routes.py -q`
