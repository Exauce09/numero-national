# Matrice plan complet ONIP/SIGPOP-RDC ↔ existant

**Source plan :** `Plan_complet_systeme_ONIP_SIGPOP_RDC.docx` (extrait TXT dans ce dossier)  
**Date :** 2026-10-25  
**Légende :** `EXISTANT` | `PARTIEL` | `ABSENT` | `BLOQUE` (attente juridique)

| Module / exigence (plan §5–11) | Statut | Preuve / chemin | Action suivante |
|--------------------------------|--------|-----------------|-----------------|
| Portail ONIP 5183 | EXISTANT | `frontends/onip-dashboard/` | Compléter menus manquants |
| API `GET /onip/dashboard` | EXISTANT | `apps/api/domains/onip/routes.py` | Agrégats PII-safe (déjà) |
| Comptes / habilitations | PARTIEL | `AccountsPage.tsx`, identity RBAC | MFA obligatoire comptes sensibles |
| Campagnes recensement | EXISTANT | `CampaignsPage.tsx`, `domains/recensement/` | Idempotence sync continue |
| Anomalies / doublons | PARTIEL | `AnomaliesPage.tsx`, `duplicate_service.py` | Tickets SLA, escalade |
| Cartographie | EXISTANT | `CartographiePage.tsx`, `/onip/map-*` | Qualité GPS |
| NIC / NIN consultation | PARTIEL | `NicNumbersPage.tsx` | Afficher statut provisoire vs officiel |
| Cartes ID | PARTIEL | `CardsPage.tsx`, `domains/cards/` | Marquage prototype CIN |
| Service central NIN | PARTIEL | `national_identity_number_service.py` | Officiel bloqué |
| Format NIN officiel | BLOQUE | Audit `AUDIT_CONFORMITE_FGP_NIN.md` | Attendre arrêté + annexe |
| Générateur provisoire v3 | EXISTANT | `nic_service.py` | Ne pas présenter comme officiel |
| Unicité / journal NIC | EXISTANT | `citizens.nic` unique, `nic_issuance_log` | Tests concurrence renforcés |
| Biométrie ZK 1:N | PARTIEL | `domains/biometric/` | Page ONIP dédiée absente |
| État civil → FGP | PARTIEL | `domains/etat_civil/`, `onipSync.ts` | File événements ONIP UI |
| FGP dossier complet art.9 | PARTIEL | `Citizen` model | Matrice champ↔article |
| Enrôlement (rendez-vous, reçu) | PARTIEL | Recensement Flutter + promote | Module enrôlement ONIP dédié |
| Portail citoyen | PARTIEL | `frontends/citizen-portal/` | Hors cockpit ONIP |
| Partenaires / verify API | PARTIEL | analytics/identity verify | Catalogue clients + quotas |
| Audit append-only | PARTIEL | `domains/audit/` | Revue intégrité |
| Hébergement RDC | À VÉRIFIER | Infra hors dépôt | Attestation institution |
| MFA ops sensibles | PARTIEL | identity MFA models | Forcer sur validate/NIN |
| Population / FGP UI | ABSENT | — | Page placeholder → recherche registry |
| Biométrie UI ONIP | ABSENT | — | Page revue correspondances |
| État civil UI ONIP | ABSENT | — | File événements |
| Rapports / exports | PARTIEL | Dashboard + CSV campagnes | Indicateurs plan §16 |
| Administration technique | ABSENT | — | Health jobs UI |
| Frais / reçus | ABSENT (volontaire) | Plan §5.19 | Ne pas inventer de tarifs |
| Migration NIN officielle | BLOQUE | — | Interdit sans procédure ONIP |

## Phases plan (§13) — avancement

| Phase | Statut | Preuve |
|-------|--------|--------|
| 0 Cadrage | FAIT (doc plan + audit) | ce dossier |
| 1 Audit technique | FAIT | matrice + audit code |
| 2 Vérification juridique | PARTIEL | décret vérifié ; arrêté NIN non récupérable |
| 3 Fondations FGP/NIN | PARTIEL | service central + bloque officiel |
| 4–10 | EN COURS / À PLANIFIER | sans format inventé |

## Critère d’arrêt (plan §12.3 / table 12)

**Aucun passage en production du générateur NIN officiel** tant que l’annexe n’est pas confirmée.
