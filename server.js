/**
 * Serveur de fichiers statiques, sans dependance.
 *
 * Il expose deux dossiers :
 *   /            -> public/   (la page, le style, le script du navigateur)
 *   /src/...     -> src/      (les modules de jeu, importes tels quels par le front)
 *
 * C'est ce qui permet au navigateur et aux tests d'utiliser exactement le
 * meme code de regles, sans build ni duplication.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PUBLIC = join(RACINE, 'public');
const SOURCES = join(RACINE, 'src');
const PORT = Number(process.env.PORT ?? 3000);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Traduit une URL en chemin disque, ou null si elle sort des dossiers autorises.
 * @throws {URIError} si l'URL contient un encodage invalide (ex. `/%`).
 */
export function resoudre(url) {
  const chemin = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  if (chemin === '/') return join(PUBLIC, 'index.html');

  const base = chemin.startsWith('/src/') ? SOURCES : PUBLIC;
  const relatif = chemin.startsWith('/src/') ? chemin.slice('/src/'.length) : chemin.slice(1);
  const cible = resolve(base, relatif);

  return cible === base || cible.startsWith(base + sep) ? cible : null;
}

export function creerServeur() {
  return createServer(repondre);
}

async function repondre(requete, reponse) {
  if (requete.method !== 'GET' && requete.method !== 'HEAD') {
    reponse.writeHead(405, { Allow: 'GET, HEAD' }).end('Methode non autorisee');
    return;
  }

  let fichier;
  try {
    fichier = resoudre(requete.url);
  } catch {
    reponse.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Requete invalide');
    return;
  }
  if (fichier === null) {
    reponse.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Acces refuse');
    return;
  }

  try {
    const contenu = await readFile(fichier);
    reponse.writeHead(200, {
      'Content-Type': TYPES[extname(fichier)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    reponse.end(requete.method === 'HEAD' ? undefined : contenu);
  } catch (erreur) {
    if (erreur.code === 'ENOENT' || erreur.code === 'EISDIR') {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Page introuvable');
      return;
    }
    console.error(erreur);
    reponse.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Erreur serveur');
  }
}

// On n'ecoute que si le fichier est lance directement (`node server.js`),
// pas quand les tests l'importent.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  creerServeur().listen(PORT, () => {
    console.log(`Morpion en ligne sur http://localhost:${PORT}`);
  });
}
