# Module 2 — Critères d’acceptation (livrable)

**Date :** 2026-10-25  
**Cahier :** `Module_2_Gestion_Personnes_Dossiers_ONIP_Detaille_FINAL.docx`

| Critère | Statut | Preuve |
|---------|--------|--------|
| Liste / recherche paginée + permissions | OK | `GET /api/v1/registry/citizens` + filtres status/province/commune/lieu |
| Fiche individuelle (onglets) | OK | `PopulationFgpPage` — Identité, Adresse, Contrôles, Historique |
| Création sans attribution NIN | OK | `POST /citizens` → DRAFT, `nic=null` ; UI explicite |
| Historisation modifications | OK | `CitizenHistory` + `GET /citizens/{id}/history` + motif `reason` |
| Doublons sans fusion auto | OK | `GET …/duplicates` + `POST /duplicates/{id}/resolve` (FALSE_POSITIVE / CONFIRMED) ; merge séparé |
| Soumission / transitions statut | OK | `POST …/submit`, `POST …/status` (refuse ACTIVE/MERGED) |
| Périmètre territorial | OK | force `province_code` si `territory_forced` sur Principal |
| Recherche similaires pré-création (RB-04) | OK | `GET /citizens/similar` |
| Documents / rectification workflow complet | Partiel | hors lot (lien documents existant ; rectif via motif history) |

## Endpoints Module 2 ajoutés / étendus

- `GET /registry/citizens` — filtres avancés + scope
- `GET /registry/citizens/similar`
- `GET /registry/citizens/{id}/history`
- `GET /registry/citizens/{id}/duplicates`
- `POST /registry/citizens/{id}/submit`
- `POST /registry/citizens/{id}/status`
- `POST /registry/citizens/{id}/addresses`
- `POST /registry/duplicates/{id}/resolve`

## Tests

`pytest tests/test_module2_dossiers.py`
