# Audit et mise en conformité — Identification ONIP / FGP (SIGPOP-RDC)

**Date d’audit :** 2026-10-25  
**Périmètre :** attribution du numéro national d’identification (NIN/NIC), FGP, biométrie, cartes, sync recensement / état civil.  
**Règle appliquée :** aucune conformité légale déclarée sans disposition officielle vérifiable ; aucun nouveau format inventé.

---

## PHASE A — Inventaire technique

### A.1 Fichiers et services concernés

| Zone | Chemin | Rôle actuel |
|------|--------|-------------|
| Génération NIC | `apps/api/domains/core_registry/nic_service.py` | Format **provisoire** `v3-rdc-14` (14 chiffres : PP+TTT+S+YYYY+NNNN) |
| Attribution | `assign_nic`, `validate_and_assign_nic` dans `core_registry/service.py` | Validation + anti-doublon démographique + journal |
| API citoyens | `apps/api/domains/core_registry/router.py` | `POST …/validate` → NIC |
| Recensement | `apps/api/domains/recensement/service.py` | Promote avec `assign_nic=true` |
| État civil | `apps/api/domains/etat_civil/services.py` | NIC provisoire à la création d’acte ; assign à validation naissance |
| ONIP UI | `frontends/onip-dashboard/` | Campagnes → Promouvoir NIC, page NIC, Cartes, Anomalies |
| Sync EC | `frontends/etat-civil/src/onipSync.ts` | File d’attente cartes / citoyens |
| Biométrie | `apps/api/domains/biometric/` | Templates chiffrés, 1:N avant stockage |
| Cartes | `apps/api/domains/cards/` | Délivrance après NIC ; QR sans PII |
| Migration NIC | `alembic/versions/017_nic_14_rdc.py` | Colonne `nic` String(14) |
| Tests | `tests/test_nic.py` | Format v3 provisoire |
| Décret (copie) | `docs/legal/onip/decret_22_07_who.pdf` (+ `.txt`) | Miroir WHO du décret 22/07 |

### A.2 Modèle citoyen (extrait)

- Table `core_registry.citizens.nic` : `String(14)`, **unique**, nullable.
- Statuts actuels : `DRAFT`, `PENDING_VALIDATION`, `ACTIVE`, `DECEASED`, `MERGED`, `SUSPENDED`.
- Journal : `nic_issuance_log` + `CitizenHistory` (`NIC_ASSIGNED`).
- Pas de statut dédié `IDENTIFIED` / `DUPLICATE_REVIEW` (équivalents partiels via `ACTIVE`, `DuplicateCandidate.OPEN`, `verification_status`).

### A.3 Format actuellement généré (NON OFFICIEL)

```
PP TTT S YYYY NNNN   (14 chiffres)
│  │   │ │    └─ séquence 0000–9999
│  │   │ └────── année naissance (4 chiffres)
│  │   └──────── sexe 1/2/0
│  └──────────── territoire hash 001–999
└─────────────── province 01–26
```

- **Pas** de mois de naissance.
- **Pas** de clé de contrôle à 2 chiffres.
- Encodes province/territoire (non décrits dans le décret art. 8 — la composition relève de l’arrêté).
- Algorithme version code : `v3-rdc-14` → désormais étiqueté **provisoire**.

### A.4 Points positifs déjà en place

- NIC jamais accepté en entrée client à la création.
- Unicité DB + journal d’émission.
- Refus de réattribution si NIC déjà présent.
- Blocage si doublons démographiques `OPEN` (override justifié).
- Biométrie : templates chiffrés, pas de retour plaintext API.
- Cartes : exigence d’un NIC avant génération UI.
- Dashboard analytics : agrégats sans PII.

### A.5 Écarts / risques

1. Format NIC ≠ annexe NIN décrite par le cahier (sexe + AA + MM + ordre + 2 contrôles) — **non confirmé officiellement**.
2. Attribution possible dès promote recensement / validation citoyen — risque de confondre « recensement validé » et « identification FGP définitive ».
3. État civil peut poser un NIC candidat avant validation FGP ONIP exclusive (art. 23 décret).
4. PDF ONIP `FGP.pdf` et `ARRETE CIN ET NIN.pdf` **inaccessibles** (HTTP 500 / taille 0) au moment de l’audit.
5. Hébergement RDC (art. 1 / art. stockage) : non vérifié dans l’infra déployée ici.
6. Test `encode_province("KIN") == "01"` dans `tests/test_nic.py` **contredit** le code (`KIN` → `"15"`).

---

## PHASE B — Vérification juridique

### B.1 Textes examinés

| Texte | Source | Statut accès | Contenu utile |
|-------|--------|--------------|---------------|
| Décret n° **22/07** du **2 mars 2022** (FGP) | [leganet.cd](https://www.leganet.cd/Legislation/Droit%20Public/Identification/decret%2022.04.02.03.2022.html) + miroir WHO PDF local | **Vérifié** | Art. 1–2, 6–9, 12–20, 23, entrée en vigueur à la signature |
| Arrêté CIN / NIN + annexe composition | `https://www.onip.gouv.cd/docs/ARRETE%20CIN%20ET%20NIN.pdf` | **Non récupérable** (échec téléchargement) | Composition NIN **non vérifiable** |
| Décret CIN 22/08 (carte) | Résumés ONIP / extraits CIN.pdf (OCR partiel) | Partiel | CIN 10 ans, délivrée par ONIP après enregistrement FGP |
| Arrêtés « NIN » Économie 2013/2020 | leganet / JO | **Autre objet** | Identifiant **économique** (opérateurs), **pas** le NIN FGP personnes physiques ONIP |

### B.2 Passages du décret 22/07 (vérifiés)

- **Art. 1** : FGP créé ; constitué et entretenu par l’ONIP ; **logé uniquement sur le territoire national**.
- **Art. 2** : données biographiques, biométriques et d’état civil ; protection des données personnelles.
- **Art. 6** (rôle) : fichier unique de référence ; attribution d’un **numéro national d’identification** ; échange autorisé ; lutte contre la fraude à l’identité ; authentification / documents.
- **Art. 8** : NIN attribué à chaque personne lors du **premier enregistrement au FGP** ; **le Ministre de l’Intérieur fixe les règles de composition sur proposition de l’ONIP**.
- **Art. 9** : liste des données obligatoires (dont NIN, biométrie visage/empreintes, filiation, etc.).
- **Arts. 12–20** (accès, secret, conservation ~ vie + 100 ans après décès, rectification, stockage RDC, rapports).
- **Art. 23** : **authentification** biographique et biométrique **exclusivement ONIP**.
- **Entrée en vigueur** : date de signature (02 mars 2022). Textes modificatifs du décret : **non trouvés** dans cette passe.

### B.3 Composition du NIN — décision

| Hypothèse | Preuve | Décision |
|-----------|--------|----------|
| Format annexe (sexe + AA + MM + ordre + 2 contrôles) | Document ONIP non téléchargeable ; longueur / ordre / clé **non reconstruits** depuis une source signée | **Non retenu** |
| Format code `v3-rdc-14` | Invention métier SIGPOP | **Provisoire DEV uniquement** — **interdit** de le présenter comme NIN officiel |
| Format `CD-2026-…` | Fictif | **Interdit** (déjà absent du générateur) |

**BLOQUANT PRODUCTION GÉNÉRATEUR OFFICIEL :**  
`OFFICIAL_NIN_FORMAT_CONFIRMED = False`  
Clarification requise auprès de l’ONIP / Ministre de l’Intérieur : texte signé de l’arrêté + **annexe intégrale** (longueur totale, taille du n° d’ordre, algorithme exact des 2 chiffres de contrôle), et éventuels textes modificatifs.

---

## PHASE C — Architecture et plan de migration (sans destruction)

### C.1 Cible fonctionnelle

Service unique : `NationalIdentityNumberService`  
(`apps/api/domains/core_registry/national_identity_number_service.py`)

- Point d’entrée unique pour ONIP, recensement, EC, cartes.
- Chemins :
  - `assign_provisional_nic` — DEV / tests (format actuel, audit tagué).
  - `assign_official_nin` — **levé d’exception** tant que l’annexe n’est pas confirmée.
- Idempotence, unicité, journal, pas de réattribution, pas de résolution silencieuse de conflit.

### C.2 Statuts (mapping sans duplication inutile)

| Besoin métier | Convention existante | Action |
|---------------|----------------------|--------|
| DRAFT | `DRAFT` | Conserver |
| SUBMITTED / UNDER_REVIEW | recensement + `PENDING_VALIDATION` | Documenter ; éviter double enum tant que non requis |
| DUPLICATE_REVIEW | `DuplicateCandidate` OPEN + `FLAGGED_DUPLICATE` | Conserver |
| APPROVED (recensement) | statut fiche campagne | Distinct de NIC |
| IDENTIFIED | aujourd’hui `ACTIVE` + `nic IS NOT NULL` | Alias logique / doc ; migration enum **optionnelle** plus tard |
| REJECTED / CORRECTION | flux existants | Ne pas écraser |
| DECEASED | `DECEASED` | Conserver |

**Règle métier :** ne pas attribuer de NIN définitif à chaque naissance / recensement / import — uniquement après validation FGP / promote autorisé ONIP.

### C.3 Migration données

1. Inventaire SQL (à exécuter sur copie) : compter `nic IS NOT NULL`, longueurs, formats non numériques, collisions.
2. Sauvegarde DB.
3. **Aucune conversion automatique** des NIC v3 → NIN officiel.
4. Flag `algorithm_version` / champ futur `nin_status` (`PROVISIONAL` | `OFFICIAL`) — migration **additive** réversible.
5. Après réception annexe : générateur officiel + procédure manuelle de rapprochement validée ONIP.

### C.4 Cartes / biométrie / sécurité

- Carte : garder exigence NIC ; marquer prototype UI tant que specs CIN officielles non figées.
- Biométrie : conserver chiffrement + revue humaine des matchs.
- Dashboard : agrégats seulement (déjà).
- Authentification forte MFA : vérifier couverture sur `registry:citizen:validate`.

---

## PHASE D–F — Implémentation immédiate (cette livraison)

Fait dans le dépôt :

1. Rapport (ce fichier) + copie décret WHO.
2. Service `NationalIdentityNumberService` + garde-fou officiel.
3. Marquage explicite du générateur actuel comme **provisoire**.
4. Tests : blocage chemin officiel ; idempotence / non-réattribution (provisoire).

**Non fait (volontairement) :**

- Changement de longueur / algorithme de contrôle.
- Migration destructive des NIC existants.
- Déclaration de conformité légale du format.

---

## PHASE G — Déploiement & validation ONIP

### Commandes tests

```bash
cd "c:\Users\hp\Documents\NUMERO NATIONAL"
py -3 -m pytest tests/test_nic.py tests/test_nin_compliance.py -q
```

### Points à valider officiellement (ONIP / Intérieur)

1. PDF signé de l’arrêté NIN + annexe (longueur, ordre, clé).
2. Moment exact d’attribution (premier enregistrement FGP vs promote recensement).
3. Spécifications CIN (MRZ, éléments de sécurité) — prototype actuel.
4. Attestation d’hébergement / réplication sur territoire RDC.
5. Procédure de fusion / conservation d’historique NIN.

### Risques restants

- Incohérence annexe non résolue → **pas de mise en production NIN officiel**.
- Données déjà émises en `v3-rdc-14` à traiter comme provisoires.
- Sources ONIP web indisponibles au moment de l’audit.

---

## Conclusion

L’existant (unicité, journal, anti-doublon, biométrie chiffrée, portail ONIP) est une **base réutilisable**.  
La **composition légale du NIN n’est pas établie** à partir d’une source officielle complète accessible.  
Le générateur définitif reste **bloqué** ; le format code actuel est **provisoire et non conforme déclaré**.
