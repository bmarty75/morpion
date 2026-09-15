/**
 * Interface du morpion.
 *
 * Les regles ne sont pas reecrites ici : ce sont les modules /src, ceux-la
 * memes que couvrent les tests `npm test`.
 */

// Chemins relatifs : fonctionnent avec server.js comme sous un sous-dossier (GitHub Pages).
import { coupValide, jouer, nouvellePartie, resultat } from './src/game.js';
import { choisirCoup } from './src/ai.js';

const NOMS = { X: 'bleu', O: 'rouge' };
const DELAI_ORDINATEUR = 420;

const elements = {
  plateau: document.getElementById('plateau'),
  trace: document.getElementById('trace'),
  statut: document.getElementById('statut'),
  niveauGroupe: document.getElementById('groupe-niveau'),
  scoreX: document.getElementById('score-x'),
  scoreO: document.getElementById('score-o'),
  scoreNul: document.getElementById('score-nul'),
  rejouer: document.getElementById('rejouer'),
  raz: document.getElementById('raz'),
};

const etat = {
  partie: nouvellePartie('X'),
  premierJoueur: 'X',
  adversaire: 'humain',
  niveau: 'moyen',
  scores: { X: 0, O: 0, nul: 0 },
  verrou: false,
};

/* --- Dessin --------------------------------------------------------------- */

const SVG = 'http://www.w3.org/2000/svg';

function noeud(nom, attributs) {
  const element = document.createElementNS(SVG, nom);
  for (const [cle, valeur] of Object.entries(attributs)) {
    element.setAttribute(cle, valeur);
  }
  return element;
}

/** Une marque au stylo : deux traits pour la croix, une boucle pour le rond. */
function dessinerMarque(marque) {
  const svg = noeud('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' });

  if (marque === 'X') {
    // Deux traits jamais parfaitement droits, comme a la main.
    svg.append(
      noeud('path', { class: 'tracer', d: 'M 19 18 C 40 41, 62 62, 82 83' }),
      noeud('path', { class: 'tracer', d: 'M 82 18 C 61 40, 39 61, 18 83' }),
    );
  } else {
    svg.append(
      noeud('path', {
        class: 'tracer',
        d: 'M 62 20 C 24 12, 8 52, 26 74 C 44 95, 88 84, 86 52 C 85 33, 74 22, 60 19',
      }),
    );
  }
  return svg;
}

/** Amorce l'animation : le trait s'ecrit depuis son debut. */
function amorcerTrace(svg) {
  for (const trace of svg.querySelectorAll('.tracer')) {
    const longueur = trace.getTotalLength();
    trace.style.strokeDasharray = longueur;
    trace.style.setProperty('--longueur', longueur);
  }
}

function etiquette(index, marque) {
  const ligne = Math.floor(index / 3) + 1;
  const colonne = (index % 3) + 1;
  const place = `ligne ${ligne}, colonne ${colonne}`;
  return marque ? `${place}, ${NOMS[marque]}` : `${place}, libre`;
}

function construirePlateau() {
  for (let index = 0; index < 9; index += 1) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'case';
    bouton.dataset.index = String(index);
    bouton.addEventListener('click', () => tenterCoup(index));
    elements.plateau.append(bouton);
  }
}

function rendre({ nouvelleMarque = null } = {}) {
  const { grille } = etat.partie;
  const fin = resultat(grille);

  elements.plateau.querySelectorAll('.case').forEach((bouton) => {
    const index = Number(bouton.dataset.index);
    const marque = grille[index];
    bouton.setAttribute('aria-label', etiquette(index, marque));
    bouton.disabled = marque !== null || fin.etat !== 'en-cours' || etat.verrou;

    if (marque === bouton.dataset.marque) return;

    bouton.replaceChildren();
    if (marque) {
      bouton.dataset.marque = marque;
      const svg = dessinerMarque(marque);
      bouton.append(svg);
      if (index === nouvelleMarque) amorcerTrace(svg);
    } else {
      delete bouton.dataset.marque;
    }
  });

  dessinerVictoire(fin);
  ecrireStatut(fin);
}

function dessinerVictoire(fin) {
  elements.trace.replaceChildren();
  if (fin.etat !== 'victoire') {
    delete elements.trace.dataset.gagnant;
    return;
  }

  const centre = (i) => ({ x: (i % 3) * 100 + 50, y: Math.floor(i / 3) * 100 + 50 });
  const depart = centre(fin.ligne[0]);
  const arrivee = centre(fin.ligne[2]);

  // On prolonge le trait un peu au-dela des deux marques, comme on barre une ligne.
  const dx = arrivee.x - depart.x;
  const dy = arrivee.y - depart.y;
  const norme = Math.hypot(dx, dy);
  const debord = 32;
  const ux = (dx / norme) * debord;
  const uy = (dy / norme) * debord;

  const ligne = noeud('line', {
    x1: depart.x - ux,
    y1: depart.y - uy,
    x2: arrivee.x + ux,
    y2: arrivee.y + uy,
  });
  const longueur = norme + debord * 2;
  ligne.style.strokeDasharray = longueur;
  ligne.style.setProperty('--longueur', longueur);

  elements.trace.dataset.gagnant = fin.gagnant;
  elements.trace.append(ligne);
}

function ecrireStatut(fin) {
  const contreOrdinateur = etat.adversaire === 'ordinateur';

  if (fin.etat === 'victoire') {
    elements.statut.dataset.ton = NOMS[fin.gagnant];
    elements.statut.textContent = contreOrdinateur
      ? fin.gagnant === 'X'
        ? 'Trois alignes. Tu gagnes.'
        : 'Trois alignes pour l ordinateur.'
      : `Trois alignes. Le ${NOMS[fin.gagnant]} gagne.`;
    return;
  }

  if (fin.etat === 'nul') {
    delete elements.statut.dataset.ton;
    elements.statut.textContent = 'Grille pleine, personne ne marque.';
    return;
  }

  const joueur = etat.partie.joueur;
  elements.statut.dataset.ton = NOMS[joueur];
  if (contreOrdinateur) {
    elements.statut.textContent = joueur === 'X' ? 'A toi de jouer.' : 'L ordinateur reflechit.';
  } else {
    elements.statut.textContent = `Au ${NOMS[joueur]} de jouer.`;
  }
}

/* --- Deroulement ---------------------------------------------------------- */

function tenterCoup(index) {
  if (etat.verrou || !coupValide(etat.partie, index)) return;

  etat.partie = jouer(etat.partie, index);
  const fin = resultat(etat.partie.grille);

  if (fin.etat !== 'en-cours') {
    compterPoint(fin);
    rendre({ nouvelleMarque: index });
    return;
  }

  const ordinateurEnchaine = etat.adversaire === 'ordinateur' && etat.partie.joueur === 'O';
  etat.verrou = ordinateurEnchaine;
  rendre({ nouvelleMarque: index });

  if (ordinateurEnchaine) setTimeout(jouerOrdinateur, DELAI_ORDINATEUR);
}

function jouerOrdinateur() {
  const coup = choisirCoup(etat.partie.grille, etat.partie.joueur, etat.niveau);
  etat.verrou = false;
  if (coup === null) return;

  etat.partie = jouer(etat.partie, coup);
  const fin = resultat(etat.partie.grille);
  if (fin.etat !== 'en-cours') compterPoint(fin);
  rendre({ nouvelleMarque: coup });
}

function compterPoint(fin) {
  if (fin.etat === 'victoire') etat.scores[fin.gagnant] += 1;
  else etat.scores.nul += 1;
  afficherScores();
}

function afficherScores() {
  elements.scoreX.textContent = etat.scores.X;
  elements.scoreO.textContent = etat.scores.O;
  elements.scoreNul.textContent = etat.scores.nul;
}

/** Nouvelle manche : celui qui n'a pas commence la precedente ouvre. */
function relancer({ alterner = true } = {}) {
  if (alterner) etat.premierJoueur = etat.premierJoueur === 'X' ? 'O' : 'X';
  etat.partie = nouvellePartie(etat.premierJoueur);

  const ordinateurOuvre = etat.adversaire === 'ordinateur' && etat.premierJoueur === 'O';
  etat.verrou = ordinateurOuvre;
  rendre();

  if (ordinateurOuvre) setTimeout(jouerOrdinateur, DELAI_ORDINATEUR);
}

/* --- Reglages ------------------------------------------------------------- */

document.getElementById('choix-adversaire').addEventListener('change', (evenement) => {
  etat.adversaire = evenement.target.value;
  elements.niveauGroupe.hidden = etat.adversaire !== 'ordinateur';
  etat.premierJoueur = 'O'; // la manche suivante s'ouvre donc sur X, le joueur humain
  relancer();
});

document.getElementById('choix-niveau').addEventListener('change', (evenement) => {
  etat.niveau = evenement.target.value;
});

elements.rejouer.addEventListener('click', () => relancer());

elements.raz.addEventListener('click', () => {
  etat.scores = { X: 0, O: 0, nul: 0 };
  afficherScores();
});

construirePlateau();
afficherScores();
rendre();
