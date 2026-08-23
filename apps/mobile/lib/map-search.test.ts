/**
 * El buscador del mapa.
 *
 * Un buscador roto no revienta: contesta «nada». El usuario concluye que el
 * sitio no existe y deja de usarlo, y en una aplicación de perros el sitio que
 * se busca a las tres de la mañana es un veterinario. Por eso esto se prueba
 * con casos y no mirando la pantalla.
 */

import { describe, expect, it } from 'vitest';

import { fold, searchPlaces, type Searchable } from './map-search.js';

const CATALOGUE: Searchable[] = [
  { id: 'p1', label: 'Parque de la Arganzuela', kind: 'Parque' },
  { id: 'p2', label: 'Parque Central', kind: 'Área canina' },
  { id: 'w1', label: 'Fuente de la Rosaleda', kind: 'Fuente con bebedero' },
  { id: 'v1', label: 'Clínica Veterinaria Chamberí', kind: 'Veterinario 24 h' },
  { id: 'v2', label: 'CV Delicias', kind: 'Veterinario' },
];

const ids = (items: Searchable[]) => items.map((item) => item.id).sort();

describe('normalizar', () => {
  it('quita los acentos', () => {
    expect(fold('Arganzuela')).toBe('arganzuela');
    expect(fold('Chamberí')).toBe('chamberi');
    expect(fold('Área')).toBe('area');
  });

  it('no distingue mayúsculas ni espacios de los bordes', () => {
    expect(fold('  PARQUE  ')).toBe('parque');
  });

  it('la eñe también se pliega, y es lo que se quiere', () => {
    /*
     * Escribí este caso al revés y el test me corrigió a mí.
     *
     * `NFD` separa la tilde de la ñ igual que la de una vocal, así que
     * «Logroño» sale «logrono». La primera reacción es llamarlo fallo, porque
     * en español la eñe es otra letra. Para **buscar** no lo es: quien escribe
     * desde un teclado que no la tiene, o con prisa, teclea «logrono», y lo que
     * tiene que pasar entonces es encontrar el sitio. El precio —que «año» y
     * «ano» se confundan— no existe en nombres de parques y clínicas.
     *
     * Se queda plegada a propósito, y esta prueba está para que quien la vea en
     * el futuro sepa que es una decisión y no un descuido.
     */
    expect(fold('Logroño')).toBe('logrono');
    expect(searchPlaces([{ id: 'x', label: 'Parque de Logroño', kind: 'Parque' }], 'logrono')).toHaveLength(1);
  });
});

describe('buscar', () => {
  it('sin texto no devuelve nada', () => {
    // El vacío no es «todo»: la pantalla enseña categorías y recientes, y una
    // lista entera aparecida sola sería ruido.
    expect(searchPlaces(CATALOGUE, '')).toEqual([]);
    expect(searchPlaces(CATALOGUE, '   ')).toEqual([]);
  });

  it('encuentra por nombre, aunque falte el acento', () => {
    expect(ids(searchPlaces(CATALOGUE, 'chamberi'))).toEqual(['v1']);
    expect(ids(searchPlaces(CATALOGUE, 'Chamberí'))).toEqual(['v1']);
  });

  it('encuentra por trozo de nombre, no solo por el principio', () => {
    // Nadie escribe «Clínica Veterinaria Chamberí» entero: escribe «delicias».
    expect(ids(searchPlaces(CATALOGUE, 'delicias'))).toEqual(['v2']);
  });

  it('encuentra por tipo, que es como se busca de verdad', () => {
    // Se busca «veterinario», no el nombre de la clínica — y una de las dos no
    // lleva la palabra en el nombre.
    expect(ids(searchPlaces(CATALOGUE, 'veterinario'))).toEqual(['v1', 'v2']);
    expect(ids(searchPlaces(CATALOGUE, 'parque'))).toEqual(['p1', 'p2']);
    expect(ids(searchPlaces(CATALOGUE, 'fuente'))).toEqual(['w1']);
  });

  it('las categorías de la pantalla encuentran algo', () => {
    // Son las tres píldoras que salen antes de escribir. Una que no devuelva
    // nada es un botón que contesta «no hay» sobre un catálogo que sí tiene.
    for (const term of ['parque', 'fuente', 'veterinario']) {
      expect(searchPlaces(CATALOGUE, term).length).toBeGreaterThan(0);
    }
  });

  it('lo que no está, no está', () => {
    expect(searchPlaces(CATALOGUE, 'gasolinera')).toEqual([]);
  });

  it('mantiene el orden del catálogo', () => {
    // El catálogo llega ordenado por distancia desde la pantalla. Reordenar
    // aquí pondría el veterinario de la otra punta por delante del de al lado.
    expect(searchPlaces(CATALOGUE, 'a').map((item) => item.id)).toEqual(
      CATALOGUE.filter((item) => fold(`${item.label} ${item.kind}`).includes('a')).map(
        (item) => item.id,
      ),
    );
  });
});
