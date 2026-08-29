/**
 * De dónde sale la foto de una publicación.
 *
 * Se prueba la resolución y **la coherencia entre la semilla y el mapa**, que
 * es donde esto se rompe de verdad: una foto empaquetada cuya clave no coincide
 * con ningún `path` de `lib/posts` no la ve nadie, no da ningún error y engorda
 * el paquete. Es un fallo silencioso por definición, así que o lo caza una
 * regla o no lo caza nada.
 */

import { describe, expect, it } from 'vitest';

import { BUNDLED_PHOTOS, REMOTE_PHOTOS, resolvePhoto } from './photos';
import { SEED_POSTS } from './posts';

/* Un `require` de Metro devuelve un número; en Node no hay tal cosa, así que
   las pruebas usan un valor cualquiera para representar «un fichero». */
const FILE = 42 as never;

describe('resolver la foto', () => {
  const FICHERO = { 'posts/x.jpg': FILE };
  const URL = { 'posts/x.jpg': 'https://cdn/x.png' };

  it('el carrete del tutor gana a todo lo demás', () => {
    /* Si acaba de elegir una foto, esa es la foto, aunque la publicación
       arrastre todavía la ruta de la anterior. */
    expect(resolvePhoto(FICHERO, URL, { uri: 'file:///nueva.jpg', path: 'posts/x.jpg' })).toEqual({
      uri: 'file:///nueva.jpg',
    });
  });

  it('el fichero empaquetado gana a la URL', () => {
    /* Es el escalón que ordena la transición: el día que las fotos se
       empaqueten, ganan solas sin tener que acordarse de borrar las URL. */
    expect(resolvePhoto(FICHERO, URL, { uri: null, path: 'posts/x.jpg' })).toBe(FILE);
  });

  it('sin fichero, tira de la URL', () => {
    expect(resolvePhoto({}, URL, { uri: null, path: 'posts/x.jpg' })).toEqual({
      uri: 'https://cdn/x.png',
    });
  });

  it('sin nada, devuelve nulo para que se dibuje la escena', () => {
    expect(resolvePhoto({}, {}, { uri: null, path: 'posts/x.jpg' })).toBeNull();
  });
});

describe('el mapa de fotos empaquetadas', () => {
  const paths = new Set(SEED_POSTS.flatMap((post) => post.photos.map((photo) => photo.path)));

  it('no tiene ninguna entrada que no use ninguna publicación', () => {
    const huérfanas = [...Object.keys(BUNDLED_PHOTOS), ...Object.keys(REMOTE_PHOTOS)].filter(
      (key) => !paths.has(key),
    );
    expect(
      huérfanas,
      `Fotos declaradas que ninguna publicación pide:\n${huérfanas.join('\n')}`,
    ).toEqual([]);
  });

  it('todas las URL provisionales son https', () => {
    /* Una `http://` la bloquea el transporte seguro de iOS sin decir nada: la
       foto no sale y no hay error en ninguna parte. */
    for (const [path, url] of Object.entries(REMOTE_PHOTOS)) {
      expect(url, `${path} no es https`).toMatch(/^https:\/\//);
    }
  });

  it('cada publicación de la semilla dice qué foto quiere', () => {
    /* No se exige que el fichero exista —el feed funciona con dibujos—, pero sí
       que la ruta esté puesta y sea la de una foto: sin `path` no hay forma de
       enchufar nunca la imagen de verdad. */
    for (const path of paths) {
      expect(path, `«${path}» no parece la ruta de una foto`).toMatch(/^posts\/[a-z0-9-]+\.jpg$/);
    }
  });
});
