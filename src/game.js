/**
 * Logique pure du morpion.
 *
 * Aucune dependance, aucun acces au DOM ni au reseau : ce module est importe
 * tel quel par le serveur, par les tests `node --test` et par le navigateur.
 * Toutes les fonctions sont pures et ne modifient jamais leurs arguments.
 */

/** Les 8 alignements gagnants, en indices de 0 a 8. */
export const LIGNES = Object.freeze([
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]);

export const JOUEURS = Object.freeze(['X', 'O']);

/** Grille vide : 9 cases a `null`. */
export function grilleVide() {
  return Array(9).fill(null);
}

/**
 * Cree une partie.
 * @param {'X'|'O'} premierJoueur
 */
export function nouvellePartie(premierJoueur = 'X') {
  if (!JOUEURS.includes(premierJoueur)) {
    throw new Error(`Joueur inconnu : ${premierJoueur}`);
  }
  return Object.freeze({
    grille: Object.freeze(grilleVide()),
    joueur: premierJoueur,
    historique: Object.freeze([]),
  });
}

/** L'autre joueur. */
export function adversaire(joueur) {
  return joueur === 'X' ? 'O' : 'X';
}

/** Indices des cases encore libres. */
export function coupsPossibles(grille) {
  const libres = [];
  for (let i = 0; i < grille.length; i += 1) {
    if (grille[i] === null) libres.push(i);
  }
  return libres;
}

/**
 * Etat de la grille.
 * @returns {{etat: 'en-cours'|'victoire'|'nul', gagnant: ?string, ligne: ?number[]}}
 */
export function resultat(grille) {
  for (const ligne of LIGNES) {
    const [a, b, c] = ligne;
    if (grille[a] !== null && grille[a] === grille[b] && grille[a] === grille[c]) {
      return { etat: 'victoire', gagnant: grille[a], ligne };
    }
  }
  if (coupsPossibles(grille).length === 0) {
    return { etat: 'nul', gagnant: null, ligne: null };
  }
  return { etat: 'en-cours', gagnant: null, ligne: null };
}

/** Le coup est-il jouable dans cette partie ? */
export function coupValide(partie, index) {
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < 9 &&
    partie.grille[index] === null &&
    resultat(partie.grille).etat === 'en-cours'
  );
}

/**
 * Joue un coup et renvoie une NOUVELLE partie.
 * @throws {Error} si la case est prise, hors grille, ou la partie terminee.
 */
export function jouer(partie, index) {
  if (!coupValide(partie, index)) {
    throw new Error(`Coup impossible : case ${index}`);
  }
  const grille = [...partie.grille];
  grille[index] = partie.joueur;
  return Object.freeze({
    grille: Object.freeze(grille),
    joueur: adversaire(partie.joueur),
    historique: Object.freeze([...partie.historique, index]),
  });
}

/** Rendu texte de la grille, pratique pour deboguer en console. */
export function versTexte(grille) {
  const c = (i) => grille[i] ?? ' ';
  return [
    ` ${c(0)} | ${c(1)} | ${c(2)} `,
    '---+---+---',
    ` ${c(3)} | ${c(4)} | ${c(5)} `,
    '---+---+---',
    ` ${c(6)} | ${c(7)} | ${c(8)} `,
  ].join('\n');
}
