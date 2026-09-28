# Référentiel SIGPOP-RDC

Sources Excel intégrées dans l’application via `src/data/sigpopReferentiel.json`.

**Source active :** `province_et_territoire.xlsx` (Provinces + Territoires + Secteurs/Chefferies).

| Niveau | Chargé | Remarque |
|--------|--------|----------|
| Provinces | 26 | Complet |
| Territoires | 145 | Complet (hors Kinshasa urbain) |
| Secteurs / chefferies | 734 | Nomenclature CENI 2018 |
| Groupements | 0 | Non fournis dans ces fichiers |
| Villages | 0 | Non fournis dans ces fichiers |

Régénérer le JSON :

```bash
npm i xlsx --no-save
node scripts/importSigpopReferentiel.mjs data/sigpop/province_et_territoire.xlsx
```
