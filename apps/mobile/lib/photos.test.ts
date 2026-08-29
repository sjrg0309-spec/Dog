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

import { BUNDLED_PHOTOS, resolvePhoto } from './photos';
import { SEED_POSTS } from './posts';

/* Un `require` de Metro devuelve un número; en Node no hay tal cosa, así que
   las pruebas usan un valor cualquiera para representar «un fichero». */
const FILE = 42 as never;

describe('resolver la foto', () => {
  it('el carrete del tutor manda sobre el fichero empaquetado', () => {
    /* Y el orden importa: si acaba de elegir una foto, esa es la foto, aunque
       la publicación arrastre todavía la ruta de la anterior. */
    expect(
      resolvePhoto({ 'posts/x.jpg': FILE }, { uri: 'file:///nueva.jpg', path: 'posts/x.jpg' }),
    ).toEqual({ uri: 'file:///nueva.jpg' });
  });

  it('sin carrete, coge el fichero empaquetado', () => {
    expect(resolvePhoto({ 'posts/x.jpg': FILE }, { uri: null, path: 'posts/x.jpg' })).toBe(FILE);
  });

  it('sin ninguno de los dos, devuelve nulo para que se dibuje la escena', () => {
    expect(resolvePhoto({}, { uri: null, path: 'posts/x.jpg' })).toBeNull();
  });
});

describe('el mapa de fotos empaquetadas', () => {
  const paths = new Set(SEED_POSTS.flatMap((post) => post.photos.map((photo) => photo.path)));

  it('no tiene ninguna entrada que no use ninguna publicación', () => {
    const huérfanas = Object.keys(BUNDLED_PHOTOS).filter((key) => !paths.has(key));
    expect(
      huérfanas,
      `Fotos empaquetadas que ninguna publicación pide:\n${huérfanas.join('\n')}`,
    ).toEqual([]);
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
