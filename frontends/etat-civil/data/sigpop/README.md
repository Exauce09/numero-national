# Référentiel SIGPOP-RDC

Sources Excel (phases 1 → 3A) intégrées dans l’application via
`src/data/sigpopReferentiel.json`.

| Niveau | Chargé | Remarque |
|--------|--------|----------|
| Provinces | 26 | Complet |
| Territoires | 145 | Complet (hors Kinshasa urbain) |
| Secteurs / chefferies | 734 | Nomenclature CENI 2018 (à valider) |
| Groupements | 0 | Feuilles vides dans les livraisons |
| Villages | 0 | Feuilles vides dans les livraisons |

Régénérer le JSON :

```bash
npm i xlsx --no-save
node scripts/importSigpopReferentiel.mjs data/sigpop/SIGPOP_RDC_referentiel_national_phase3A.xlsx
```
