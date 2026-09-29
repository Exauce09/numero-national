# Référentiel SIGPOP-RDC

Sources Excel intégrées dans l’application via `src/data/sigpopReferentiel.json`.

**Sources :**
- **Provinces + territoires (145)** : `province.docx` (codes `COD-P01` … `COD-P26`, `COD-Pxx-Tyy`)
- **Secteurs / chefferies (734)** : `province_et_territoire.xlsx` (phase 3A)

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
node scripts/applyProvinceDocx.mjs data/sigpop/province.docx
node scripts/importSigpopReferentiel.mjs data/sigpop/province_et_territoire.xlsx
```

Cascade UI : **Province** → **Ville ou Territoire** (liste unique) → **Commune** (ville) ou **Secteur / Chefferie** (territoire) → village / quartier selon le profil.
