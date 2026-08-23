/**
 * Las razas, comprobadas por lo que hacen y no por estar en la lista.
 *
 * La pregunta de la raza suele ser decorativa. Aquí decide dos cosas —lo que se
 * propone en los pasos siguientes del alta y el techo de calor del animal—, así
 * que se comprueba como lo que es: un dato del que dependen decisiones.
 */

import { describe, expect, it } from 'vitest';

import {
  BREEDS,
  MAX_BREEDS,
  MIXED_BREED_ID,
  UNKNOWN_BREED_ID,
  breedDefaults,
  describeBreeds,
  findBreed,
  searchBreeds,
} from './breeds.js';
import { HEALTH_FLAGS } from './welfare.js';

describe('el catálogo', () => {
  it('no repite identificadores', () => {
    expect(new Set(BREEDS.map((breed) => breed.id)).size).toBe(BREEDS.length);
  });

  it('el mestizo va primero, porque es la respuesta más común', () => {
    /* Una lista que empieza por «Affenpinscher» y esconde «Mestizo» en la eme
       le dice a la mayoría de la gente que su perro es un caso raro. */
    expect(BREEDS[0]?.id).toBe(MIXED_BREED_ID);
  });

  it('se puede no saberlo', () => {
    /* Quien adopta un adulto de la calle muchas veces no lo sabe, y obligarle a
       inventarse una raza es meter un dato falso justo donde se decide si su
       perro sale a 30 grados. */
    expect(findBreed(UNKNOWN_BREED_ID)).not.toBeNull();
  });

  it('las señales de salud que trae una raza existen de verdad', () => {
    /* Una etiqueta mal escrita aquí no rompe nada y no hace nada: pasaría por
       la interfaz sin que la capa de bienestar la mire. */
    for (const breed of BREEDS) {
      for (const flag of breed.flags ?? []) {
        expect(HEALTH_FLAGS, `${breed.name} trae «${flag}», que no existe`).toContain(flag);
      }
    }
  });

  it('las razas de hocico chato están marcadas', () => {
    /* Es la que más pesa: baja cuatro grados el techo de calor. Si al bulldog
       francés se le olvidara, la aplicación le propondría salir a 30 grados. */
    for (const id of ['bulldog_frances', 'carlino', 'boxer', 'shih_tzu', 'pekines']) {
      expect(findBreed(id)?.flags, id).toContain('brachycephalic');
    }
  });
});

describe('América Latina', () => {
  it('las razas americanas están', () => {
    /* El xoloitzcuintle y el peruano sin pelo estaban en América antes que los
       españoles. Que falten en una aplicación pensada para la región no es una
       laguna del catálogo: es decirle a media región que su perro no cabe. */
    for (const id of ['xoloitzcuintle', 'peruano_sin_pelo', 'dogo_argentino', 'cimarron', 'fila', 'terrier_chileno']) {
      expect(findBreed(id), id).not.toBeNull();
    }
  });

  it('el mestizo se encuentra con la palabra de cada país', () => {
    /* Quien escribe «zaguate» no busca una raza rara: escribe la palabra que usa
       su familia, y quedarse sin resultados le dice que su perro no cabe aquí. */
    for (const word of ['zaguate', 'aguacatero', 'gozque', 'chandoso', 'pichicho', 'cusco', 'sato']) {
      expect(searchBreeds(word).map((breed) => breed.id), word).toContain(MIXED_BREED_ID);
    }
  });

  it('los perros sin pelo llevan su señal', () => {
    /* No es estética: un perro sin pelo se quema al sol y pasa frío antes que
       cualquier otro, y esa señal sube cinco grados el suelo de temperatura. */
    for (const id of ['xoloitzcuintle', 'peruano_sin_pelo', 'pila_argentino']) {
      expect(findBreed(id)?.flags, id).toContain('hairless');
    }
  });
});

describe('buscar', () => {
  it('sin escribir nada, la lista entera y el mestizo arriba', () => {
    expect(searchBreeds('')).toHaveLength(BREEDS.length);
    expect(searchBreeds('')[0]?.id).toBe(MIXED_BREED_ID);
  });

  it('no le importan las tildes', () => {
    expect(searchBreeds('dalmata').map((breed) => breed.id)).toContain('dalmata');
  });

  it('encuentra por cómo lo llama la gente', () => {
    /* «Criollo», «quiltro» y «chusco» son la misma respuesta que «mestizo», y
       quien la escribe no debería quedarse sin resultados. */
    for (const word of ['criollo', 'quiltro', 'chusco', 'callejero']) {
      expect(searchBreeds(word).map((breed) => breed.id), word).toContain(MIXED_BREED_ID);
    }
    expect(searchBreeds('pug').map((breed) => breed.id)).toContain('carlino');
    expect(searchBreeds('poodle').map((breed) => breed.id)).toContain('caniche');
  });

  it('lo que empieza por lo escrito va antes que lo que lo contiene', () => {
    /* Quien teclea «pas» quiere «Pastor alemán» y no «American pit bull». */
    expect(searchBreeds('pas')[0]?.name.toLowerCase().startsWith('pas')).toBe(true);
  });

  it('con algo que no está, no inventa', () => {
    expect(searchBreeds('zzzz')).toEqual([]);
  });
});

describe('lo que la raza rellena', () => {
  it('una raza conocida propone talla y energía', () => {
    /* Esto es lo que hace que preguntar la raza acorte el registro en vez de
       alargarlo: los dos pasos siguientes vienen contestados. */
    expect(breedDefaults(['border_collie'])).toEqual({
      size: 'medium',
      energy: 'high',
      flags: [],
    });
  });

  it('el mestizo solo no propone nada', () => {
    expect(breedDefaults([MIXED_BREED_ID])).toEqual({ size: null, energy: null, flags: [] });
  });

  it('una mezcla toma la talla de en medio, no la mayor', () => {
    /* Un mestizo de gran danés y chihuahua no es un gran danés. */
    expect(breedDefaults([MIXED_BREED_ID, 'gran_danes', 'chihuahua']).size).toBe('medium');
  });

  it('si las energías no coinciden, no se inventa una', () => {
    /* Un mestizo de galgo y basset no tiene «energía media»: tiene la que
       tenga, y proponer una inventada es peor que no proponer nada. */
    expect(breedDefaults([MIXED_BREED_ID, 'galgo', 'basset']).energy).toBeNull();
  });

  it('si coinciden, sí', () => {
    expect(breedDefaults([MIXED_BREED_ID, 'labrador', 'golden']).energy).toBe('high');
  });

  it('las señales de salud de una mezcla se suman', () => {
    /* Equivocarse hacia el lado prudente en el techo de calor cuesta un paseo
       más corto. Al revés cuesta un golpe de calor. */
    const flags = breedDefaults([MIXED_BREED_ID, 'carlino', 'husky']).flags;
    expect(flags).toContain('brachycephalic');
    expect(flags).toContain('heat_sensitive');
  });

  it('no repite una señal que traen las dos razas', () => {
    expect(breedDefaults(['carlino', 'bulldog_frances']).flags.filter((f) => f === 'heat_sensitive'))
      .toHaveLength(1);
  });

  it('«no lo sé» no propone nada y no rompe', () => {
    expect(breedDefaults([UNKNOWN_BREED_ID])).toEqual({ size: null, energy: null, flags: [] });
    expect(breedDefaults([])).toEqual({ size: null, energy: null, flags: [] });
  });
});

describe('cómo se escribe', () => {
  it('una raza sola', () => {
    expect(describeBreeds(['border_collie'])).toBe('Border collie');
  });

  it('un mestizo a secas', () => {
    expect(describeBreeds([MIXED_BREED_ID])).toBe('Mestizo');
  });

  it('un mestizo con apellidos', () => {
    expect(describeBreeds([MIXED_BREED_ID, 'labrador', 'pastor_aleman'])).toBe(
      'Mestizo de Labrador retriever y Pastor alemán',
    );
  });

  it('no saberlo se dice, no se deja en blanco', () => {
    expect(describeBreeds([UNKNOWN_BREED_ID])).toBe('Raza sin determinar');
    expect(describeBreeds([])).toBe('Raza sin determinar');
  });

  it('la mezcla tiene tope', () => {
    /* Tres apellidos ya es una conjetura; cinco es un formulario. */
    expect(MAX_BREEDS).toBe(3);
  });
});
