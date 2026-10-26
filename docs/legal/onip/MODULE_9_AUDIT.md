# Module 9 — Audit Carte d’Identité Nationale (CIN)

**Source :** `Module_9_Carte_Identite_Nationale_CIN_ONIP_Detaille.docx`  
**Date :** 2026-10-26  
**Principes :** CIN n’invente pas de NIN ; gabarit prototype ≠ homologué ; lots bloqués si `template_approved=false` ; historique append-only.

| Fonction cahier | Statut | Preuve |
|-----------------|--------|--------|
| Admissibilité NIC + ACTIVE | OK | `assert_cin_eligibility` + `evaluate_cin_eligibility` |
| Demande structurée | OK MVP | `POST /cards/card-requests` + store |
| Idempotence demande | OK | `idempotency_key` |
| Catalogue règles | OK | `GET /cards/catalog` |
| Prévisualisation HTML | OK prototype | `IdCardRdc` + watermark APERÇU |
| MRZ / série officielle | hors lot | `official_mrz_forbidden` ; serial `CD-…` démo |
| Approuver production | OK bloqué | 423 `template_not_approved` |
| Lots production | OK stub bloqué | `POST /cards/production-batches` |
| Remise commune | OK | `deliver` + inbox |
| Perte / vol / révocation | OK | lost / stolen / revoke / lifecycle-events |
| Remplacement | OK | `replace_card` conserve l’ancienne |
| QR sans PII | OK | `qr.py` |
| Générateur NIN dans CIN | interdit | catalog + aucun appel assign |

## Hors lot

Gabarit homologué, MRZ/2D-Doc officiels, matériel d’impression certifié, tarifs, destruction légale formalisée, `OFFICIAL_NIN_FORMAT_CONFIRMED=True`.
