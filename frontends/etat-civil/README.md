# Bureau d’état civil (RDC)

Application **uniquement** dédiée au service d’état civil tel qu’exercé en République démocratique du Congo : tenue des registres, établissement et délivrance des actes, mentions et transcriptions.

Ce dossier est **séparé** de `civil-officer` (SIGPOP / population / recensement / biométrie / santé).

## Lancer

```bash
cd frontends/etat-civil
npm install
npm run dev
```

- URL : [http://localhost:5180/](http://localhost:5180/)
- Connexion : `officier` / `DemoCivil2026!`  
  (API : `officier.etatcivil@example.gov` / `CivilOfficer123!`)

## Périmètre (missions EC RDC)

| Service | Route |
|---------|-------|
| Tableau de bord bureau | `/` |
| Missions & cadre légal | `/missions` |
| Naissances | `/manage/naissance`, `/births` |
| Mariages | `/manage/mariage`, `/marriages` |
| Décès | `/manage/deces`, `/deaths` |
| Reconnaissances | `/recognitions` |
| Adoptions | `/manage/adoption`, `/adoptions` |
| Divorces | `/manage/divorce`, `/divorces` |
| Transcriptions | `/transcriptions` |
| Rectifications / mentions | `/corrections` |
| Copies & extraits | `/documents` |
| Déclarations à valider | `/declarations` |
| Registre des actes | `/acts` |
| Recherche | `/search` |
| Bureaux / personnel | `/admin/bureaux`, `/admin/personnel` |

## Hors périmètre (volontairement exclu)

Recensement, biométrie, cartes d’identité, portail sanitaire, déplacements / mobilité, registre population national comme métier principal.

L’API reste la même (`/api/v1/civil/*`) pour la synchronisation des actes.
