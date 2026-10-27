# Recherche — format officiel du NIN ONIP / FGP (personnes physiques)

**Date :** 2026-10-27  
**Objet :** composition du Numéro d’Identification Nationale attribué par l’ONIP au FGP.

---

## Verdict

**La composition officielle du NIN personnes physiques ONIP/FGP n’est pas publiée de façon vérifiable.**  
Le générateur officiel du projet **reste bloqué** (`OFFICIAL_NIN_FORMAT_CONFIRMED = False`).  
**Aucun format inventé n’a été activé.**

---

## Textes examinés

| Texte | Objet | Composition NIN FGP ? |
|-------|--------|------------------------|
| **Décret n° 22/07** du 2 mars 2022 (FGP) | Crée le FGP ; art. 8 | **Non** — renvoie à un arrêté |
| Arrêté CIN / NIN + annexe (`onip.gouv.cd/docs/ARRETE CIN ET NIN.pdf`) | Cible : composition technique | **Inaccessible** (SSL / fichier vide / non archivé) |
| Décret n° 22/08 (CIN) | Carte d’identité | Mentionne le NIN sur la carte ; **pas** la formule |
| Arrêté 2 juillet 2020 (nomenclature ID.NAT) | Identifiant **économique** (opérateurs) | **Autre objet** — pas le NIN FGP personnes |

### Décret 22/07 — article 8 (extrait)

> Un numéro d’identification nationale est attribué à chaque personne physique lors de son premier enregistrement au FGP.  
> Sur proposition de l’ONIP, le Ministre ayant l’Intérieur dans ses attributions **fixe les règles selon lesquelles ce numéro est composé**.

Conséquences appliquées dans le code :

1. Attribution uniquement via le service central NIN (Module 7).
2. Pas de NIN proposé par un client / formulaire.
3. Générateur « officiel » désactivé tant que l’arrêté + annexe signés ne sont pas fournis.
4. Format `PROVISIONAL-v3-rdc-14` = **développement uniquement**, jamais présenté comme NIN officiel.

---

## Ce que l’annexe en ligne laisserait entendre (non retenu)

Le cahier Module 7 et l’audit interne évoquent une structure du type  
**sexe + AA + MM + n° d’ordre + 2 chiffres de contrôle**, avec des **incohérences** sur la longueur de la partie aléatoire et la clé.

Sans PDF signé, vecteurs de test et clarification écrite ONIP/Intérieur, **cette hypothèse n’est pas appliquée**.

---

## Action pour activer le NIN officiel (hors inventaire)

Fournir dans le dépôt (ou à l’équipe) :

1. Arrêté du Ministre de l’Intérieur + **annexe intégrale** (longueur totale, positions, algorithme de clé, exemples).
2. Confirmation écrite que cette version est celle en vigueur.
3. Alors seulement : implémenter le générateur + validateur indépendant, tests, puis  
   `OFFICIAL_NIN_FORMAT_CONFIRMED = True`.

---

## État code (appliqué)

- `apps/api/domains/core_registry/national_identity_number_service.py` → `OFFICIAL_NIN_FORMAT_CONFIRMED = False`
- `apps/api/domains/core_registry/nic_service.py` → format provisoire 14 chiffres, étiqueté non officiel
- UI Conformité / NIC : affichage « officiel non confirmé »
