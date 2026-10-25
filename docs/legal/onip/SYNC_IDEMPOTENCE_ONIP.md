# Synchronisation terrain — idempotence (Lot 5)

## Flux

1. Appareil crée un `local_id` / batch id stable.
2. `POST /api/v1/census/sync/push` — permission `census:sync`.
3. Serveur vérifie auth, format, **idempotence** (rejeu → pas de doublon fiche).
4. Accusé : accepté / rejeté avec motif ; conflits → `CONFLICT`.
5. Promote FGP : `POST …/records/{id}/promote` retourne `already_promoted=true` si déjà lié.

## Interdictions

- **Aucun NIN / NIC définitif généré offline.**
- Attribution uniquement via `NationalIdentityNumberService` après validation centrale.
- Format officiel bloqué jusqu’à annexe signée.

## Indicateurs ops

`GET /api/v1/onip/ops-health` → `queues.sync_batches_pending`, biométrie, corrections EC.

## Tests

- `tests/test_census_sync.py`
- `tests/test_census_promote.py` (idempotence promote)
- `tests/test_enrollment_status.py`
