# Module état civil + IAM institutionnel

## Architecture

```
PERSONNEL → AFFECTATION (bureau/fonction) → COMPTE → RÔLE → PERMISSIONS → SCOPE TERRITORIAL
                                                                      ↓
                                                              AUDIT (append-only)

ÉTAT CIVIL: civil_acts (+ bureau_id, verification_code, soft delete, authentication payload)
            filiations / mentions / transcriptions / declarants / documents_justificatifs
            act_number_counters (séquence commune/année/type)
            correction_requests (inbox officier)
```

## Ce qui est de la **config administrative** (pas la loi)

Voir `apps/api/domains/civil_config/` :

- types d’actes activés à l’écriture ;
- motif de numérotation `{commune_code}/{year}/{seq:06d}` ;
- transitions de workflow.

Ne pas présenter ces valeurs comme obligations du Code de la famille sans source vérifiée.

## MVP opérationnel (couvert)

- Numérotation séquentielle par commune + année + type (`act_number_counters` + verrou advisory).
- Workflow `DRAFT → SUBMITTED → UNDER_REVIEW → VALIDATED` (+ cachet à la validation).
- Couplage Core Registry à la validation : naissance → création/lien citoyen ; décès → statut `DECEASED`.
- Recherche d’actes `GET /civil/acts/search` (périmètre bureau).
- Extrait officiel `GET /acts/{id}/extract` (QR, `verification_code`, mentions).
- Mentions marginales sur actes validés.
- Inbox corrections `GET /civil/corrections` + `POST …/review` (approuver / rejeter).
- UI civil-officer : listes API-first si JWT, workflow / impression bloquée avant `VALIDATED`, mentions, corrections.

Hors périmètre MVP (non certifié national) : archivage légal long terme, NIC automatique à la naissance, géolocalisation juridique complète, certification métier.

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
- `GET /acts/search?q=&type=&status=&commune=` — recherche scoped
- `POST /acts/{id}/transition` — machine d’états (+ cachet/signature officier à `VALIDATED`)
- `GET /acts/{id}/extract` — extrait officiel (acte + mentions + QR + conservation)
- `GET /acts/{id}/mentions`
- `DELETE /acts/{id}` — soft delete (interdit si VALIDATED)
- `POST /mentions`, `POST /filiations`, `POST /transcriptions`
- `GET /corrections`, `POST /corrections/{id}/review`
- `GET /persons/{citizen_id}/history`
- `POST /documents/verify` — public, réponse minimale (+ mentions_count, cachet)
- `GET /config`
- Écriture `DISPLACEMENT` / `CENSUS` / `RESIDENCE_ATTESTATION` **refusée** (modules futurs)
- Scope bureau : auto-affectation + refus 403 hors périmètre sur écritures / transitions / mentions / transcriptions

## Authentification d’acte (cachet)

À la validation, le payload reçoit un bloc `authentication` :

- `officer_id`, `officer_name`, `officer_matricule`
- `seal_ref`, `signature_ref`, `authenticated_at`, `act_version`

Affiché sur l’extrait UI (`ActPrintCard`) et contrôlé via `/documents/verify`.

## Rôles institutionnels (seed)

`SUPER_ADMIN_NATIONAL`, `ADMIN_NATIONAL`, `ADMIN_PROVINCIAL`, `RESPONSABLE_BUREAU`,
`OFFICIER_ETAT_CIVIL`, `AGENT_ETAT_CIVIL`, `AUDITEUR` (+ alias compat `CIVIL_OFFICER`).

Principe : **fonction + affectation active + rôle + scope** pour les opérations sensibles.
Pas d’auto-attribution de rôles privilégiés.

UI : boutons Valider / mentions / corrections masqués sans `civil:act:validate` (ou rôle officier / lead).

## UI civil-officer

- `/admin/bureaux`, `/admin/personnel`, `/admin/account-requests`
- `/transcriptions`, `/verify-document`, `/corrections`
- Sync API obligatoire pour naissances/mariages/divorces/décès/adoptions si JWT présent
  (QR / `verification_code` serveur réinjectés dans le registre local)
- Détail acte : workflow + extrait officiel + mentions (`ActWorkflowPanel`)

## Migrations

- `021_iam_personnel_bureaux`
- `022_etat_civil_juridique`
- `026_act_number_counters` — compteurs + champs revue corrections
- `027_act_number_unique_type` — unicité `(act_number, commune, act_type)` pour séquences par type

## Tests

`tests/test_iam_civil_institutional.py`
