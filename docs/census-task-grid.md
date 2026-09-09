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
- [x] 2.6 Indicateur sync (SYNCED / EN_ATTENTE / ERROR)
- [ ] 2.2–2.5 GPS, validation, liste correction
- [ ] 2.7 Correction locale complète

## Phase 3 — Sync fiable
- [ ] Push/pull durci + conflits UX + tests

## Phase 4 — Superviseur
- [ ] Workflow APPROVE/REJECT

## Phase 5 — Registre NIC
- [ ] Validé → core_registry

## Phase 6 — Stats MVP
- [ ] Critères §66 complets

Prochaine session Agent : Phase 2.2+ (GPS ménage) ou Phase 3.
