# Bureau d’état civil (RDC)

Portail dédié aux **faits d’état civil** selon la procédure réelle en RDC.

## Lancer

```bash
cd frontends/etat-civil
npm install
npm run dev
```

| Accès | URL | Compte |
|-------|-----|--------|
| Officier / agent | http://localhost:5180/login | `officier` / `DemoCivil2026!` |
| Maternité / santé | http://localhost:5180/sante/login | `hopital` / `DemoSante2026!` |

## Ordre à suivre pour enregistrer

1. Lire **Procédure** → `/procedure`
2. **Qui fait quoi** → `/roles` · **Juge** → `/juge`
3. Canal A : maternité déclare → `/sante` → sync  
   Canal B : saisie directe → `/births` (ou mariage / décès)
4. Officier valide les déclarations santé → `/declarations`
5. Registres : naissances / mariages / décès
6. Actes liés : reconnaissance · adoption (après juge) · divorce (transcription)
7. Mentions, transcriptions, copies & extraits

## Contenu aligné

- 3 registres + actes liés + mentions / copies  
- ID naissance (pas de N° national)  
- Adresse mère + originaire Province → Territoire → Secteur → Village  
- Hors délai / jugement supplétif : référence jugement obligatoire  
- Divorce & adoption : transcription après juge  
- Canal maternité → file officier  

## Hors périmètre

Recensement, biométrie, cartes d’identité, registre population national → SIGPOP `:5176` / `:5183`.
