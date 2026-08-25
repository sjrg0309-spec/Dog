/**
 * Razas, y por qué la pregunta no es decorativa.
 *
 * En una aplicación de perros, «¿de qué raza es?» suele ser un campo de texto
 * que solo sirve para escribirlo debajo del nombre. Aquí hace tres cosas, y las
 * tres se notan:
 *
 *  1. **Rellena el alta.** Al elegir la raza ya se sabe la talla y, casi
 *     siempre, cuánta cuerda tiene. Los dos pasos siguientes vienen
 *     contestados y solo hay que confirmarlos. Preguntar por la raza hace el
 *     registro **más corto**, no más largo.
 *  2. **Cambia el techo de calor.** Un bulldog francés no es un labrador
 *     pequeño: respira peor y disipa calor mucho peor, y la capa de bienestar
 *     le baja cuatro grados el techo a partir del cual no se propone salir. Ese
 *     dato hoy hay que acordarse de ponerlo a mano en la ficha; con la raza
 *     sale solo.
 *  3. **Sale en el perfil**, que es lo que ya hacía y lo de menos.
 *
 * ## Mestizo primero, y no por orden alfabético
 *
 * La mayoría de los perros del mundo son mestizos, y en América Latina esa
 * mayoría es abrumadora. Una lista que empieza por «Affenpinscher» y esconde
 * «Mestizo» en la eme le dice a la mayoría de la gente que su perro es un caso
 * raro. Va primero, se puede elegir solo, y admite decir **de qué** es mezcla
 * —«mestizo de labrador y pastor»— sin obligar a saberlo.
 *
 * Y hay una opción para no saberlo. Quien adopta un adulto en la calle muchas
 * veces no lo sabe, y forzarle a inventarse una raza es forzarle a meter un
 * dato falso en el sitio donde se decide si su perro sale a 30 grados.
 *
 * ## Lo que estos datos son y lo que no
 *
 * La talla y la energía de cada raza son **el punto de partida más probable**,
 * no una verdad: hay labradores tranquilos y galgos de sofá. Por eso se
 * proponen y se pueden cambiar en el paso siguiente, en vez de escribirse
 * directamente en la ficha.
 *
 * Con las señales de salud es al revés y a propósito: el hocico chato no
 * depende del carácter del animal, así que sale marcado. En un mestizo se marca
 * también —una mezcla de carlino tiene el mismo problema para respirar— pero
 * diciendo que se puede quitar, porque en una mezcla puede que no lo haya
 * heredado.
 */

import type { EnergyLevel, PetSize } from './types.js';
import type { HealthFlag } from './welfare.js';

export type Breed = {
  id: string;
  name: string;
  /** La talla más probable. Se propone, no se impone. */
  size: PetSize | null;
  /** La energía más probable, cuando la raza la marca de verdad. */
  energy: EnergyLevel | null;
  /** Lo que la raza trae de serie y cambia lo que puede hacer hoy. */
  flags?: readonly HealthFlag[];
  /** Cómo lo escribe la gente: se busca por aquí además de por el nombre. */
  aliases?: readonly string[];
};

/** El identificador del mestizo, que es la respuesta más común. */
export const MIXED_BREED_ID = 'mestizo';

/** Para quien adoptó un adulto y no lo sabe. Mejor eso que un dato inventado. */
export const UNKNOWN_BREED_ID = 'no_lo_se';

export const BREEDS: readonly Breed[] = [
  {
    id: MIXED_BREED_ID,
    name: 'Mestizo',
    size: null,
    energy: null,
    /* Cómo se le llama en cada sitio. Quien escribe «zaguate» no busca una raza
       rara: escribe la palabra de su familia, y quedarse sin resultados le dice
       que su perro no cabe aquí. */
    aliases: [
      'mezcla', 'criollo', 'quiltro', 'chusco', 'cusco', 'sin raza', 'callejero',
      'zaguate', 'aguacatero', 'gozque', 'chandoso', 'pichicho', 'mestiza',
      'sato', 'runcho', 'jibaro', 'perro comun', 'sin pedigri',
    ],
  },
  { id: UNKNOWN_BREED_ID, name: 'No lo sé', size: null, energy: null, aliases: ['no se', 'ni idea', 'desconocida'] },

  { id: 'labrador', name: 'Labrador retriever', size: 'large', energy: 'high', aliases: ['labra'] },
  { id: 'golden', name: 'Golden retriever', size: 'large', energy: 'high' },
  { id: 'pastor_aleman', name: 'Pastor alemán', size: 'large', energy: 'high', aliases: ['ovejero aleman'] },
  { id: 'pastor_belga', name: 'Pastor belga malinois', size: 'large', energy: 'high', aliases: ['malinois'] },
  { id: 'border_collie', name: 'Border collie', size: 'medium', energy: 'high' },
  { id: 'pastor_australiano', name: 'Pastor australiano', size: 'medium', energy: 'high', aliases: ['aussie'] },
  { id: 'beagle', name: 'Beagle', size: 'medium', energy: 'medium' },
  { id: 'cocker', name: 'Cocker spaniel', size: 'medium', energy: 'medium' },
  { id: 'caniche', name: 'Caniche', size: 'small', energy: 'medium', aliases: ['poodle', 'french poodle'] },
  { id: 'schnauzer', name: 'Schnauzer', size: 'small', energy: 'medium' },
  { id: 'yorkshire', name: 'Yorkshire terrier', size: 'mini', energy: 'medium', aliases: ['york'] },
  { id: 'chihuahua', name: 'Chihuahua', size: 'mini', energy: 'medium' },
  { id: 'maltes', name: 'Bichón maltés', size: 'mini', energy: 'low', aliases: ['maltes', 'bichon'] },
  { id: 'pomerania', name: 'Pomerania', size: 'mini', energy: 'medium', flags: ['heat_sensitive'], aliases: ['lulu', 'spitz'] },
  { id: 'jack_russell', name: 'Jack russell terrier', size: 'small', energy: 'high' },
  { id: 'westie', name: 'West highland terrier', size: 'small', energy: 'medium', aliases: ['westy'] },
  { id: 'fox_terrier', name: 'Fox terrier', size: 'small', energy: 'high' },
  { id: 'bodeguero', name: 'Ratonero bodeguero', size: 'small', energy: 'high', aliases: ['bodeguero andaluz'] },
  { id: 'podenco', name: 'Podenco', size: 'medium', energy: 'high' },
  { id: 'galgo', name: 'Galgo', size: 'large', energy: 'high', aliases: ['greyhound'] },
  { id: 'whippet', name: 'Whippet', size: 'medium', energy: 'high' },
  { id: 'dalmata', name: 'Dálmata', size: 'large', energy: 'high' },
  { id: 'husky', name: 'Husky siberiano', size: 'large', energy: 'high', flags: ['heat_sensitive'] },
  { id: 'samoyedo', name: 'Samoyedo', size: 'large', energy: 'medium', flags: ['heat_sensitive'] },
  { id: 'akita', name: 'Akita', size: 'large', energy: 'medium', flags: ['heat_sensitive'] },
  { id: 'boyero_berna', name: 'Boyero de Berna', size: 'giant', energy: 'low', flags: ['heat_sensitive', 'joint_issues'] },
  { id: 'san_bernardo', name: 'San Bernardo', size: 'giant', energy: 'low', flags: ['heat_sensitive', 'joint_issues'] },
  { id: 'mastin', name: 'Mastín', size: 'giant', energy: 'low', flags: ['heat_sensitive', 'joint_issues'] },
  { id: 'gran_danes', name: 'Gran danés', size: 'giant', energy: 'medium', flags: ['joint_issues'], aliases: ['dogo aleman'] },
  { id: 'rottweiler', name: 'Rottweiler', size: 'large', energy: 'medium', flags: ['joint_issues'] },
  { id: 'doberman', name: 'Dóberman', size: 'large', energy: 'high' },
  { id: 'cane_corso', name: 'Cane corso', size: 'giant', energy: 'medium' },
  { id: 'presa_canario', name: 'Presa canario', size: 'giant', energy: 'medium' },
  { id: 'pitbull', name: 'American pit bull terrier', size: 'medium', energy: 'high', aliases: ['pitbull', 'pit bull'] },
  { id: 'american_bully', name: 'American bully', size: 'medium', energy: 'medium', flags: ['brachycephalic'] },
  { id: 'staffordshire', name: 'Staffordshire terrier', size: 'medium', energy: 'high', aliases: ['amstaff'] },
  { id: 'bulldog_frances', name: 'Bulldog francés', size: 'small', energy: 'low', flags: ['brachycephalic', 'heat_sensitive'], aliases: ['frenchie'] },
  { id: 'bulldog_ingles', name: 'Bulldog inglés', size: 'medium', energy: 'low', flags: ['brachycephalic', 'heat_sensitive', 'joint_issues'] },
  { id: 'carlino', name: 'Carlino', size: 'small', energy: 'low', flags: ['brachycephalic', 'heat_sensitive'], aliases: ['pug', 'doguillo'] },
  { id: 'boxer', name: 'Bóxer', size: 'large', energy: 'high', flags: ['brachycephalic', 'heat_sensitive'] },
  { id: 'shih_tzu', name: 'Shih tzu', size: 'mini', energy: 'low', flags: ['brachycephalic', 'heat_sensitive'] },
  { id: 'pekines', name: 'Pekinés', size: 'mini', energy: 'low', flags: ['brachycephalic', 'heat_sensitive'] },
  { id: 'boston_terrier', name: 'Boston terrier', size: 'small', energy: 'medium', flags: ['brachycephalic', 'heat_sensitive'] },
  { id: 'teckel', name: 'Teckel', size: 'small', energy: 'medium', flags: ['joint_issues'], aliases: ['dachshund', 'salchicha'] },
  { id: 'corgi', name: 'Welsh corgi', size: 'small', energy: 'medium', flags: ['joint_issues'] },
  { id: 'basset', name: 'Basset hound', size: 'medium', energy: 'low', flags: ['joint_issues'] },
  { id: 'weimaraner', name: 'Weimaraner', size: 'large', energy: 'high' },
  { id: 'braco', name: 'Braco alemán', size: 'large', energy: 'high' },
  { id: 'setter', name: 'Setter irlandés', size: 'large', energy: 'high' },
  { id: 'springer', name: 'Springer spaniel', size: 'medium', energy: 'high' },
  { id: 'shiba', name: 'Shiba inu', size: 'small', energy: 'medium' },
  { id: 'chow_chow', name: 'Chow chow', size: 'medium', energy: 'low', flags: ['heat_sensitive', 'brachycephalic'] },
  { id: 'border_terrier', name: 'Border terrier', size: 'small', energy: 'high' },
  { id: 'bichon_frise', name: 'Bichón frisé', size: 'small', energy: 'medium' },
  { id: 'lhasa', name: 'Lhasa apso', size: 'small', energy: 'low' },
  { id: 'collie', name: 'Collie', size: 'large', energy: 'medium', aliases: ['lassie'] },
  { id: 'pastor_ovejero', name: 'Ovejero magallánico', size: 'medium', energy: 'high', aliases: ['pastor patagonico'] },
  { id: 'sabueso', name: 'Sabueso', size: 'medium', energy: 'medium' },
  { id: 'labradoodle', name: 'Labradoodle', size: 'large', energy: 'high' },
  { id: 'cavalier', name: 'Cavalier king charles', size: 'small', energy: 'low', flags: ['brachycephalic'] },

  /*
   * América Latina.
   *
   * No van al final por ser menos importantes —el orden de esta lista no lo ve
   * nadie, porque se busca escribiendo— sino porque se añadieron después, y
   * conviene que se note de dónde salió cada tanda.
   *
   * Aquí hay dos cosas distintas mezcladas a propósito. Unas son razas de
   * verdad, con estándar y con siglos encima: el xoloitzcuintle y el peruano
   * sin pelo estaban en América antes que los españoles. Otras son razas
   * nacionales que en Europa casi no se ven y en su país son el perro de la
   * calle de al lado: el cimarrón uruguayo, el ovejero magallánico, el terrier
   * chileno.
   *
   * Y luego está lo que de verdad faltaba, que no es una raza: **cómo se llama
   * al mestizo en cada sitio**. Quiltro en Chile, zaguate en Costa Rica,
   * aguacatero en Cuba, gozque y chandoso en Colombia, chusco y cusco en Perú,
   * pichicho en Argentina, callejero en todas partes. Quien escribe «zaguate»
   * en el buscador de una aplicación no está buscando una raza rara: está
   * escribiendo la palabra que usa su familia, y quedarse sin resultados le
   * dice que su perro no cabe aquí.
   */
  { id: 'xoloitzcuintle', name: 'Xoloitzcuintle', size: 'medium', energy: 'medium', flags: ['hairless'], aliases: ['xolo', 'perro azteca', 'itzcuintli'] },
  { id: 'peruano_sin_pelo', name: 'Perro sin pelo del Perú', size: 'medium', energy: 'medium', flags: ['hairless'], aliases: ['viringo', 'calato', 'chimu'] },
  { id: 'chino_crestado', name: 'Crestado chino', size: 'mini', energy: 'medium', flags: ['hairless'] },
  { id: 'dogo_argentino', name: 'Dogo argentino', size: 'large', energy: 'high', aliases: ['dogo'] },
  { id: 'cimarron', name: 'Cimarrón uruguayo', size: 'large', energy: 'high', aliases: ['cimarron'] },
  { id: 'fila', name: 'Fila brasileño', size: 'giant', energy: 'medium', flags: ['joint_issues'], aliases: ['fila brasileiro'] },
  { id: 'terrier_brasileno', name: 'Terrier brasileño', size: 'small', energy: 'high', aliases: ['fox paulistinha'] },
  { id: 'terrier_chileno', name: 'Terrier chileno', size: 'small', energy: 'high', aliases: ['ratonero chileno'] },
  { id: 'mucuchies', name: 'Mucuchíes', size: 'large', energy: 'medium', aliases: ['mucuchies', 'perro nevado de merida'] },
  { id: 'chihuahueno_pelo_largo', name: 'Chihuahueño de pelo largo', size: 'mini', energy: 'medium', aliases: ['chihuahua pelo largo'] },
  { id: 'pastor_ganadero', name: 'Pastor ganadero australiano', size: 'medium', energy: 'high', aliases: ['blue heeler', 'cattle dog'] },
  { id: 'ovejero_aleman_criollo', name: 'Ovejero criollo', size: 'medium', energy: 'high', aliases: ['perro de campo', 'criollo de campo'] },
  { id: 'pila_argentino', name: 'Pila argentino', size: 'medium', energy: 'medium', flags: ['hairless'] },
  { id: 'chiribaya', name: 'Pastor chiribaya', size: 'medium', energy: 'high', aliases: ['perro chiribaya'] },
];

const ORDER: readonly PetSize[] = ['mini', 'small', 'medium', 'large', 'giant'];

/** Sin tildes y en minúsculas: quien escribe «dalmata» quiere el dálmata. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Buscar una raza.
 *
 * Mestizo y «no lo sé» salen **siempre los primeros con la lista vacía**, que es
 * el estado en el que se abre el paso: son las dos respuestas más frecuentes y
 * tenerlas que buscar sería hacer trabajar a la mayoría.
 *
 * Con algo escrito, primero lo que empieza por ahí y después lo que lo contiene:
 * quien teclea «pas» quiere «Pastor alemán» antes que «American pit bull».
 */
export function searchBreeds(query: string): Breed[] {
  const needle = fold(query.trim());
  if (needle === '') return [...BREEDS];

  const matches = BREEDS.filter((breed) =>
    [breed.name, ...(breed.aliases ?? [])].some((label) => fold(label).includes(needle)),
  );

  return matches.sort((a, b) => {
    const starts = (breed: Breed) =>
      [breed.name, ...(breed.aliases ?? [])].some((label) => fold(label).startsWith(needle)) ? 0 : 1;
    return starts(a) - starts(b);
  });
}

export function findBreed(id: string): Breed | null {
  return BREEDS.find((breed) => breed.id === id) ?? null;
}

/**
 * Lo que se puede dar por sabido al elegir una o varias razas.
 *
 * Con una mezcla se toma **la talla de en medio** y no la mayor: un mestizo de
 * gran danés y chihuahua no es un gran danés. Es una estimación y sale como
 * propuesta, que es lo que corresponde a una estimación.
 *
 * La energía solo se propone si **todas** las razas elegidas coinciden. Un
 * mestizo de galgo y basset no tiene «energía media»: tiene la que tenga, y
 * proponer una inventada es peor que no proponer nada.
 *
 * Las señales de salud se **suman**: si una de las razas de la mezcla trae
 * hocico chato, el problema para respirar puede estar ahí, y equivocarse hacia
 * el lado prudente en el techo de calor cuesta un paseo más corto. Al revés
 * cuesta un golpe de calor.
 */
export function breedDefaults(ids: readonly string[]): {
  size: PetSize | null;
  energy: EnergyLevel | null;
  flags: HealthFlag[];
} {
  const breeds = ids.map((id) => findBreed(id)).filter((breed): breed is Breed => breed !== null);
  const known = breeds.filter((breed) => breed.size !== null);

  const size =
    known.length === 0
      ? null
      : ORDER[
          Math.round(
            known.reduce((total, breed) => total + ORDER.indexOf(breed.size!), 0) / known.length,
          )
        ] ?? null;

  const energies = new Set(
    breeds.filter((breed) => breed.energy !== null).map((breed) => breed.energy!),
  );
  const energy = energies.size === 1 ? [...energies][0]! : null;

  const flags = [...new Set(breeds.flatMap((breed) => breed.flags ?? []))];

  return { size, energy, flags };
}

/** «Mestizo de labrador y pastor alemán», o «Border collie». */
export function describeBreeds(ids: readonly string[]): string {
  const named = ids
    .map((id) => findBreed(id))
    .filter((breed): breed is Breed => breed !== null && breed.id !== UNKNOWN_BREED_ID);

  if (named.length === 0) return 'Raza sin determinar';

  const mixed = named.some((breed) => breed.id === MIXED_BREED_ID);
  const rest = named.filter((breed) => breed.id !== MIXED_BREED_ID).map((breed) => breed.name);

  if (!mixed) return rest.join(' y ');
  if (rest.length === 0) return 'Mestizo';
  return `Mestizo de ${rest.join(' y ')}`;
}

/** Cuántas razas se pueden marcar en una mezcla, además de «mestizo». */
export const MAX_BREEDS = 3;
