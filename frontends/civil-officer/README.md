# Portail Officier d'état civil (E-GOUV Commune)

React + Vite + TypeScript — registre local + UI style e-gov (Justicia / Modernize).

```bash
cd frontends/civil-officer
npm install
npm run dev
```

- URL : [http://localhost:5176/](http://localhost:5176/)
- Démo : `officier` / `DemoCivil2026!`

Ouvrir dans Edge :

```powershell
Start-Process msedge http://localhost:5176/
```

## Fonctionnalités

- Tableau de bord : cartes cliquables (population, nouveaux-nés, actes)
- Pages **manage-*** : liste, recherche, export CSV/Excel/PDF, détail + impression
- Formulaires d’enregistrement (**+ Ajouter**) : naissances, décès, mariages, divorces, adoptions, déplacements, documents, recensement
- Cascade géographique (province → … → rue) via API `/api/v1/geo/*`
- Topbar : responsable, notifications, profil (photo, mot de passe, thème clair/sombre)
- Boutons : **Ajouter** bleu · **Enregistrer** rouge · **Suivant** jaune

## Routes principales

| Route | Rôle |
|-------|------|
| `/` | Tableau de bord |
| `/population`, `/newborns` | Listes population / nouveaux-nés |
| `/manage/naissance`, `/manage/deces`, … | Listes manage (style Justicia) |
| `/births`, `/deaths`, `/marriages`, … | Formulaires de création |
| `/territory` | Territoire / géographie |
| `/acts`, `/search` | Registre global / recherche |

Les données sont persistées dans `localStorage`. Chaque acte tente aussi un `POST /api/v1/civil/{endpoint}` (proxy Vite → `localhost:8000`) ; l’échec API est ignoré en démo.
