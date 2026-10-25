# Module 8 — Audit interconnexion état civil

**Source :** `Module_8_Interconnexion_Etat_Civil_ONIP_Detaille.docx`  
**Date :** 2026-10-26  
**Principes :** EC = source juridique ; FGP = consommateur ; message ≠ acte appliqué ; idempotence ; pas de last-message-wins ; pas de NIN inventé ; pas de conversion recensement→acte.

| Fonction cahier | Statut | Preuve |
|-----------------|--------|--------|
| Registre interne actes EC | OK (préexistant) | `/civil/*` `etat_civil` |
| Référentiel sources | OK MVP | `AUTHORIZED_SOURCES` + catalog |
| Réception idempotente | OK | `POST /civil-events` + `source_event_id` |
| Accusé ≠ APPLIED | OK | `technical_ack` / `business_applied` |
| Conflit payload même clé | OK | `QUARANTINED` |
| Source inconnue / révoquée | OK | 403 |
| Rapprochement ambigu | OK | `MATCH_REVIEW` + matching cases |
| Décision revue | OK stub | `POST /civil-matching-cases/{id}/decision` |
| File conflits ONIP | OK corrigé | `list_civil_conflicts` (justification + inbound) |
| Pas de NIC inventé à la création d'acte | OK | `create_act` sans `generate_candidate_nic` |
| Catalogue règles | OK | `GET /civil-events/catalog` |
| UI supervision | OK | `EtatCivilOnipPage` |
| Connecteur EC externe production | hors lot | sources démo |
| Vérification acte juridique distante | hors lot | |

## Hors lot

Certificats sources production, connecteurs officiels, application auto FGP sans revue, générateur NIN officiel.
