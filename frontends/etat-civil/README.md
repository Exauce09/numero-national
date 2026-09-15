# Bureau d’état civil (RDC)

Application dédiée aux **faits d’état civil** : naissance, mariage, divorce, décès, adoption, reconnaissance, documents — d’après le cahier `projets.docx`.

## Lancer

```bash
cd frontends/etat-civil
npm install
npm run dev
```

- Bureau officier : [http://localhost:5180/login](http://localhost:5180/login) — `officier` / `DemoCivil2026!`
- Maternité / santé : [http://localhost:5180/sante/login](http://localhost:5180/sante/login) — `hopital` / `DemoSante2026!`

## Flux naissance (cahier)

1. **Structure sanitaire** (maternité) : login → enregistre naissance (smartphone, offline possible) → sync → déclaration transmise à l’officier de la commune (ex. Quartier Golf → Gombe).
2. **Officier d’état civil** : valide la déclaration → registre → remontée provinciale / nationale.
3. **Bureau EC** : l’agent peut aussi enregistrer directement une naissance (même formulaires).

## Aligné sur le cahier

| Exigence | Statut |
|----------|--------|
| Faits EC uniquement (pas recensement / biométrie / N° national) | OK — UI dédiée |
| ID naissance / code dossier (pas NIC) | OK sur formulaire naissance |
| Adresse de la mère | OK |
| Originaire : Province → Territoire → Secteur → Village | OK (`originRural`) |
| Canal maternité → officier | OK `/sante/*` + `/declarations` |
| Mariage, divorce, décès, adoption, documents | OK |

## Encore à renforcer

- Sync offline APK/smartphone maternité (stockage local + push) côté app mobile dédiée
- Remontée automatique province / national après validation (workflow multi-niveaux)
- Mise à jour temps réel population vivante au décès (déjà côté SIGPOP, pas ici)
- Langue / tribu sur fiche enfant (optionnels, à brancher si demandé)
- Nettoyage fichiers legacy non routés (census/biometric pages orphelines)
