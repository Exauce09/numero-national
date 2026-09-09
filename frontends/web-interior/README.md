# E-GOUV — Ministère de l'Intérieur

Portail dédié (même logique que la Présidence) pour la supervision des **mouvements**, **déplacements**, **documents manquants** et **parcours citoyens**.

## Démarrage

```bash
cd frontends/web-interior
npm install
npm run dev
```

Ouvrir : http://localhost:5178/login

**Démo :** `interieur` / `DemoInterieur2026!`

## Menus

| Route | Contenu |
|-------|---------|
| `/` | Tableau de bord dynamique + graphiques + exports |
| `/mouvements` | Entrées, sorties, transits, retours |
| `/deplacements` | Actes de déplacement et statuts |
| `/documents-manquants` | Pièces manquantes / en cours / rejetées |
| `/parcours` | Recherche citoyen + chronologie complète |

Exports disponibles : **CSV, Excel, PDF, Imprimer, SQL**.
