import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  JOUEURS,
  LIGNES,
  adversaire,
  coupValide,
  coupsPossibles,
  grilleVide,
  jouer,
  nouvellePartie,
  resultat,
  versTexte,
} from './game.js';

/** Construit une grille a partir d'une chaine de 9 caracteres : 'X', 'O' ou '.'. */
const g = (texte) => [...texte].map((c) => (c === '.' ? null : c));

/** Joue une suite de coups depuis une partie neuve. */
const jouerSuite = (coups, premier = 'X') => coups.reduce(jouer, nouvellePartie(premier));

describe('constantes', () => {
  test('LIGNES contient les 8 alignements, sans doublon', () => {
    assert.equal(LIGNES.length, 8);
    const cles = new Set(LIGNES.map((ligne) => ligne.join(',')));
    assert.equal(cles.size, 8);
    for (const ligne of LIGNES) {
      assert.equal(ligne.length, 3);
      for (const i of ligne) assert.ok(i >= 0 && i < 9);
    }
  });

  test('LIGNES et JOUEURS sont geles', () => {
    assert.ok(Object.isFrozen(LIGNES));
    assert.ok(Object.isFrozen(JOUEURS));
    assert.deepEqual([...JOUEURS], ['X', 'O']);
  });
});

describe('grilleVide', () => {
  test('renvoie 9 cases a null', () => {
    assert.deepEqual(grilleVide(), Array(9).fill(null));
  });

  test('renvoie une nouvelle grille a chaque appel', () => {
    assert.notEqual(grilleVide(), grilleVide());
  });
});

describe('nouvellePartie', () => {
  test('une partie neuve a 9 cases libres', () => {
    const partie = nouvellePartie();
    assert.equal(partie.joueur, 'X');
    assert.equal(coupsPossibles(partie.grille).length, 9);
    assert.equal(resultat(partie.grille).etat, 'en-cours');
    assert.deepEqual([...partie.historique], []);
  });

  test('O peut commencer', () => {
    assert.equal(nouvellePartie('O').joueur, 'O');
  });

  test('un joueur inconnu est refuse', () => {
    assert.throws(() => nouvellePartie('Z'), /Joueur inconnu : Z/);
    assert.throws(() => nouvellePartie(null), /Joueur inconnu/);
  });

  test('la partie, sa grille et son historique sont geles', () => {
    const partie = nouvellePartie();
    assert.ok(Object.isFrozen(partie));
    assert.ok(Object.isFrozen(partie.grille));
    assert.ok(Object.isFrozen(partie.historique));
  });
});

describe('adversaire', () => {
  test('alterne X et O', () => {
    assert.equal(adversaire('X'), 'O');
    assert.equal(adversaire('O'), 'X');
  });
});

describe('coupsPossibles', () => {
  test('liste les indices libres dans l ordre', () => {
    assert.deepEqual(coupsPossibles(g('X.O.X.O..')), [1, 3, 5, 7, 8]);
  });

  test('renvoie une liste vide sur une grille pleine', () => {
    assert.deepEqual(coupsPossibles(g('XOXXOOOXX')), []);
  });
});

describe('resultat', () => {
  for (const ligne of LIGNES) {
    test(`detecte la victoire sur l alignement ${ligne.join('-')}`, () => {
      for (const joueur of JOUEURS) {
        const grille = grilleVide();
        for (const i of ligne) grille[i] = joueur;
        assert.deepEqual(resultat(grille), { etat: 'victoire', gagnant: joueur, ligne });
      }
    });
  }

  test('une ligne detecte la victoire et renvoie l alignement', () => {
    const fin = resultat(g('XXXOO....'));
    assert.equal(fin.etat, 'victoire');
    assert.equal(fin.gagnant, 'X');
    assert.deepEqual(fin.ligne, [0, 1, 2]);
  });

  test('une diagonale detecte la victoire', () => {
    assert.equal(resultat(g('OXX.OX..O')).gagnant, 'O');
  });

  test('une grille pleine sans alignement est nulle', () => {
    assert.deepEqual(resultat(g('XOXXOOOXX')), { etat: 'nul', gagnant: null, ligne: null });
  });

  test('une grille pleine AVEC alignement est une victoire, pas un nul', () => {
    const fin = resultat(g('XOXOXOOXX'));
    assert.equal(fin.etat, 'victoire');
    assert.equal(fin.gagnant, 'X');
  });

  test('trois cases vides alignees ne comptent pas comme une victoire', () => {
    assert.equal(resultat(grilleVide()).etat, 'en-cours');
  });

  test('un alignement mixte ne gagne pas', () => {
    assert.equal(resultat(g('XXO......')).etat, 'en-cours');
  });
});

describe('coupValide', () => {
  const partie = jouer(nouvellePartie(), 4);

  test('accepte une case libre', () => {
    assert.equal(coupValide(partie, 0), true);
    assert.equal(coupValide(partie, 8), true);
  });

  test('refuse une case prise', () => {
    assert.equal(coupValide(partie, 4), false);
  });

  test('refuse les indices hors grille ou non entiers', () => {
    for (const index of [-1, 9, 1.5, NaN, Infinity, '0', null, undefined]) {
      assert.equal(coupValide(partie, index), false, `index ${String(index)}`);
    }
  });

  test('refuse tout coup une fois la partie gagnee', () => {
    // X : 0, 1, 2 -- O : 3, 4
    const gagnee = jouerSuite([0, 3, 1, 4, 2]);
    assert.equal(resultat(gagnee.grille).etat, 'victoire');
    assert.equal(coupValide(gagnee, 8), false);
  });
});

describe('jouer', () => {
  test('ne modifie pas la partie d origine', () => {
    const depart = nouvellePartie();
    const apres = jouer(depart, 4);

    assert.equal(depart.grille[4], null);
    assert.equal(apres.grille[4], 'X');
    assert.equal(apres.joueur, 'O');
    assert.deepEqual([...apres.historique], [4]);
    assert.deepEqual([...depart.historique], []);
  });

  test('alterne les joueurs et accumule l historique', () => {
    const partie = jouerSuite([4, 0, 8]);
    assert.deepEqual(partie.grille, g('O...X...X'));
    assert.equal(partie.joueur, 'O');
    assert.deepEqual([...partie.historique], [4, 0, 8]);
  });

  test('la partie renvoyee est gelee', () => {
    const partie = jouer(nouvellePartie(), 0);
    assert.ok(Object.isFrozen(partie));
    assert.ok(Object.isFrozen(partie.grille));
    assert.ok(Object.isFrozen(partie.historique));
  });

  test('une case deja prise est refusee', () => {
    const partie = jouer(nouvellePartie(), 0);
    assert.throws(() => jouer(partie, 0), /Coup impossible : case 0/);
  });

  test('une case hors grille est refusee', () => {
    assert.throws(() => jouer(nouvellePartie(), 9), /Coup impossible/);
  });

  test('on ne peut plus jouer apres une victoire', () => {
    const gagnee = jouerSuite([0, 3, 1, 4, 2]);
    assert.throws(() => jouer(gagnee, 8), /Coup impossible/);
  });

  test('l historique suffit a rejouer la partie', () => {
    const originale = jouerSuite([4, 0, 2, 6, 3, 5, 1, 7, 8]);
    const rejouee = jouerSuite([...originale.historique]);
    assert.deepEqual(rejouee, originale);
  });
});

describe('versTexte', () => {
  test('dessine une grille vide', () => {
    assert.equal(
      versTexte(grilleVide()),
      ['   |   |   ', '---+---+---', '   |   |   ', '---+---+---', '   |   |   '].join('\n'),
    );
  });

  test('place les marques aux bons endroits', () => {
    assert.equal(
      versTexte(g('X.O.X...O')),
      [' X |   | O ', '---+---+---', '   | X |   ', '---+---+---', '   |   | O '].join('\n'),
    );
  });
});
