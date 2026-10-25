# Checklist d’acceptation ONIP (§12.2) — preuves Lot 5

**Date :** 2026-10-25  
**Règle :** cocher uniquement avec preuve ; NIN officiel reste non coché.

| Critère | Statut | Preuve |
|---------|--------|--------|
| Format / mécanisme NIN documentés depuis règle officielle validée | **Non** | Annexe ONIP inaccessible ; `OFFICIAL_NIN_FORMAT_CONFIRMED=False` |
| Attribution NIN atomique, centralisée, idempotente, auditée | **Partiel (provisoire)** | `NationalIdentityNumberService` ; journal `nic_issuance_log` ; tests Lot 1 |
| Dossiers / événements historisés avec provenance | **Oui (partiel)** | `CitizenHistory`, actes EC, card history |
| Correspondances biométriques → revue humaine | **Oui** | `GET /biometric/matches/pending` + UI BiometriePage |
| Recensement / EC / FGP / CIN références cohérentes | **Partiel** | promote → citizen_id ; CIN gate NIC+ACTIVE |
| Permissions testées rôles / périmètres | **Partiel** | `MATRICE_PERMISSIONS_ONIP.md` ; RBAC existant |
| Biométries / secrets protégés | **Oui (code)** | templates chiffrés ; pas dans logs UI |
| Non-régression tests existants | **À rejouer** | `pytest tests/test_nin_*.py tests/test_nic.py …` |
| Sauvegarde restaurée environnement contrôlé | **Hors dépôt** | Attestation infra |
| Validation juridique règles non publiques | **Non** | Arrêté NIN manquant |

## Hors scope volontaire

- Tarifs module 19
- Gabarit CIN homologué
- Hébergement RDC / RPO-RTO (preuve institutionnelle)
- Réécriture Flutter

## Sync hors-ligne

Voir `docs/legal/onip/SYNC_IDEMPOTENCE_ONIP.md` — NIN définitif interdit offline.
