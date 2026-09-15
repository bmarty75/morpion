import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { creerServeur, resoudre } from '../server.js';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));

describe('resoudre', () => {
  test('la racine sert public/index.html', () => {
    assert.equal(resoudre('/'), join(RACINE, 'public', 'index.html'));
  });

  test('les fichiers publics viennent de public/', () => {
    assert.equal(resoudre('/style.css'), join(RACINE, 'public', 'style.css'));
  });

  test('/src/... vient de src/', () => {
    assert.equal(resoudre('/src/game.js'), join(RACINE, 'src', 'game.js'));
  });

  test('la query string est ignoree', () => {
    assert.equal(resoudre('/app.js?v=2'), join(RACINE, 'public', 'app.js'));
  });

  test('refuse de sortir des dossiers autorises', () => {
    assert.equal(resoudre('/src/..%2fserver.js'), null);
    assert.equal(resoudre('/..%2fserver.js'), null);
    assert.equal(resoudre('/src/..%2f..%2fpackage.json'), null);
  });

  test('un encodage invalide leve une URIError', () => {
    assert.throws(() => resoudre('/%'), URIError);
  });
});

describe('serveur HTTP', () => {
  let serveur;
  let port;

  before(async () => {
    serveur = creerServeur();
    await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
    port = serveur.address().port;
  });

  after(() => new Promise((ok) => serveur.close(ok)));

  /** Requete HTTP brute : le chemin part tel quel, sans normalisation. */
  const envoyer = (chemin, methode = 'GET') =>
    new Promise((ok, echec) => {
      const req = request({ host: '127.0.0.1', port, path: chemin, method: methode }, (res) => {
        const morceaux = [];
        res.on('data', (m) => morceaux.push(m));
        res.on('end', () =>
          ok({ statut: res.statusCode, entetes: res.headers, corps: Buffer.concat(morceaux).toString('utf8') }),
        );
      });
      req.on('error', echec);
      req.end();
    });

  test('GET / renvoie la page HTML', async () => {
    const rep = await envoyer('/');
    assert.equal(rep.statut, 200);
    assert.equal(rep.entetes['content-type'], 'text/html; charset=utf-8');
    assert.equal(rep.entetes['cache-control'], 'no-cache');
    assert.match(rep.corps, /<title>Morpion<\/title>/);
  });

  test('GET /style.css renvoie du CSS', async () => {
    const rep = await envoyer('/style.css');
    assert.equal(rep.statut, 200);
    assert.equal(rep.entetes['content-type'], 'text/css; charset=utf-8');
  });

  test('GET /src/game.js renvoie exactement le module teste', async () => {
    const rep = await envoyer('/src/game.js');
    assert.equal(rep.statut, 200);
    assert.equal(rep.entetes['content-type'], 'text/javascript; charset=utf-8');
    assert.equal(rep.corps, await readFile(join(RACINE, 'src', 'game.js'), 'utf8'));
  });

  test('HEAD renvoie les en-tetes sans corps', async () => {
    const rep = await envoyer('/', 'HEAD');
    assert.equal(rep.statut, 200);
    assert.equal(rep.entetes['content-type'], 'text/html; charset=utf-8');
    assert.equal(rep.corps, '');
  });

  test('les autres methodes sont refusees en 405', async () => {
    for (const methode of ['POST', 'PUT', 'DELETE']) {
      const rep = await envoyer('/', methode);
      assert.equal(rep.statut, 405, methode);
      assert.equal(rep.entetes.allow, 'GET, HEAD');
    }
  });

  test('un fichier absent renvoie 404', async () => {
    assert.equal((await envoyer('/inexistant.js')).statut, 404);
  });

  test('un dossier renvoie 404', async () => {
    assert.equal((await envoyer('/src/')).statut, 404);
  });

  test('une tentative de traversee de dossier renvoie 403', async () => {
    const rep = await envoyer('/src/..%2fserver.js');
    assert.equal(rep.statut, 403);
    assert.doesNotMatch(rep.corps, /createServer/);
  });

  test('une URL mal encodee renvoie 400 sans faire tomber le serveur', async () => {
    assert.equal((await envoyer('/%')).statut, 400);
    assert.equal((await envoyer('/')).statut, 200);
  });
});
