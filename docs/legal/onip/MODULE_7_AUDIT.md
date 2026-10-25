# Module 7 — Audit attribution / gestion du NIN

**Source :** `Module_7_Attribution_Gestion_NIN_ONIP_Detaille.docx`  
**Date :** 2026-10-26  
**Principes :** service central unique ; pas de NIN inventé ; générateur officiel **bloqué** (`OFFICIAL_NIN_FORMAT_CONFIRMED=False`) ; idempotence ; exceptions audit-only.

| Fonction cahier | Statut | Preuve |
|-----------------|--------|--------|
| Service central unique | OK | `NationalIdentityNumberService` |
| Prérequis / éligibilité | OK | `assert_provisional_prerequisites` + `evaluate_eligibility` + `GET …/status` |
| Attribution provisoire | OK | `assign_provisional_nic` / `POST /onip/nin/assign` |
| Générateur officiel | bloqué (hors lot) | `assign_official_nin` → `OfficialNinFormatUnresolvedError` / 423 |
| Unicité base | OK | `Citizen.nic` unique + `NicIssuanceLog.nic` unique |
| Idempotence citoyen | OK | `already_assigned` si NIC présent |
| Idempotence requête | OK enrichi | `idempotency_key` + `NIN_ALLOCATION` history |
| Catalogue règles | OK | `GET /onip/nin/catalog` |
| Statut national-id | OK | `GET /onip/nin/status/{id}` |
| Historique émission | OK | `GET /onip/nin/issuance-log` |
| Exceptions (collision, merge, décès…) | OK stub | `GET|POST /onip/nin/exceptions` + decision — **ne mute pas** `Citizen.nic` |
| UI supervision | OK | `NicNumbersPage` `/nic` |
| Frontend / mobile générateur | interdit | pas de CTA officiel ; `client_proposed_nin_forbidden` |

## Hors lot (Phase 4 cahier)

- Longueur / positions / clé de contrôle officielle
- Activation `OFFICIAL_NIN_FORMAT_CONFIRMED=True`
- Conversion automatique provisoire → officiel
- Mutation / réattribution NIN sur fusion ou correction (procédure officielle requise)

## Décisions bloquantes restantes

Voir `AUDIT_CONFORMITE_FGP_NIN.md` et cahier §2.2 (annexe ONIP incohérente en ligne).
