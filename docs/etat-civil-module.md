# Module état civil + IAM institutionnel

## Architecture

```
PERSONNEL → AFFECTATION (bureau/fonction) → COMPTE → RÔLE → PERMISSIONS → SCOPE TERRITORIAL
                                                                      ↓
                                                              AUDIT (append-only)

ÉTAT CIVIL: civil_acts (+ bureau_id, verification_code, soft delete)
            filiations / mentions / transcriptions / declarants / documents_justificatifs
```

## Ce qui est de la **config administrative** (pas la loi)

Voir `apps/api/domains/civil_config/` :

- types d’actes activés à l’écriture ;
- motif de numérotation ;
- transitions de workflow.

Ne pas présenter ces valeurs comme obligations du Code de la famille sans source vérifiée.

## API principales

### IAM — `/api/v1/iam`

- `POST/GET /personnel`, `PATCH /personnel/{id}`
- `POST/GET /bureaux`, `PATCH /bureaux/{id}`
- `POST/GET /assignments`, `POST /assignments/{id}/close`
- `POST /scopes`, `GET /scopes/{user_id}`
- `POST/GET /account-requests`, `…/approve`, `…/reject`
- `POST /users/{id}/activate|suspend|disable`
- `GET /bureaux/{id}/access-check`

### État civil — `/api/v1/civil`

- Actes typés (births, marriages, divorces, deaths, …)
- `POST /acts/{id}/transition` — machine d’états
- `DELETE /acts/{id}` — soft delete (interdit si VALIDATED)
- `POST /mentions`, `POST /filiations`
- `GET /persons/{citizen_id}/history`
- `POST /documents/verify` — public, réponse minimale
- `GET /config`
- Écriture `DISPLACEMENT` / `CENSUS` / `RESIDENCE_ATTESTATION` **refusée** (modules futurs)

## Rôles institutionnels (seed)

`SUPER_ADMIN_NATIONAL`, `ADMIN_NATIONAL`, `ADMIN_PROVINCIAL`, `RESPONSABLE_BUREAU`,
`OFFICIER_ETAT_CIVIL`, `AGENT_ETAT_CIVIL`, `AUDITEUR` (+ alias compat `CIVIL_OFFICER`).

Principe : **fonction + affectation active + rôle + scope** pour les opérations sensibles.
Pas d’auto-attribution de rôles privilégiés.

## UI civil-officer

- `/admin/bureaux`, `/admin/personnel`, `/admin/account-requests`
- `/verify-document`
- Sync API obligatoire pour naissances/mariages/divorces/décès/adoptions si JWT présent

## Migrations

- `021_iam_personnel_bureaux`
- `022_etat_civil_juridique`

## Tests

`tests/test_iam_civil_institutional.py`
