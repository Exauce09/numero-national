# Grille recensement — NUMERO NATIONAL

Légende : ✅ fait · ⚠️ partiel · ⬜ à faire

## Phase 0 — Cadre
- [x] 0.1 Même repo
- [x] 0.2 API Docker + seed agent + campagne ACTIVE
- [x] 0.3 Login mobile JWT + sync
- [x] 0.4 Parcours MVP documenté — `docs/census-mvp-parcours.md`

## Phase 1 — Campagne & territoire
- [x] 1.1 CRUD campagnes
- [x] 1.2 Zones + géo (API)
- [x] 1.3 Affectation agent → équipe → zone
- [x] 1.4 `GET /agents/me/assignments`
- [x] 1.5 UI admin affectations (ONIP → Campagnes → Affectations)

## Phase 2 — Mobile collecte
- [x] 2.1 Zones/campagne hors ligne
- [x] 2.2 Ménage (adresse + cascade géo Flutter province→quartier)

- [x] 2.3 GPS
- [x] 2.4 Membres + parenté
- [x] 2.5 Validation locale
- [x] 2.6 Indicateur sync
- [x] 2.7 Liste + correction locale (brouillon / rejet)

## Phase 3 — Sync fiable
- [x] 3.1–3.5 Push/pull, conflits UX, tests (versionnement partiel OK)

## Phase 4 — Superviseur
- [x] API APPROVE / REJECT + permissions
- [x] 4.3 Liste dossiers (+ filtre `zone_id`)
- [x] 4.4 UI ONIP contrôle + motif
- [x] 4.5 Mobile : rejet + motif + corriger + renvoyer

## Phase 5 — Registre NIC
- [x] Promote + `citizen_id` / NIC

## Phase 6 — Stats & clôture MVP
- [x] 6.1 `GET /campaigns/{id}/stats`
- [x] 6.2 Stats agent (existant)
- [x] 6.3 Export CSV campagne
- [x] 6.4 Parcours + checklist opérationnelle documentés

## Post-MVP (7–9)
Caméra réelle, formulaires dynamiques, RBAC géo fin, Leaflet, E2E terrain, secrets prod — backlog.
