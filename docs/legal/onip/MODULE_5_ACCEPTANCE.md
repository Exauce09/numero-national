# Module 5 — Critères d’acceptation

| Critère | Statut | Preuve |
|---------|--------|--------|
| Catalogue + règles NIN | OK | `GET /fgp/catalog` |
| Santé référentiel | OK | `GET /fgp/health` |
| Recherche / fiche auditées | OK | `FGP_SEARCH` / `FGP_PERSON_VIEW` |
| Événements idempotents | OK | `POST /fgp/events` |
| Rectification demandée | OK | `POST /fgp/corrections` |
| Filiation | OK | relations GET/POST |
| UI FGP enrichie | OK | `/population` santé + onglets |
| Pas de NIN inventé | OK | catalogue + pas d’attribution FGP |

## Tests

`pytest tests/test_module5_fgp.py -q`
