/**
 * De dónde sale la foto de una publicación.
 *
 * Una `PostPhoto` puede venir de tres sitios, y hasta ahora sólo dos estaban
 * conectados:
 *
 *  1. **`uri`** — la acaba de elegir el tutor en su carrete, o llega firmada
 *     desde el almacenamiento. Es la vía de producción.
 *  2. **`path`** — la ruta del objeto. En la demostración apunta a un fichero
 *     empaquetado con la aplicación… que nadie resolvía: `PostCard` sólo miraba
 *     `uri`, así que **toda** publicación de la semilla caía en la tercera vía.
 *  3. **Nada** — se dibuja la escena generada de `lib/artwork`, con su etiqueta
 *     que dice que es un dibujo.
 *
 * Este módulo es la segunda vía. El feed de una aplicación cuyo contenido *son*
 * fotos de perros no debería enseñarse con ocho dibujos: los dibujos son un
 * respaldo honesto para cuando no hay foto, no el material de demostración.
 *
 * ## Por qué un mapa escrito a mano y no una carpeta
 *
 * Metro resuelve los `require` en tiempo de empaquetado, así que
 * `require(ruta)` con una variable no existe: hay que nombrar cada fichero.
 * Molesta una vez por foto y a cambio el paquete sólo lleva lo que se usa, y un
 * fichero que falta se ve al compilar y no en la pantalla de alguien.
 */

import type { ImageSourcePropType } from 'react-native';

/**
 * Las fotos empaquetadas, por su `path`.
 *
 * Está vacío a propósito: los ficheros no se versionan todavía. Para llenarlo,
 * deja los `.jpg` en `assets/posts/` y descomenta su línea. Los ocho que la
 * semilla ya describe —cada uno con su texto alternativo escrito en
 * `lib/posts.ts`, que es el guion de la foto— son:
 *
 * ```ts
 * 'posts/nina-pelota.jpg':   require('../assets/posts/nina-pelota.jpg'),
 * 'posts/nina-carrera.jpg':  require('../assets/posts/nina-carrera.jpg'),
 * 'posts/nina-sentada.jpg':  require('../assets/posts/nina-sentada.jpg'),
 * 'posts/toby-charco.jpg':   require('../assets/posts/toby-charco.jpg'),
 * 'posts/toby-sacudida.jpg': require('../assets/posts/toby-sacudida.jpg'),
 * 'posts/rocky-sombra.jpg':  require('../assets/posts/rocky-sombra.jpg'),
 * 'posts/kira-sombra.jpg':   require('../assets/posts/kira-sombra.jpg'),
 * 'posts/bruno-noche.jpg':   require('../assets/posts/bruno-noche.jpg'),
 * ```
 *
 * No hace falta ponerlos todos: lo que falte sigue dibujándose, así que el feed
 * puede tener fotos y dibujos a la vez sin quedar a medias.
 */
export const BUNDLED_PHOTOS: Record<string, ImageSourcePropType> = {};

/** Lo mínimo que hace falta saber de una foto para localizarla. */
export type PhotoRef = { uri: string | null; path: string };

/**
 * La resolución, con el mapa por parámetro.
 *
 * Se separa de `photoSource` para poder probarla: el mapa de verdad depende de
 * `require`, que en las pruebas no existe, y una función que lee un módulo por
 * dentro no se puede comprobar sin montar el módulo entero.
 */
export function resolvePhoto(
  bundled: Record<string, ImageSourcePropType>,
  photo: PhotoRef,
): ImageSourcePropType | null {
  /* El `uri` manda sobre el fichero empaquetado, y el orden importa: si el
     tutor acaba de elegir una foto de su carrete, esa es la foto, aunque la
     publicación arrastre todavía la ruta de la anterior. */
  if (photo.uri) return { uri: photo.uri };
  return bundled[photo.path] ?? null;
}

/** La foto de verdad, si la hay. Nula significa «dibuja la escena». */
export function photoSource(photo: PhotoRef): ImageSourcePropType | null {
  return resolvePhoto(BUNDLED_PHOTOS, photo);
}
