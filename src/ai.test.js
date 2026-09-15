import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { adversaire, coupsPossibles, grilleVide, resultat } from './game.js';
import { NIVEAUX, choisirCoup, meilleurCoup } from './ai.js';

/** Construit une grille a partir d'une chaine de 9 caracteres : 'X', 'O' ou '.'. */
const g = (texte) => [...texte].map((c) => (c === '.' ? null : c));

/**
 * Explore toutes les parties ou `ia` joue le meilleur coup et l'adversaire
 * essaie tout. Echoue des qu'une partie se termine par une defaite de l'IA.
 * @returns {number} nombre de parties explorees
 */
function explorerToutesLesParties(ia, premier) {
  let parties = 0;
  const explorer = (grille, aJouer) => {
    const fin = resultat(grille);
    if (fin.etat !== 'en-cours') {
      parties += 1;
      assert.notEqual(fin.gagnant, adversaire(ia), `l IA (${ia}) a perdu sur :\n${grille.join(',')}`);
      return;
    }
    if (aJouer === ia) {
      const suivante = [...grille];
      suivante[meilleurCoup(grille, ia)] = ia;
      explorer(suivante, adversaire(ia));
      return;
    }
    for (const coup of coupsPossibles(grille)) {
      const suivante = [...grille];
      suivante[coup] = aJouer;
      explorer(suivante, ia);
    }
  };
  explorer(grilleVide(), premier);
  return parties;
}

describe('NIVEAUX', () => {
  test('expose les trois niveaux, geles', () => {
    assert.deepEqual(Object.keys(NIVEAUX), ['facile', 'moyen', 'imbattable']);
    assert.ok(Object.isFrozen(NIVEAUX));
  });

  test('la part de coups optimaux croit avec le niveau et reste dans [0, 1]', () => {
    const parts = Object.values(NIVEAUX).map((n) => n.partBest);
    assert.deepEqual(parts, [...parts].sort((a, b) => a - b));
    for (const part of parts) assert.ok(part >= 0 && part <= 1);
    assert.equal(NIVEAUX.facile.partBest, 0);
    assert.equal(NIVEAUX.imbattable.partBest, 1);
  });
});

describe('meilleurCoup', () => {
  test('prend la victoire immediate', () => {
    assert.equal(meilleurCoup(g('XX.O...O.'), 'X'), 2);
  });

  test('bloque la victoire adverse', () => {
    assert.equal(meilleurCoup(g('OO.X.....'), 'X'), 2);
  });

  test('prefere gagner tout de suite plutot que bloquer', () => {
    assert.equal(meilleurCoup(g('XX.OO....'), 'X'), 2);
    assert.equal(meilleurCoup(g('XX.OO...X'), 'O'), 5);
  });

  test('bloque en creant une fourchette', () => {
    // X . O      O menace la diagonale 2-4-6. En bloquant sur 6, X menace
    // . O .      a la fois 0-3-6 et 6-7-8 : O ne peut pas parer les deux.
    // . . X
    const grille = g('X.O.O...X');
    assert.equal(meilleurCoup(grille, 'X'), 6);

    const apres = [...grille];
    apres[6] = 'X';
    const menaces = [3, 7].filter((i) => {
      const essai = [...apres];
      essai[i] = 'X';
      return resultat(essai).gagnant === 'X';
    });
    assert.deepEqual(menaces, [3, 7]);
  });

  test('renvoie null sur une grille pleine', () => {
    assert.equal(meilleurCoup(g('XOXXOOOXX'), 'X'), null);
  });

  test('renvoie toujours une case libre', () => {
    const grille = g('X...O....');
    const coup = meilleurCoup(grille, 'X');
    assert.ok(coupsPossibles(grille).includes(coup));
  });

  test('ne modifie pas la grille recue', () => {
    const grille = Object.freeze(g('X...O....'));
    assert.doesNotThrow(() => meilleurCoup(grille, 'X'));
    assert.deepEqual(grille, g('X...O....'));
  });

  test('deux IA imbattables font toujours match nul', () => {
    let grille = grilleVide();
    let joueur = 'X';
    while (resultat(grille).etat === 'en-cours') {
      grille = [...grille];
      grille[meilleurCoup(grille, joueur)] = joueur;
      joueur = adversaire(joueur);
    }
    assert.equal(resultat(grille).etat, 'nul');
  });

  for (const ia of ['X', 'O']) {
    for (const premier of ['X', 'O']) {
      test(`ne perd jamais (IA = ${ia}, ${premier} commence), sur toutes les parties adverses`, () => {
        const parties = explorerToutesLesParties(ia, premier);
        assert.ok(parties > 0);
      });
    }
  }
});

describe('choisirCoup', () => {
  test('renvoie null si la partie est gagnee, meme avec des cases libres', () => {
    assert.equal(choisirCoup(g('XXXOO....'), 'O'), null);
  });

  test('renvoie null sur une grille pleine', () => {
    assert.equal(choisirCoup(g('XOXXOOOXX'), 'X'), null);
  });

  test('refuse un niveau inconnu', () => {
    assert.throws(() => choisirCoup(grilleVide(), 'X', 'expert'), /Niveau inconnu : expert/);
  });

  test('imbattable par defaut : joue toujours le meilleur coup', (t) => {
    t.mock.method(Math, 'random', () => 0.999);
    const grille = g('XX.OO....');
    assert.equal(choisirCoup(grille, 'O'), meilleurCoup(grille, 'O'));
    assert.equal(choisirCoup(grille, 'O', 'imbattable'), 5);
  });

  test('facile : joue au hasard parmi les cases libres', (t) => {
    const grille = g('XX.OO....'); // libres : 2, 5, 6, 7, 8
    const tirage = t.mock.method(Math, 'random', () => 0);
    assert.equal(choisirCoup(grille, 'O', 'facile'), 2);

    tirage.mock.mockImplementation(() => 0.999);
    assert.equal(choisirCoup(grille, 'O', 'facile'), 8);
  });

  test('facile : ne joue jamais sur une case prise', () => {
    const grille = g('X.O.X.O..');
    const libres = coupsPossibles(grille);
    for (let i = 0; i < 200; i += 1) {
      assert.ok(libres.includes(choisirCoup(grille, 'O', 'facile')));
    }
  });

  test('moyen : meilleur coup sous le seuil de 0,7', (t) => {
    t.mock.method(Math, 'random', () => 0.5);
    assert.equal(choisirCoup(g('XX.OO....'), 'O', 'moyen'), 5);
  });

  test('moyen : coup au hasard au-dessus du seuil de 0,7', (t) => {
    t.mock.method(Math, 'random', () => 0.8);
    // libres : 2, 5, 6, 7, 8 -> floor(0.8 * 5) = 4 -> case 8
    assert.equal(choisirCoup(g('XX.OO....'), 'O', 'moyen'), 8);
  });
});
