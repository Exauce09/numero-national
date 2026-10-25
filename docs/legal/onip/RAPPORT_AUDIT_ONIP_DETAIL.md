# Rapport d’audit ONIP — plan très détaillé (§15)

**Date :** 2026-10-25  
**Source plan :** `Plan_ONIP_SIGPOP_RDC_Tres_Detaille.docx` / `.txt`  
**Dépôt :** SIGPOP-RDC / numero-national  
**Règle :** statut basé sur preuves code/tests ; aucun format NIN inventé.

**Tests exécutés (Lot 0) :**  
`.\.venv\Scripts\python.exe -m pytest tests/test_nin_compliance.py tests/test_onip_nin_routes.py tests/test_nic.py -q` → **14 passed** (2026-10-25).

Légende statut : `terminé` | `partiel` | `absent` | `bloqué` | `à vérifier`

---

## Module 1 — Tableau de bord national

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `frontends/onip-dashboard/src/pages/DashboardPage.tsx`, `GET /api/v1/onip/dashboard` (`apps/api/domains/onip/routes.py`, `service.py`) |
| Tables | agrégats `core_registry.citizens`, `recensement.*`, `cards.*`, anomalies |
| Risque | Endpoints dashboard/map historiquement sans RBAC (fuite agrégats / GPS) |
| Priorité | P1 — sécuriser + enrichir files |
| Tests | Pas de test HTTP dédié dashboard ; smoke via ops-health |

## Module 2 — Gestion des personnes / dossiers

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `apps/api/domains/core_registry/` (`Citizen`, adresses, historique, relations) ; UI `PopulationFgpPage.tsx` |
| Endpoints | `/api/v1/registry/citizens*` |
| Tables | `core_registry.citizens`, `citizen_addresses`, `citizen_history`, `citizen_relations` |
| Risque | Matrice art.9 FGP incomplète ; pas d’API résolution doublons |
| Priorité | P1 |
| Tests | `tests/test_nic.py`, promote/validate |

## Module 3 — Enrôlement

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | Statuts recensement `CensusRecordStatus` (DRAFT→QUEUED→SYNCED→CONFLICT→APPROVED→REJECTED→PROMOTED) ; mapping plan documenté |
| Endpoints | `/api/v1/census/records/*`, sync push/pull |
| Risque | Pas de module « rendez-vous / reçu » dédié ONIP |
| Priorité | P2 |
| Tests | `tests/test_census_review.py`, `test_census_sync.py` |

## Module 4 — Recensement et campagnes

| Champ | Valeur |
|-------|--------|
| Statut | **terminé** (cœur opérationnel) |
| Preuves | `CampaignsPage.tsx`, `domains/recensement/`, promote idempotent (`already_promoted`) |
| Tables | `recensement.campaigns`, `zones`, `teams`, `census_records`, `sync_batches` |
| Risque | SLA sync / file profondeur partiels |
| Priorité | P2 |
| Tests | `tests/test_census_promote.py`, `test_census_assignments.py` |

## Module 5 — FGP

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | Identifiant interne UUID ≠ NIC ; historique ; pas de suppression décès |
| Risque | Confusion recensement validé vs identification FGP |
| Priorité | P0/P1 |
| Tests | registry + promote |

## Module 6 — Biométrie

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `domains/biometric/` ZK/enroll/match ; stats UI ONIP ; revue API `POST /matches/{id}/review` |
| Tables | `biometric.*` (templates, enrollments, matches) |
| Risque | File revue humaine UI absente avant Lot 2 ; provider démo |
| Priorité | P1 |
| Tests | `tests/test_biometric_enrollment.py` |

## Module 7 — NIN

| Champ | Valeur |
|-------|--------|
| Statut | **bloqué** (officiel) / **partiel** (provisoire) |
| Preuves | `national_identity_number_service.py` (`OFFICIAL_NIN_FORMAT_CONFIRMED=False`) ; `nic_service.py` v3 provisoire ; `POST /onip/nin/assign` |
| Tables | `citizens.nic` unique, `nic_issuance_log` |
| Risque | Présenter v3 comme officiel = non-conformité |
| Priorité | P0 — garder bloqué |
| Tests | `tests/test_nin_compliance.py`, `test_onip_nin_routes.py` — **OK** |

## Module 8 — État civil

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `domains/etat_civil/`, UI `EtatCivilOnipPage.tsx` (lecture) ; sync `onipSync.ts` |
| Risque | Conflits / événements répétés peu explicités ; pas d’écriture cockpit |
| Priorité | P1 |
| Tests | `tests/test_iam_civil_institutional.py` |

## Module 9 — CIN

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `domains/cards/`, `CardsPage.tsx`, prototype UI |
| Risque | Délivrance sans gate NIC/ACTIVE stricte avant Lot 3 |
| Priorité | P1 |
| Tests | `tests/test_cards_qr.py` |

## Module 10 — Cartographie

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `CartographiePage.tsx`, `/onip/map-points`, `/onip/map-by-milieu` |
| Risque | Auth manquante historiquement ; qualité GPS |
| Priorité | P1 |
| Tests | absent dédié |

## Module 11 — Comptes / rôles

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | IAM/RBAC `permissions.py`, `AccountsPage.tsx`, MFA optionnel |
| Risque | MFA non forcé sur validate/NIN/bio |
| Priorité | P1 |
| Tests | `tests/test_auth.py`, `test_account_administration.py` |

## Module 12 — Portail citoyen

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `frontends/citizen-portal/` (hors cockpit ONIP) |
| Priorité | P3 (hors lots critiques) |
| Tests | limités |

## Module 13 — API partenaires

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `POST /identity/verify` (claims minimaux) ; interop OAuth stub |
| Risque | Permission absente historiquement sur verify |
| Priorité | P1 |
| Tests | partiels |

## Module 14 — Sécurité / audit

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `domains/audit/`, chiffrement bio, pas de templates dans logs UI |
| Risque | `audit:read` hors catalogue ALL_DOMAIN_PERMISSIONS |
| Priorité | P1 |
| Tests | hardening |

## Module 15 — Infrastructure / continuité

| Champ | Valeur |
|-------|--------|
| Statut | **à vérifier** |
| Preuves | Hors dépôt (hébergement RDC, RPO/RTO) |
| Priorité | Institutionnel |
| Tests | restauration non exécutable ici |

## Module 16 — Anomalies

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `AnomaliesPage.tsx`, codes agrégés dashboard |
| Risque | Pas de tickets SLA / résolution doublons |
| Priorité | P2 |

## Module 17 — Statistiques

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | Dashboard + analytics agrégés |
| Priorité | P2 |

## Module 18 — Documents / archives

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | documents domain partiel |
| Priorité | P3 |

## Module 19 — Frais / reçus

| Champ | Valeur |
|-------|--------|
| Statut | **absent** (volontaire) |
| Preuves | Plan : ne pas inventer de tarifs |
| Priorité | — hors scope |

## Module 20 — Administration technique

| Champ | Valeur |
|-------|--------|
| Statut | **partiel** |
| Preuves | `AdminTechniquePage.tsx`, `GET /onip/ops-health` |
| Risque | Métriques files/versions limitées avant Lot 5 |
| Priorité | P2 |

---

## Synthèse priorités

| Priorité | Actions |
|----------|---------|
| P0 | NIN officiel reste bloqué ; prérequis provisoire + tests |
| P1 | Auth dashboard/map/verify ; revue bio UI ; gates CIN ; MFA signal ; conflits EC |
| P2 | Ops-health enrichi ; sync/idempotence ; stats ; checklist acceptation |
| Bloqué juridique | Annexe NIN + hébergement RDC attestation |

## Critère de sortie Lot 0

Rapport présent avec 20 modules, preuves et résultats de tests réels — **satisfait**. Les lots 1–5 implémentent les corrections prioritaires sans migration destructive.
