/**
 * Catálogo de especies.
 *
 * Coincide no es una aplicación de perros con otras especies añadidas encima.
 * Cada especie tiene su propio **modelo social**, y esa es la decisión que
 * gobierna todo lo demás: qué se le ofrece al tutor, si tiene sentido un
 * encuentro y qué rasgos se le preguntan.
 *
 * Tres modelos, y ninguno es "el de perros con ajustes":
 *
 *  - `pack`         Encuentros abiertos en grupo. Solo el perro.
 *  - `small_group`  Encuentros de dos o tres, en terreno neutral, supervisados y
 *                   cortos. Hurones, conejos, cobayas, ratas.
 *  - `solitary`     **Sin encuentros.** Gatos, hámsteres sirios, aves, reptiles,
 *                   peces e invertebrados. La aplicación les ofrece comunidad de
 *                   tutores, lugares que los admiten y servicios especializados.
 *
 * Meter a un gato territorial en una quedada para conocer a otro gato es
 * estresarlo. La aplicación no lo ofrece, y lo dice en lugar de callarlo.
 */

/** Agrupación taxonómica, para el lenguaje de la interfaz y para agrupar reglas. */
export const TAXON_GROUPS = [
  'mammal_carnivore',
  'mammal_lagomorph',
  'mammal_rodent',
  'bird',
  'reptile',
  'amphibian',
  'fish',
  'invertebrate',
] as const;
export type TaxonGroup = (typeof TAXON_GROUPS)[number];

export const SOCIAL_MODELS = ['pack', 'small_group', 'solitary'] as const;
export type SocialModel = (typeof SOCIAL_MODELS)[number];

/**
 * Estado legal en una jurisdicción.
 *
 * Coincide **no da asesoramiento legal**. Guarda un estado con su fuente y lo
 * muestra tal cual; la lista definitiva es siempre la del organismo competente.
 * Por eso cada entrada lleva nota y enlace: para que el usuario pueda
 * comprobarlo, no para que se fíe de la aplicación.
 */
export const LEGAL_STATUSES = [
  /** Animal de compañía por ley, sin depender de ningún listado. */
  'companion_animal',
  /** Especie doméstica de toda la vida; no es fauna silvestre. */
  'domestic',
  /** Silvestre: su tenencia depende del listado positivo, aún en desarrollo. */
  'positive_list_pending',
  /** Permitida con requisitos: CITES, registro, licencia o certificado. */
  'restricted',
  /** Excluida de forma expresa. */
  'excluded',
] as const;
export type LegalStatus = (typeof LEGAL_STATUSES)[number];

export type LegalEntry = {
  jurisdiction: string;
  status: LegalStatus;
  note: string;
  source: string;
};

/**
 * Vocabulario de estilos de juego.
 *
 * Es un superconjunto: cada especie declara cuáles le aplican. `chase` significa
 * cosas distintas en un perro y en un hurón, pero la mecánica —uno persigue,
 * otro huye, y ambos disfrutan— es la misma, así que el eje sirve. Lo que no
 * sirve es preguntarle a un tutor de conejo si su animal hace "lucha libre".
 */
export const PLAY_STYLES = [
  'chase',
  'wrestle',
  'toys',
  'calm_walk',
  /** Acicalarse mutuamente: conejos, cobayas, ratas. Señal fuerte de vínculo. */
  'grooming',
  /** Estar al lado sin interactuar. Para muchas especies es el objetivo. */
  'side_by_side',
  /** Buscar comida escondida. Hurones, ratas, aves. */
  'forage',
] as const;
export type PlayStyle = (typeof PLAY_STYLES)[number];

export type SpeciesProfile = {
  id: string;
  commonName: string;
  scientificName: string;
  taxonGroup: TaxonGroup;
  socialModel: SocialModel;
  /** Estilos de juego que tiene sentido preguntar para esta especie. */
  applicablePlayStyles: readonly PlayStyle[];
  /**
   * Especies a las que esta puede depredar, o por las que puede ser depredada.
   *
   * Hoy los encuentros son siempre entre la misma especie, así que esto no
   * cambia ningún resultado. Está aquí para poder explicar **por qué** cuando
   * alguien pregunte, y para que el día que se estudien encuentros mixtos la
   * información ya esté modelada en vez de improvisada.
   */
  predatorPreyWith: readonly string[];
  /** Vacunas o pruebas que conviene tener al día antes de un encuentro. */
  healthForMeetups: readonly string[];
  /**
   * Meses hasta dejar de considerarse juvenil.
   *
   * Varía muchísimo: un perro sigue siendo cachorro al año, una rata es adulta a
   * los tres meses. Usar el umbral del perro para todas convertiría a media
   * fauna del catálogo en cachorros perpetuos.
   */
  juvenileUntilMonths: number;
  legal: readonly LegalEntry[];
  /** Nota para el tutor, en su idioma, sobre por qué su especie no queda. */
  socialNote: string;
};

const SPAIN = 'ES';

const LEY_7_2023 =
  'Ley 7/2023, de 28 de marzo, de protección de los derechos y el bienestar de los animales';
const LEY_7_2023_URL = 'https://www.boe.es/buscar/doc.php?id=BOE-A-2023-7936';

const companionByLaw: LegalEntry = {
  jurisdiction: SPAIN,
  status: 'companion_animal',
  note: 'Considerado animal de compañía por la propia ley, sin depender del listado positivo.',
  source: `${LEY_7_2023} — ${LEY_7_2023_URL}`,
};

const domesticSpecies: LegalEntry = {
  jurisdiction: SPAIN,
  status: 'domestic',
  note: 'Especie doméstica, no fauna silvestre; queda fuera del ámbito del listado positivo.',
  source: `${LEY_7_2023} — ${LEY_7_2023_URL}`,
};

const pendingPositiveList = (extra = ''): LegalEntry => ({
  jurisdiction: SPAIN,
  status: 'positive_list_pending',
  note:
    'Especie silvestre: su tenencia como animal de compañía depende del listado positivo, ' +
    'cuyo desarrollo reglamentario seguía en tramitación. Comprueba el listado vigente antes ' +
    'de adquirirla o registrarla.' +
    (extra ? ` ${extra}` : ''),
  source: `${LEY_7_2023} — ${LEY_7_2023_URL}`,
});

const excluded = (reason: string): LegalEntry => ({
  jurisdiction: SPAIN,
  status: 'excluded',
  note: reason,
  source: `${LEY_7_2023} — ${LEY_7_2023_URL}`,
});

/**
 * Especies del catálogo inicial.
 *
 * No pretende ser exhaustivo: el catálogo es una tabla, y añadir una especie es
 * añadir una fila con su modelo social y su estado legal. Lo que sí pretende es
 * cubrir de verdad los tres modelos sociales, para que ninguno quede como un
 * caso de segunda.
 */
export const SPECIES: readonly SpeciesProfile[] = [
  {
    id: 'dog',
    commonName: 'Perro',
    scientificName: 'Canis familiaris',
    taxonGroup: 'mammal_carnivore',
    socialModel: 'pack',
    applicablePlayStyles: ['chase', 'wrestle', 'toys', 'calm_walk'],
    predatorPreyWith: ['rabbit', 'guinea_pig', 'rat', 'hamster', 'canary', 'budgerigar'],
    healthForMeetups: ['Polivalente al día', 'Antiparasitario al día', 'Rabia según comunidad'],
    juvenileUntilMonths: 12,
    legal: [companionByLaw],
    socialNote:
      'El perro es la única especie del catálogo que socializa bien en grupo abierto con ' +
      'desconocidos. Por eso las quedadas y el radar están pensados alrededor de él.',
  },
  {
    id: 'cat',
    commonName: 'Gato',
    scientificName: 'Felis catus',
    taxonGroup: 'mammal_carnivore',
    socialModel: 'solitary',
    applicablePlayStyles: ['chase', 'toys'],
    predatorPreyWith: ['rat', 'hamster', 'canary', 'budgerigar', 'gerbil'],
    healthForMeetups: [],
    juvenileUntilMonths: 12,
    legal: [companionByLaw],
    socialNote:
      'Los gatos son territoriales: llevar al tuyo a conocer a otro gato le genera estrés, no ' +
      'compañía. Coincide no organiza encuentros de gatos. Lo que sí ofrece es comunidad de ' +
      'tutores, veterinarios felinos y alojamientos que los admiten.',
  },
  {
    id: 'ferret',
    commonName: 'Hurón',
    scientificName: 'Mustela putorius furo',
    taxonGroup: 'mammal_carnivore',
    socialModel: 'small_group',
    applicablePlayStyles: ['chase', 'wrestle', 'toys', 'forage'],
    predatorPreyWith: ['rabbit', 'guinea_pig', 'rat', 'hamster', 'canary', 'budgerigar', 'gerbil'],
    healthForMeetups: ['Moquillo al día', 'Rabia según comunidad', 'Desparasitación reciente'],
    juvenileUntilMonths: 4,
    legal: [companionByLaw],
    socialNote:
      'Los hurones juegan muy bien entre ellos, pero en grupos pequeños y con presentación ' +
      'gradual en terreno neutral. Nada de sueltas masivas.',
  },
  {
    id: 'rabbit',
    commonName: 'Conejo',
    scientificName: 'Oryctolagus cuniculus',
    taxonGroup: 'mammal_lagomorph',
    socialModel: 'small_group',
    applicablePlayStyles: ['chase', 'grooming', 'side_by_side', 'forage'],
    predatorPreyWith: ['dog', 'ferret', 'cat'],
    healthForMeetups: ['Mixomatosis al día', 'Enfermedad hemorrágica vírica al día'],
    juvenileUntilMonths: 6,
    legal: [domesticSpecies],
    socialNote:
      'Los conejos son sociales, pero presentarlos es un proceso delicado: territorio neutral, ' +
      'sesiones cortas y supervisión constante. Una presentación mal hecha acaba en peleas ' +
      'graves de verdad.',
  },
  {
    id: 'guinea_pig',
    commonName: 'Cobaya',
    scientificName: 'Cavia porcellus',
    taxonGroup: 'mammal_rodent',
    socialModel: 'small_group',
    applicablePlayStyles: ['side_by_side', 'forage', 'grooming'],
    predatorPreyWith: ['dog', 'ferret', 'cat'],
    healthForMeetups: ['Revisión reciente de piel y respiratoria'],
    juvenileUntilMonths: 4,
    legal: [domesticSpecies],
    socialNote:
      'Las cobayas viven mejor acompañadas, pero se presentan en espacio neutral y con calma. ' +
      'No se mezclan con conejos: la diferencia de tamaño y de lenguaje corporal las pone en ' +
      'riesgo.',
  },
  {
    id: 'rat',
    commonName: 'Rata',
    scientificName: 'Rattus norvegicus domestica',
    taxonGroup: 'mammal_rodent',
    socialModel: 'small_group',
    applicablePlayStyles: ['chase', 'wrestle', 'grooming', 'forage'],
    predatorPreyWith: ['dog', 'cat', 'ferret'],
    healthForMeetups: ['Sin síntomas respiratorios', 'Cuarentena tras contacto reciente'],
    juvenileUntilMonths: 3,
    legal: [domesticSpecies],
    socialNote:
      'Son de las especies más sociales del catálogo y disfrutan de compañía de su especie, ' +
      'con presentación gradual.',
  },
  {
    id: 'hamster',
    commonName: 'Hámster sirio',
    scientificName: 'Mesocricetus auratus',
    taxonGroup: 'mammal_rodent',
    socialModel: 'solitary',
    applicablePlayStyles: ['forage'],
    predatorPreyWith: ['dog', 'cat', 'ferret'],
    healthForMeetups: [],
    juvenileUntilMonths: 2,
    legal: [domesticSpecies],
    socialNote:
      'El hámster sirio es solitario de forma estricta: juntar dos adultos termina en peleas ' +
      'que pueden ser mortales. Coincide no organiza encuentros de hámsteres, y esto no es una ' +
      'limitación de la aplicación sino de la especie.',
  },
  {
    id: 'gerbil',
    commonName: 'Jerbo',
    scientificName: 'Meriones unguiculatus',
    taxonGroup: 'mammal_rodent',
    socialModel: 'solitary',
    applicablePlayStyles: ['forage'],
    predatorPreyWith: ['dog', 'cat', 'ferret'],
    healthForMeetups: [],
    juvenileUntilMonths: 3,
    legal: [domesticSpecies],
    socialNote:
      'Viven bien en grupo estable dentro de casa, pero no aceptan desconocidos: introducir un ' +
      'jerbo ajeno en su territorio provoca peleas.',
  },
  {
    id: 'budgerigar',
    commonName: 'Periquito',
    scientificName: 'Melopsittacus undulatus',
    taxonGroup: 'bird',
    socialModel: 'solitary',
    applicablePlayStyles: ['forage', 'side_by_side'],
    predatorPreyWith: ['cat', 'dog', 'ferret'],
    healthForMeetups: [],
    juvenileUntilMonths: 8,
    legal: [domesticSpecies],
    socialNote:
      'Son muy sociales dentro de su bandada, pero juntar aves de casas distintas es una vía ' +
      'directa de contagio —psitacosis, entre otras—. Coincide ofrece comunidad y veterinarios ' +
      'de exóticos, no encuentros.',
  },
  {
    id: 'canary',
    commonName: 'Canario',
    scientificName: 'Serinus canaria domestica',
    taxonGroup: 'bird',
    socialModel: 'solitary',
    applicablePlayStyles: ['side_by_side'],
    predatorPreyWith: ['cat', 'dog', 'ferret'],
    healthForMeetups: [],
    juvenileUntilMonths: 8,
    legal: [domesticSpecies],
    socialNote:
      'Mismo motivo que el resto de aves: el riesgo sanitario de mezclar ejemplares de hogares ' +
      'distintos no compensa.',
  },
  {
    id: 'leopard_gecko',
    commonName: 'Gecko leopardo',
    scientificName: 'Eublepharis macularius',
    taxonGroup: 'reptile',
    socialModel: 'solitary',
    applicablePlayStyles: [],
    predatorPreyWith: ['cat', 'dog'],
    healthForMeetups: [],
    juvenileUntilMonths: 12,
    legal: [
      pendingPositiveList(
        'Reptil de menos de 2 kg en estado adulto y no venenoso, que son los dos criterios de ' +
          'exclusión expresos del proyecto de desarrollo.',
      ),
    ],
    socialNote:
      'Los reptiles no socializan: la compañía les genera estrés, no bienestar. Además son ' +
      'portadores habituales de salmonela, así que un encuentro sería un problema de salud ' +
      'pública. Aquí encuentras comunidad de tutores y veterinarios especializados.',
  },
  {
    id: 'bearded_dragon',
    commonName: 'Dragón barbudo',
    scientificName: 'Pogona vitticeps',
    taxonGroup: 'reptile',
    socialModel: 'solitary',
    applicablePlayStyles: [],
    predatorPreyWith: ['cat', 'dog'],
    healthForMeetups: [],
    juvenileUntilMonths: 12,
    legal: [
      pendingPositiveList('No venenoso y por debajo de los 2 kg en adulto en condiciones normales.'),
    ],
    socialNote:
      'Territorial con los de su especie. Dos machos juntos pelean. No hay encuentros, pero sí ' +
      'comunidad y directorio de veterinarios de exóticos.',
  },
  {
    id: 'greek_tortoise',
    commonName: 'Tortuga mora',
    scientificName: 'Testudo graeca',
    taxonGroup: 'reptile',
    socialModel: 'solitary',
    applicablePlayStyles: [],
    predatorPreyWith: ['dog'],
    healthForMeetups: [],
    juvenileUntilMonths: 60,
    legal: [
      {
        jurisdiction: SPAIN,
        status: 'restricted',
        note:
          'Especie incluida en CITES: exige documentación de origen legal y, según la comunidad ' +
          'autónoma, registro del ejemplar. Sin ese papeleo su tenencia no es legal.',
        source:
          'CITES / Reglamento (CE) 338/97 — https://cites.org/esp · ' +
          `${LEY_7_2023} — ${LEY_7_2023_URL}`,
      },
    ],
    socialNote:
      'Solitaria y de vida muy larga. Coincide se centra en el papeleo, los veterinarios y la ' +
      'comunidad de tutores, no en encuentros.',
  },
  {
    id: 'betta',
    commonName: 'Pez betta',
    scientificName: 'Betta splendens',
    taxonGroup: 'fish',
    socialModel: 'solitary',
    applicablePlayStyles: [],
    predatorPreyWith: [],
    healthForMeetups: [],
    juvenileUntilMonths: 6,
    legal: [domesticSpecies],
    socialNote:
      'El betta macho ataca a otros machos hasta matarlos; su nombre común es literalmente ' +
      '"pez luchador". No hay encuentros posibles. Sí hay comunidad de acuariofilia.',
  },
  {
    id: 'monk_parakeet',
    commonName: 'Cotorra argentina',
    scientificName: 'Myiopsitta monachus',
    taxonGroup: 'bird',
    socialModel: 'solitary',
    applicablePlayStyles: [],
    predatorPreyWith: [],
    healthForMeetups: [],
    juvenileUntilMonths: 12,
    legal: [
      excluded(
        'Incluida en el Catálogo Español de Especies Exóticas Invasoras: su tenencia, cría y ' +
          'comercio están prohibidos. No puede registrarse en Coincide.',
      ),
    ],
    // El modelo social de una especie prohibida no se llega a usar nunca: la
    // base de datos rechaza el registro antes. Se deja en `solitary` porque es
    // el valor que no habilita nada, no porque la cotorra sea solitaria —es un
    // ave gregaria—, y por eso la nota habla de la ley y no del carácter.
    socialNote: 'No procede: la especie no puede tenerse como animal de compañía en España.',
  },
];

const BY_ID = new Map(SPECIES.map((species) => [species.id, species]));

export function findSpecies(id: string): SpeciesProfile | null {
  return BY_ID.get(id) ?? null;
}

/** Especies que un tutor puede registrar en una jurisdicción. */
export function registrableSpecies(jurisdiction: string = SPAIN): SpeciesProfile[] {
  return SPECIES.filter((species) => {
    const entry = species.legal.find((legal) => legal.jurisdiction === jurisdiction);
    return entry !== undefined && entry.status !== 'excluded';
  });
}

/** Estado legal de una especie en una jurisdicción, si se conoce. */
export function legalStatusIn(species: SpeciesProfile, jurisdiction: string = SPAIN): LegalEntry | null {
  return species.legal.find((entry) => entry.jurisdiction === jurisdiction) ?? null;
}

/** ¿Esta especie participa en encuentros presenciales? */
export function hasMeetups(species: SpeciesProfile): boolean {
  return species.socialModel !== 'solitary';
}

/**
 * ¿Esta especie puede depredar a la otra, o al revés?
 *
 * La relación se declara en las dos direcciones del catálogo, pero se comprueba
 * en ambas de todos modos: un dato mal introducido en una sola dirección no
 * debería poder convertirse en un encuentro peligroso.
 */
export function isPredatorPreyPair(a: SpeciesProfile, b: SpeciesProfile): boolean {
  return a.predatorPreyWith.includes(b.id) || b.predatorPreyWith.includes(a.id);
}

export const SOCIAL_MODEL_LABEL: Record<SocialModel, string> = {
  pack: 'Socializa en grupo',
  small_group: 'Socializa en grupo pequeño',
  solitary: 'No socializa con otros animales',
};

export const TAXON_LABEL: Record<TaxonGroup, string> = {
  mammal_carnivore: 'Mamífero carnívoro',
  mammal_lagomorph: 'Lagomorfo',
  mammal_rodent: 'Roedor',
  bird: 'Ave',
  reptile: 'Reptil',
  amphibian: 'Anfibio',
  fish: 'Pez',
  invertebrate: 'Invertebrado',
};

export const LEGAL_STATUS_LABEL: Record<LegalStatus, string> = {
  companion_animal: 'Animal de compañía por ley',
  domestic: 'Especie doméstica',
  positive_list_pending: 'Pendiente del listado positivo',
  restricted: 'Permitida con requisitos',
  excluded: 'No permitida',
};

/**
 * Aviso que acompaña a cualquier información legal de la aplicación.
 *
 * Se exporta como constante para que sea imposible mostrar un estado legal sin
 * él: si alguien lo olvida en una pantalla, se nota en la revisión porque el
 * dato viaja sin su advertencia.
 */
export const LEGAL_DISCLAIMER =
  'Coincide no da asesoramiento legal. Esta información es orientativa y puede quedar ' +
  'desactualizada: la lista vigente es siempre la del organismo competente.';
