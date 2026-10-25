# Module 5 — Audit FGP (cahier FINAL)

**Source :** `Module_5_FGP_ONIP_Cahier_des_charges_Detaille_FINAL.docx`  
**Date :** 2026-10-25  
**Principe :** façade `/fgp` sur `core_registry` ; pas de NIN inventé ; pas de fusion auto ; idempotence événements.

| Fonction cahier | Statut | Preuve |
|-----------------|--------|--------|
| Référentiel central personnes | OK | `core_registry.citizens` |
| Identifiant ≠ NIN | OK | UUID + NIC nullable |
| Recherche / consultation | OK | `/fgp/persons` (auditée) + `/registry` |
| Historique | OK | `CitizenHistory` + `/fgp/persons/{id}/history` |
| Doublons / merge contrôlé | OK | duplicates + merge UI |
| Ingestion événements idempotente | OK | `POST /fgp/events` |
| Rectification workflow | partiel → OK MVP | `POST /fgp/corrections` (demande, non auto-appliquée) |
| Filiation | partiel → OK | `family_relations` + API FGP |
| Santé FGP | OK | `GET /fgp/health` |
| Vérif partenaire minimale | OK | `POST /identity/verify` (existant) |
| Export dossier PII | hors lot | export agrégats Module 1 seulement |
| Provenance par champ | partiel | historique / événements sourcés |

## Règle NIN

`invent_nin_forbidden` / `OFFICIAL_NIN_FORMAT_CONFIRMED=False` — attribution uniquement via service NIN.
