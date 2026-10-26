# Module 9 — Critères d’acceptation

| Critère | Statut | Preuve |
|---------|--------|--------|
| Pas de NIN généré par CIN | OK | catalog + tests |
| Admissibilité sans NIC / non ACTIVE | OK | codes structurés |
| Demande + idempotence | OK | card-requests |
| Gabarit non homologué → pas de lot | OK | 423 template_not_approved |
| Aperçu marqué prototype | OK | IdCardRdc watermark |
| Vol / perte historisés | OK | report-stolen / lost |
| Remise existante préservée | OK | deliver commune |

## Tests

`pytest tests/test_module9_cards.py tests/test_cin_eligibility.py tests/test_cards_qr.py -q`
