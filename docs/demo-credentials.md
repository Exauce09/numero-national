# Identifiants démo — état civil & terrain

## État civil / Population (API + site 5176)

Création / mise à jour des comptes : `py -3 scripts/seed_civil_accounts.py`

| Rôle | Alias UI | Mot de passe UI | Email API | Mot de passe API | Rôles IAM |
|------|----------|-----------------|-----------|------------------|-----------|
| Officier (validation) | `officier` | `DemoCivil2026!` | `officier.etatcivil@example.gov` | `CivilOfficer123!` | OFFICIER_ETAT_CIVIL, CIVIL_OFFICER |
| Agent (saisie) | `agent` | `DemoAgentCivil2026!` | `agent.etatcivil@example.gov` | `AgentCivil123!` | AGENT_ETAT_CIVIL |
| Responsable de bureau | `responsable` | `DemoResponsable2026!` | `responsable.bureau@example.gov` | `ResponsableBureau123!` | RESPONSABLE_BUREAU |
| Auditeur | `auditeur` | `DemoAuditeur2026!` | `auditeur.etatcivil@example.gov` | `AuditeurCivil123!` | AUDITEUR |
| Admin provincial | `admin` | `DemoAdminProv2026!` | `admin.provincial@example.gov` | `AdminProvincial123!` | ADMIN_PROVINCIAL |

Admin technique (élévation de rôles) :

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Admin API recensement | `admin.recensement@example.gov` | `CensusAdmin123!` |

Les fiches APK (Tecno / tablette) apparaissent dans **Population → Fiches terrain** (état civil)
et dans **ONIP → Campagnes → Contrôle** (compte superviseur).

## Recensement (tablette Flutter)

| Rôle | Identifiant | Mot de passe |
|------|-------------|--------------|
| Agent | `agent.recensement@example.gov` | `CensusAgent123!` |
| Superviseur | `supervisor.recensement@example.gov` | `CensusSupervisor123!` |

## Ce qui reste pour un système national certifié

- Moteur ABIS multi-constructeurs (Morpho + ZKTeco) homologué
- Certification biométrique / seuils officiels RDC
- Haute disponibilité, MFA obligatoire, HSM / chiffrement production
- Archivage légal long terme et PKI / cachet électronique certifié
- Audit indépendant et procédures d’exception biométrique formalisées

Le MVP opérationnel couvre : actes + workflow + numérotation, registre API, extrait/QR, déclarations, corrections appliquées, NIC à la naissance, IAM bureau, population, biométrie enrôlement/recherche.
