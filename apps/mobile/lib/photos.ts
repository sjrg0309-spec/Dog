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

/**
 * Las mismas fotos, servidas por una URL mientras no estén empaquetadas.
 *
 * Son originales generadas para este proyecto. El guion de cada una es el texto
 * alternativo que ya estaba escrito en `lib/posts`, y la raza es la de
 * `lib/data`, para que la foto no contradiga al retrato del avatar; las tres de
 * Nina y las dos de Toby son el mismo animal porque se hicieron encadenadas,
 * usando la primera de cada carrusel como referencia de las siguientes.
 *
 * **Es provisional y conviene que se note.** Dependen de que ese enlace siga
 * vivo. Lo definitivo es dejar los ficheros en `assets/posts/` y rellenar el
 * mapa de arriba: entonces viajan con la aplicación, se ven sin red y no
 * dependen de nadie. Por eso este mapa se consulta **después** que el otro —un
 * fichero que ya está en el paquete gana siempre a una URL— y por eso ninguna
 * de las dos cosas toca `uri`, que sigue significando lo que significaba: la
 * foto que el tutor acaba de elegir en su carrete.
 */
export const REMOTE_PHOTOS: Record<string, string> = {
  'posts/nina-pelota.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154449_7ecfd0f2-3e6f-4264-bbdb-f1d8a379ea15.png',
  'posts/nina-carrera.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154636_7e0a0d7e-b6d8-4c6a-aeb7-e1c17cfa1775.png',
  'posts/nina-sentada.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154636_43e88f8d-2d5f-4cdb-ac28-9c72d7509c37.png',
  'posts/toby-charco.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154449_65ebc776-a077-49e1-a535-d73d9b4e3cf9.png',
  'posts/toby-sacudida.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154636_261d3b8e-2712-4b3b-a982-3f3b6c1439b7.png',
  'posts/rocky-sombra.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154449_ee564efa-9a9a-4fbc-a6a7-0b80731a96fa.png',
  'posts/kira-sombra.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154449_9b757c97-8d1b-4127-b95a-b0e1b98d3434.png',
  'posts/bruno-noche.jpg':
    'https://d8j0ntlcm91z4.cloudfront.net/user_3FSi5v6rWOKS8bXA0WYOP41A36T/hf_20260829_154448_c1f4157f-4e77-4588-8a73-042561cbca3c.png',
};

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
  remote: Record<string, string>,
  photo: PhotoRef,
): ImageSourcePropType | null {
  /*
   * El orden no es casual, y cada escalón le gana al siguiente por un motivo:
   *
   *  1. **El carrete.** Si el tutor acaba de elegir una foto, esa es la foto,
   *     aunque la publicación arrastre todavía la ruta de la anterior.
   *  2. **El fichero empaquetado.** Viaja con la aplicación: se ve sin red, sin
   *     esperar y sin depender de que un servidor siga en pie.
   *  3. **La URL.** Funciona, pero cuesta una petición y puede caerse.
   *  4. **Nada** — y entonces se dibuja la escena, que es un respaldo honesto y
   *     no un hueco.
   */
  if (photo.uri) return { uri: photo.uri };
  const file = bundled[photo.path];
  if (file) return file;
  const url = remote[photo.path];
  return url ? { uri: url } : null;
}

/** La foto de verdad, si la hay. Nula significa «dibuja la escena». */
export function photoSource(photo: PhotoRef): ImageSourcePropType | null {
  return resolvePhoto(BUNDLED_PHOTOS, REMOTE_PHOTOS, photo);
}
