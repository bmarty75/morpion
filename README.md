# Morpion

Un morpion en Node.js, sans aucune dependance : deux joueurs sur le meme clavier,
ou face a un ordinateur qui joue en minimax.

## Demarrer

```bash
node server.js          # puis http://localhost:3000
npm test                # tests unitaires, dont la preuve que l IA ne perd jamais
npm run test:coverage   # idem + rapport de couverture, echoue sous les seuils
npm run check           # verification de syntaxe de tous les fichiers JS
```

Node 20 ou plus. Rien a installer : le serveur utilise `node:http`, le front est
en modules ES natifs, les tests en `node:test`.

## Structure

```
morpion/
├── server.js               serveur statique (sert public/ et src/)
├── src/
│   ├── game.js             regles : grille, coups, detection d alignement
│   ├── game.test.js        tests des regles
│   ├── ai.js               minimax + elagage alpha-beta, trois niveaux
│   └── ai.test.js          tests de l IA (niveaux, hasard simule, exhaustif)
├── test/
│   └── server.test.js      tests HTTP du serveur (statuts, types, securite)
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js              rendu et deroulement de la partie
└── .github/workflows/
    └── ci-cd.yml           integration et deploiement continus
```

## CI/CD

Le workflow [`.github/workflows/ci-cd.yml`](.github/workflows/ci-cd.yml) tourne a
chaque pull request et a chaque push sur `main` :

| Job                        | Quand            | Ce qu il fait                                                    |
| -------------------------- | ---------------- | ---------------------------------------------------------------- |
| Tests (Node 20 / 22 / 24)  | toujours         | `npm run check` puis `npm test`                                  |
| Couverture de code         | toujours         | `npm run test:coverage` (lignes 90 %, branches 85 %, fonctions 70 %) |
| Demarrage du serveur       | toujours         | lance `npm start` et verifie que chaque ressource repond 200     |
| Deploiement GitHub Pages   | push sur `main`  | publie `public/` + `src/*.js`, puis verifie le site en ligne     |

Le deploiement n attend que la reussite des trois autres jobs. Le jeu tournant
entierement dans le navigateur, un hebergement statique suffit : les chemins du
front sont relatifs pour fonctionner aussi bien a la racine (`server.js`) que
sous `https://<utilisateur>.github.io/<depot>/`.

**A faire une fois** : dans le depot GitHub, *Settings → Pages → Build and
deployment → Source : GitHub Actions*.

Le point important : `src/game.js` et `src/ai.js` sont importes **tels quels**
par le navigateur (`import ... from '/src/game.js'`) et par les tests. Une seule
implementation des regles, testee cote serveur, executee cote client — pas de
build, pas de duplication.

## La logique

`game.js` n expose que des fonctions pures. `jouer(partie, index)` ne modifie
rien : elle renvoie une nouvelle partie gelee. La consequence pratique, c est que
l historique des coups suffit a rejouer n importe quelle partie, et qu un
`undo` se ramene a garder les etats precedents dans un tableau.

`resultat(grille)` renvoie `{ etat, gagnant, ligne }`. C est `ligne` qui permet a
l interface de barrer les trois cases gagnantes au bon endroit.

## L IA

Le morpion compte 255 168 parties possibles : l arbre entier tient en memoire, on
explore donc jusqu aux feuilles sans heuristique. Le score d une feuille vaut
`10 - profondeur` pour une victoire et `profondeur - 10` pour une defaite, ce qui
pousse l IA a gagner le plus tot possible et a repousser la defaite le plus loin
possible — sans ca, elle joue des coups corrects mais qui ont l air passifs.

Les niveaux ne changent pas l algorithme, seulement la part de coups optimaux :
`facile` joue au hasard, `moyen` joue le meilleur coup 7 fois sur 10, `imbattable`
toujours. `src/ai.test.js` verifie exhaustivement, sur toutes les parties
adverses possibles, qu elle ne perd jamais — qu elle joue X ou O, qu elle
commence ou non.

## Pistes si tu veux pousser

- **Multijoueur en reseau** : `ws` ou `socket.io` cote serveur, une `Map` de
  parties par code de salon. `game.js` sert alors d arbitre cote serveur, ce qui
  evite de faire confiance au client.
- **Persistance** : PostgreSQL avec une table `partie (id, historique, gagnant)`.
  L historique de coups suffit a tout reconstituer.
- **Grille NxN** : `LIGNES` est la seule constante a generer dynamiquement, mais
  le minimax exhaustif ne tient plus des le 4x4 — il faut une profondeur limite
  et une fonction d evaluation.
