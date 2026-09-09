# Grille recensement — NUMERO NATIONAL (continuer, ne pas recommencer)

Légende : ✅ fait · 🚧 en cours · ⬜ à faire

## Phase 0 — Cadre
- [x] Rester sur le même repo
- [x] API Docker + seed agent
- [x] Login mobile JWT + sync basique

## Phase 1 — Campagne & territoire
- [x] 1.1 CRUD campagnes (API existante + permissions manage)
- [x] 1.2 Zones liées campagne (+ geo_level / geo_ref_id) — migration `013`
- [x] 1.3 Affectation agent → équipe → zone
- [x] 1.4 `GET /api/v1/census/agents/me/assignments`
- [x] 1.5 Seed admin/agent/zone/équipe + test `tests/test_census_assignments.py`

## Phase 2 — Mobile collecte
- [x] 2.1 Télécharger affectations / zones (cache SQLite)
- [x] 2.2 Créer ménage (adresse + formulaire)
- [x] 2.3 GPS sur ménage
- [x] 2.4 Ajouter membres (lien de parenté)
- [x] 2.5 Validation locale champs obligatoires
- [x] 2.6 Indicateur sync (SYNCED / EN_ATTENTE / ERROR / OFFLINE)
- [x] 2.7 Liste ménages + membres + statuts

## Phase 3 — Sync fiable
- [x] Push/pull durci (détails par local_id, raisons, snapshot serveur)
- [x] Conflits UX (écran résolution: accepter serveur / forcer envoi)
- [x] Tests API `tests/test_census_sync.py`

## Phase 4 — Superviseur
- [x] File d'attente `GET /campaigns/{id}/records?status=SYNCED`
- [x] `POST /records/{id}/approve` (+ note optionnelle)
- [x] `POST /records/{id}/reject` (note obligatoire)
- [x] Migration `014_census_review` (APPROVED + audit review)
- [x] Tests `tests/test_census_review.py`
- [x] Mobile: affichage APPROVED / REJECTED

## Phase 5 — Promotion NIC
- [ ] Fiches APPROVED → `core_registry`

Prochaine session Agent : Phase 5 (promotion registre).
