# Module biométrique — enrôlement 3 doigts & déduplication 1:N

## Architecture

```text
API / UI
   ↓
enrollment_service / service
   ↓
BiometricProvider (abstraction)
   ├── LocalHashProvider   ← démo actuelle (hash + Fernet)
   ├── SDKProvider         ← futur scanner / SDK constructeur
   └── ABISProvider        ← futur moteur ABIS national
```

Les gabarits sont chiffrés au repos (`template_encrypted`). Les réponses API n’exposent jamais les octets du gabarit.

## Flux d’enrôlement

1. `POST /api/v1/biometric/enrollments` — ouvre une session (3 doigts requis)
2. `POST .../capture` — qualité → extraction → gabarit → **recherche 1:N** → store **seulement** si pas de match fort / revue
3. `POST .../finalize` — clôture quand 3 doigts actifs

En cas de correspondance forte : statut `BLOCKED`, enregistrement `biometric_matches`, audit `BIOMETRIC_ENROLLMENT_BLOCKED`. Aucun nouveau gabarit n’est écrit pour ce doigt.

## Seuils

Table `biometric.biometric_thresholds` (`environment=demo`). Valeurs techniques de démonstration uniquement — pas des seuils officiels RDC.

## Remplacement par un SDK / ABIS

1. Implémenter `BiometricProvider` (qualité, features, template, search1N, verify1to1).
2. Brancher via `get_biometric_provider()` (factory / settings).
3. Conserver le même contrat API et les mêmes tables (`template_hash` peut devenir un index externe ABIS).

Variables :

```text
BIOMETRIC_PROVIDER=local|abis
BIOMETRIC_ABIS_URL=https://abis.example/v1
```

### ZK9500 USB (site PC)

1. Brancher le lecteur ZK9500 (détecté comme `ZK9500` USB).
2. Lancer le pont local : `py -3 scripts/zkteco_bridge.py`
3. Sur civil-officer → Biométrie → Identification → **Capturer ZK9500 + rechercher**

Sans SDK ZKFinger, le pont fournit une capture DEMO pour valider le flux.
**Morpho (tablette) ↔ ZKTeco (USB)** : matching croisé uniquement via un vrai ABIS multi-constructeurs.

## Permissions RBAC

| Permission | Usage |
|---|---|
| `biometric:enroll` | Capture / enrôlement / liste empreintes |
| `biometric:match` | Identification 1:N / stats / seuils |
| `biometric:review` | Revue exceptionnelle d’une correspondance |

## UI (civil-officer)

- `/biometrie` — tableau de bord
- `/biometrie/enrolement?citizen=<uuid>` — enrôlement 3 doigts
- `/biometrie/identification` — recherche 1:N
- Fiche population → onglet **Biométrie**
