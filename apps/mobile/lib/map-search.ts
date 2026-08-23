/**
 * Buscar un sitio: la parte que no dibuja nada.
 *
 * Va aparte de la pantalla por la razón de siempre en este proyecto: es lógica
 * pura, **se equivoca en silencio** —un buscador roto contesta «nada» y parece
 * que el sitio no existe— y por eso se prueba con números en vez de mirándola.
 */

/**
 * Sin acentos y en minúsculas.
 *
 * Buscar «arganzuela» tiene que encontrar «Parque de la Arganzuela», y buscar
 * «veterinario» tiene que encontrar «Veterinario 24 h». Comparar las cadenas
 * tal cual falla en los dos casos, y falla en silencio: el buscador contesta
 * «nada» y parece que el sitio no existe.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export type Searchable = { id: string; label: string; kind: string };

/** Lo que sale al escribir. Nombre y tipo, porque se busca por los dos. */
export function searchPlaces<T extends Searchable>(items: readonly T[], query: string): T[] {
  const needle = fold(query);
  if (needle.length === 0) return [];
  return items.filter(
    (item) => fold(item.label).includes(needle) || fold(item.kind).includes(needle),
  );
}
