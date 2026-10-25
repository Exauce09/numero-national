# Module 6 — Audit biométrie / déduplication

**Source :** `Module_6_Biometrie_Deduplication_ONIP_Detaille_FINAL.docx`  
**Date :** 2026-10-26  
**Principes :** pas de NIN inventé ; pas de fusion auto ; pas de fraude auto ; pas de templates bruts en API/UI.

| Fonction | Statut | Preuve |
|----------|--------|--------|
| Enrôlement 3 doigts + qualité | OK | `/enrollments` + capture |
| 1:N avant stockage | OK | `capture_finger` |
| Revue matches | OK enrichi | pending + source/enrollment + déblocage |
| Sessions dédup | partiel → OK | `GET /dedup/pending` + `POST …/review` |
| Catalogue règles | OK | `GET /biometric/catalog` |
| Legacy /templates sans 1:N | risque → OK | 409 sans `skip_dedup_ack` |
| ABIS certifié | hors lot | LocalHashProvider démo |
| Visage / multi-modal | hors lot | enum seulement |
| Matériel serveur | hors lot | bridge client ZK |

## Hors lot

Moteur ABIS production, gouvernance seuils write, device registry HTTP.
