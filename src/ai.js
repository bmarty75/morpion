/**
 * IA du morpion : minimax avec elagage alpha-beta.
 *
 * Le morpion a 255 168 parties possibles, l'arbre complet tient largement en
 * memoire : on explore jusqu'aux feuilles, sans heuristique ni profondeur
 * limite. La profondeur sert seulement a departager les issues equivalentes,
 * pour que l'IA gagne le plus vite possible et perde le plus tard possible.
 */

import { adversaire, coupsPossibles, resultat } from './game.js';

export const NIVEAUX = Object.freeze({
  facile: { libelle: 'Facile', partBest: 0 },
  moyen: { libelle: 'Moyen', partBest: 0.7 },
  imbattable: { libelle: 'Imbattable', partBest: 1 },
});

/**
 * Choisit un coup pour `joueur`.
 * @param {Array<?string>} grille
 * @param {'X'|'O'} joueur
 * @param {keyof NIVEAUX} niveau
 * @returns {?number} indice de la case, ou null si la partie est finie
 */
export function choisirCoup(grille, joueur, niveau = 'imbattable') {
  const libres = coupsPossibles(grille);
  if (libres.length === 0 || resultat(grille).etat !== 'en-cours') return null;

  const config = NIVEAUX[niveau];
  if (!config) throw new Error(`Niveau inconnu : ${niveau}`);

  if (Math.random() >= config.partBest) {
    return libres[Math.floor(Math.random() * libres.length)];
  }
  return meilleurCoup(grille, joueur);
}

/** Le meilleur coup possible pour `joueur`, au sens du minimax. */
export function meilleurCoup(grille, joueur) {
  let meilleurScore = -Infinity;
  let choix = null;

  for (const coup of coupsPossibles(grille)) {
    const suivante = [...grille];
    suivante[coup] = joueur;
    const score = minimax(suivante, joueur, adversaire(joueur), 1, -Infinity, Infinity);
    if (score > meilleurScore) {
      meilleurScore = score;
      choix = coup;
    }
  }
  return choix;
}

/**
 * @param {Array<?string>} grille etat courant
 * @param {'X'|'O'} moi joueur dont on maximise le score
 * @param {'X'|'O'} aJouer joueur qui doit jouer maintenant
 * @param {number} profondeur nombre de coups depuis la racine
 */
function minimax(grille, moi, aJouer, profondeur, alpha, beta) {
  const fin = resultat(grille);
  if (fin.etat === 'victoire') {
    return fin.gagnant === moi ? 10 - profondeur : profondeur - 10;
  }
  if (fin.etat === 'nul') return 0;

  const maximise = aJouer === moi;
  let meilleur = maximise ? -Infinity : Infinity;

  for (const coup of coupsPossibles(grille)) {
    const suivante = [...grille];
    suivante[coup] = aJouer;
    const score = minimax(suivante, moi, adversaire(aJouer), profondeur + 1, alpha, beta);

    if (maximise) {
      meilleur = Math.max(meilleur, score);
      alpha = Math.max(alpha, score);
    } else {
      meilleur = Math.min(meilleur, score);
      beta = Math.min(beta, score);
    }
    if (beta <= alpha) break;
  }
  return meilleur;
}
