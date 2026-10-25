# Matrice permissions ONIP (Lot 4)

**Date :** 2026-10-25  
**Source codes :** `apps/api/core/permissions.py`, seed `identity/seed.py`

| Opération | Permission | Rôle typique | MFA |
|-----------|------------|--------------|-----|
| Tableau de bord / carte / ops | `onip:dashboard` | ONIP_OPS | recommandé |
| Lecture registre | `registry:citizen:read` | ONIP_OPS | — |
| Validation + NIC provisoire | `registry:citizen:validate` | ONIP_OPS | **sensible** |
| Fusion dossiers | `registry:citizen:merge` | admin / ONIP | **sensible** |
| Override doublons | `registry:citizen:validate_override` | élevé | **sensible** |
| Enrollment biométrie | `biometric:enroll` | agent bio | **sensible** |
| Match 1:N | `biometric:match` | ONIP bio | **sensible** |
| Revue humaine match | `biometric:review` | ONIP bio | **sensible** |
| Campagnes / promote | `census:manage` (+ validate si NIC) | superviseur | — |
| Sync terrain | `census:sync` | agent terrain | — |
| Lecture EC | `civil:act:read` | ONIP / civil | — |
| Validation EC | `civil:act:validate` | officier | recommandé |
| Émission CIN | `cards:issue` | production | recommandé |
| Gestion CIN | `cards:manage` | ONIP | — |
| Verify partenaire | `identity:verify` | RELYING_PARTY | — |
| Audit lecture | `audit:read` | admin | — |
| Admin technique | `onip:dashboard` (pas d’accès métier auto) | ops | — |

## Séparation des pouvoirs

- Admin technique ≠ validation identité ≠ biométrie ≠ attribution NIN ≠ fusion.
- `FORCE_MFA_SENSITIVE=true` : refuse les ops sensibles si MFA non activé.
- Endpoint signalement : `GET /api/v1/onip/security/mfa-policy`.

## Verify partenaire

- `POST /api/v1/identity/verify` exige `identity:verify`.
- Réponse minimale : `verified`, `identity_status` / `status`, `claims` filtrés.
- Jamais dossier complet, adresses, biométrie, documents.
