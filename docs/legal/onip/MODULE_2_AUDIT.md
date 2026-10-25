# Module 2 — Audit personnes / dossiers (cahier FINAL)

**Source :** `Module_2_Gestion_Personnes_Dossiers_ONIP_Detaille_FINAL.docx`  
**Date :** 2026-10-25  
**Principe :** réutiliser `core_registry` ; pas de NIN inventé ; pas de fusion auto.

| Fonction | Statut | Preuve | Action Module 2 |
|----------|--------|--------|-----------------|
| Identifiant interne UUID | terminé | `citizens.id` | — |
| Liste / recherche | partiel | `GET /registry/citizens` | + filtres statut/province/lieu |
| Fiche détail | partiel | `GET /citizens/{id}` | + historique, doublons, onglets UI |
| Création brouillon sans NIC | terminé | `POST /citizens` | garde-fou UI |
| Mise à jour pré-validation | partiel | `PATCH` + history | motif optionnel |
| Historique | partiel | `CitizenHistory` | endpoint dédié |
| Doublons démographiques | partiel | `DuplicateCandidate` | liste + résolution (pas merge auto) |
| Fusion contrôlée | partiel | `POST /citizens/merge` | UI lien + permission merge |
| Documents pièces | partiel | domaine documents | hors lot (lien ultérieur) |
| Rectification workflow | absent/partiel | history UPDATED | demande via motif history |
| Périmètre territorial | partiel | Principal province | appliquer à search/get |
| Attribution NIN | bloqué officiel | service NIN | **interdit depuis ce module** |

## Mapping statuts cahier → existant

| Cahier | `CitizenStatus` |
|--------|-----------------|
| BROUILLON | DRAFT |
| SOUMIS / EN_VERIFICATION / EN_VALIDATION | PENDING_VALIDATION |
| DOUBLON_POTENTIEL | verification FLAGGED + DuplicateCandidate OPEN |
| VALIDE / IDENTIFIED | ACTIVE (+ nic) |
| REJETE | SUSPENDED (motif history) |
| FUSION | MERGED |
| Décès | DECEASED |
