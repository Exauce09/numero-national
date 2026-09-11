# Identifiants démo — état civil & terrain

## État civil / Population (API + site 5176)

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Officier | `officier.etatcivil@example.gov` | `CivilOfficer123!` |
| Alias UI | `officier` | `DemoCivil2026!` |
| Admin API | `admin.recensement@example.gov` | `CensusAdmin123!` |

## Recensement (tablette Flutter)

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Agent | `agent.recensement@example.gov` | `CensusAgent123!` |
| Superviseur | `supervisor.recensement@example.gov` | `CensusSupervisor123!` |

## Ce qui reste pour un système national certifié

- Moteur ABIS multi-constructeurs (Morpho + ZKTeco) homologué
- SDK ZKFinger réel dans `scripts/zkteco_bridge.py` (au lieu du mode DEMO)
- Certification biométrique / seuils officiels RDC
- Cartographie nationale temps réel + qualité adresse
- Workflow juridique complet (contentieux, mentions légales sourcées)
- Haute disponibilité, MFA obligatoire, HSM / chiffrement production
- Audit indépendant et procédures d’exception biométrique formalisées

Le MVP actuel couvre actes, IAM, population, enrôlement 3 doigts, dédup 1:N démo, cartographie filtrable, coupon PDF/partage.
