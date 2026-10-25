# Module 1 — Dictionnaire KPI & cartographie sources

**Cahier :** `Module_1_Dashboard_National_ONIP_Cahier_des_charges_Detaille.docx`  
**Date :** 2026-10-25  
**Endpoint principal :** `GET /api/v1/onip/dashboard`  
**Compléments :** `/dashboard/trends`, `/dashboard/territories`, `/dashboard/alerts`, `/dashboard/health`

| KPI | Définition | Statuts / règle | Date métier filtrée | Source SQL / table | Stock / flux |
|-----|------------|-----------------|--------------------|--------------------|--------------|
| registered_records | Dossiers personnes dans FGP (référentiel) | Tous sauf filtre statut | `citizens.created_at` | `core_registry.citizens` | stock (+flux période) |
| validated_records | Dossiers validation finale | `status = ACTIVE` | `created_at` (filtre périmètre) | idem | stock |
| pending_records | Action encore requise | `DRAFT`, `PENDING_VALIDATION` | idem | idem | stock |
| pending_by_status | Ventilation attente | par `status` | idem | idem | stock |
| assigned_nins | Personnes avec NIC/NIN | `nic IS NOT NULL` (provisoire tant qu’officiel bloqué) | idem | idem | stock |
| duplicate_reviews_open | Cas doublon démographique OPEN | `duplicate_candidates.status=OPEN` | — | `core_registry.duplicate_candidates` | stock |
| biometric_reviews_open | Revues bio humaines | match PENDING + dedup MANUAL_REVIEW | — | `biometric.*` | stock |
| cards_produced | Cartes existantes (production) | toutes hors filtre statut | `national_cards.created_at` | `cards.national_cards` | stock |
| cards_delivered | Remise confirmée | `DELIVERED` **ou** `delivered_at IS NOT NULL` | created_at / delivered | idem | stock |
| cards_expired | Validité dépassée | `status=EXPIRED` **ou** (`expires_at < now` et pas REVOKED) | — | idem | stock |
| cards_pending | Production / remise en cours | `PENDING`, `SENT_TO_COMMUNE` | created_at | idem | stock |
| validation_rate | validés / (validés+pending) sur périmètre | N/A si dénominateur 0 | — | calcul | taux |
| sync_rate | synced+approved+promoted / records | census statuses | `census_records.updated_at` | `recensement.census_records` | taux |
| sync_failures | Lots rejetés / partiels | `REJECTED`, `PARTIAL` | — | `recensement.sync_batches` | stock |
| campaigns_active | Campagnes ACTIVE | `status=ACTIVE` | — | `recensement.campaigns` | stock |
| anomalies_open | Alertes non clôturées synthétiques | dérivé compteurs | — | agrégats | stock |

## Fraîcheur

- `meta.generated_at` : horodatage UTC du calcul.
- `meta.freshness` : `current` si toutes les métriques `ok` ; `degraded` si au moins une source `unavailable` ; `unknown` si aucune sonde.

## Règles cahier respectées

- Zéro réel ≠ indisponible (`sources[].status`).
- NIC provisoire ≠ NIN officiel confirmé (flag `official_nin_format_confirmed`).
- Doublon OPEN ≠ doublon confirmé ; pas de fusion depuis le dashboard.
- Export = agrégats uniquement (`pii: false`).
- Pas d’attribution NIN / production CIN depuis les KPI.
