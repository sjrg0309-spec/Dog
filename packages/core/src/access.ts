/**
 * Quién entra, y qué ve el que entra.
 *
 * Petnav **no tiene modo mirón**. Para registrarse hay que dar de alta un
 * animal, con su nombre, su especie, su edad, su tamaño, su carácter y su
 * horario de paseo. No es un formulario largo por gusto: es lo único que
 * distingue esta aplicación de un directorio de dónde y a qué hora hay perros
 * sueltos en tu barrio.
 *
 * ## Lo que esto sí evita y lo que no
 *
 * Conviene decirlo entero, porque la mitad se vende sola y la otra mitad es la
 * que importa:
 *
 * **No evita** que alguien que roba animales se registre. Cualquiera puede
 * escribir «Nina, mestiza, cuatro años» y entrar. Prometer lo contrario sería
 * mentir, y peor: haría que alguien bajara la guardia en el parque porque «la
 * aplicación verifica».
 *
 * **Sí evita** —y esto es lo que de verdad se puede construir— que se pueda
 * **mirar sin dejar nada**. Las tres cosas que le sirven a quien busca animales
 * para llevárselos son la cara, el sitio y la hora, y las tres están detrás de
 * algo que cuesta: un chip verificado con documento veterinario. Una cuenta
 * hecha en treinta segundos ve el mapa de parques, fuentes y veterinarios —que
 * es información de sitios, no de personas— y no ve quién está fuera ahora ni a
 * qué hora sale nadie.
 *
 * Ese es el reparto: **los sitios son públicos, las personas no**. Encaja con
 * lo que la aplicación ya prometía —el radar ancla al lugar y nunca a la
 * persona, el horario exacto solo se revela como coincidencia— y le pone la
 * puerta que faltaba.
 *
 * ## Por qué el papel de rescatista también está detrás de la puerta
 *
 * Porque amplía a kilómetros lo que te llega sobre animales heridos, perdidos o
 * sin dueño. Es exactamente la lista que no debe poder consultar quien esté
 * buscando animales fáciles de coger, y por eso pide chip verificado igual que
 * el mapa de gente. Fue lo primero que miré al escribir esto, y era el hueco
 * más grande que había.
 *
 * ## La segunda puerta: quien no tiene animal pero rescata
 *
 * Hay gente que tiene que estar aquí y no tiene perro: protectoras, albergues,
 * casas de acogida, quien alimenta colonias. Dejarlas fuera por la regla de
 * arriba sería quitarle a esta aplicación justo a las personas que la usarían
 * para lo que más importa.
 *
 * Entran por otra puerta y **a otra habitación**. Se pide el enlace al perfil
 * público del colectivo —la cuenta que ya tienen y que ya se puede mirar— y la
 * cuenta queda **pendiente de revisión** hasta que alguien la mire. Aprobada,
 * abre los avisos de rescate a kilómetros y poder escribir el primero.
 *
 * Y **no** abre quién está paseando ahora ni los horarios de nadie. No es un
 * descuido: una protectora no necesita saber a qué hora saca cada vecino a su
 * perro, y esa lista es exactamente la que no debe ampliarse por una vía que se
 * abre enseñando un enlace. Distinta puerta, distinta habitación.
 *
 * Lo que aquí no se puede hacer, y se dice en la pantalla: **comprobar solo que
 * el perfil existe y es de quien lo enseña**. No hay API que lo diga, y aunque
 * la hubiera, un enlace a una cuenta ajena lo pega cualquiera. Por eso la
 * revisión es humana y por eso, mientras tanto, la cuenta ve lo mismo que una
 * recién hecha: sitios, y ninguna persona.
 *
 * ## La escalera, y por qué no es una insignia
 *
 * Cuatro peldaños: sin cuenta, con animal declarado, con chip verificado, y
 * asentado —que se gana paseando, no diciendo nada—. Lo que cambia en cada uno
 * es **qué se ve**, no qué medalla sale al lado del nombre. Una insignia sin
 * consecuencias es decoración; esto decide consultas.
 */

/**
 * Los peldaños. `none` no entra: no hay modo de solo mirar.
 *
 * Los cuatro primeros son la escalera del tutor; los dos últimos son la puerta
 * del rescate, que no es «más arriba» ni «más abajo» sino **otro sitio**: una
 * protectora aprobada ve más rescate que un tutor verificado y menos gente.
 */
export type AccessLevel =
  | 'none'
  | 'declared'
  | 'verified'
  | 'established'
  | 'shelter_pending'
  | 'shelter';

/** Por qué puerta se entra. */
export type AccountKind = 'tutor' | 'rescuer';

export type Capability =
  /** El mapa de sitios: parques, agua, sombra, veterinarios, zonas marcadas. */
  | 'places'
  /** El feed del vecindario y los perfiles públicos de otros animales. */
  | 'feed'
  /**
   * El tablero de rescate: animales perdidos, en peligro o que necesitan ayuda
   * cerca. Es lo único que enseña una cuenta de protectora, y es a propósito.
   */
  | 'rescue_board'
  /** Publicar tu propia presencia. Expone solo a quien la pulsa. */
  | 'check_in'
  /** Las caras de quién está fuera ahora mismo. */
  | 'live_people'
  /** La coincidencia de horarios: «coincidís los martes a las 7». */
  | 'schedules'
  /** Escribir el primero a alguien con quien no has quedado nunca. */
  | 'message_first'
  /** Recibir avisos de rescate con el alcance de quien se desplaza. */
  | 'rescue_alerts'
  /** Organizar una quedada o publicar un espacio privado. */
  | 'host';

/**
 * Qué abre cada peldaño, escrito entero.
 *
 * Es una tabla y no una comparación de niveles porque los niveles **no están en
 * una línea**: una protectora aprobada tiene avisos de rescate que un tutor
 * verificado también tiene, y no tiene el mapa de gente que ese tutor sí. Con
 * un `>=` eso no se puede decir, y al intentarlo se acaba dando de más.
 */
const ALLOWED: Record<AccessLevel, readonly Capability[]> = {
  none: [],
  declared: ['places', 'feed', 'rescue_board', 'check_in'],
  verified: [
    'places',
    'feed',
    'rescue_board',
    'check_in',
    'live_people',
    'schedules',
    'message_first',
    'rescue_alerts',
  ],
  established: [
    'places',
    'feed',
    'rescue_board',
    'check_in',
    'live_people',
    'schedules',
    'message_first',
    'rescue_alerts',
    'host',
  ],
  /*
   * Mientras se mira el perfil: los sitios y el tablero de rescate.
   *
   * El tablero está desde el principio porque es a lo que vienen —animales
   * perdidos o en peligro cerca— y porque es información que ya está publicada:
   * quien abre un aviso de perro perdido quiere que lo vea el máximo de gente.
   * Lo que la espera no abre son los avisos a kilómetros ni escribir el
   * primero. Si la espera abriera eso, la espera sería la vía de entrada.
   */
  shelter_pending: ['places', 'rescue_board'],
  /*
   * Aprobada: todo el rescate y ninguna persona.
   *
   * **Sin `feed`**, y esa es la decisión que define esta cuenta. Una protectora
   * no entra a ver fotos del perro de nadie: entra a ver qué animal necesita
   * ayuda cerca. Dejarle el feed social sería convertir una herramienta de
   * trabajo en otra aplicación de la que salir, y de paso darle a una cuenta
   * que no tiene animal propio una ventana al vecindario que no necesita para
   * nada.
   *
   * `check_in` tampoco, porque no hay animal propio que esté fuera.
   */
  shelter: ['places', 'rescue_board', 'rescue_alerts', 'message_first'],
};

/** Todas las capacidades, para que un test pueda recorrerlas sin listarlas. */
export const CAPABILITIES: readonly Capability[] = [
  'places',
  'feed',
  'rescue_board',
  'check_in',
  'live_people',
  'schedules',
  'message_first',
  'rescue_alerts',
  'host',
];

export type AccountState = {
  kind: AccountKind;
  /** Animales dados de alta. Para un tutor, cero es cero: no se entra. */
  pets: number;
  /** Chip comprobado con documento veterinario, no solo escrito. */
  microchipVerified: boolean;
  /** Paseos registrados de verdad. */
  walks: number;
  /** Quedadas a las que se ha ido y alguien ha confirmado. */
  meetupsAttended: number;
  /** El perfil público del colectivo, ya comprobado de forma. */
  shelterProfile?: string | null;
  /** Alguien lo ha mirado y dice que es lo que dice ser. */
  shelterReviewed?: boolean;
};

/** Paseos que hacen falta para el último peldaño, si no ha habido quedadas. */
export const ESTABLISHED_MIN_WALKS = 5;

export function accessLevel(account: AccountState): AccessLevel {
  if (account.kind === 'rescuer') {
    /* Sin enlace no hay puerta: es lo único que se pide y lo único que se puede
       mirar después. Y aprobar es un acto de alguien, nunca del tiempo que
       pase. */
    if (!account.shelterProfile) return 'none';
    return account.shelterReviewed ? 'shelter' : 'shelter_pending';
  }

  if (account.pets < 1) return 'none';
  if (!account.microchipVerified) return 'declared';
  /* El último peldaño **se gana usando la aplicación**, no rellenando nada. Es
     la única parte de la escalera que no se puede escribir a mano, y por eso es
     la que guarda lo que más daño haría en malas manos: organizar quedadas y
     abrir la puerta de tu casa a un grupo. */
  if (account.walks >= ESTABLISHED_MIN_WALKS || account.meetupsAttended >= 1) {
    return 'established';
  }
  return 'verified';
}

export function can(level: AccessLevel, capability: Capability): boolean {
  return ALLOWED[level].includes(capability);
}

/**
 * Qué falta para poder hacer algo, en llano y sin regañar.
 *
 * Una puerta cerrada sin explicación se lee como un fallo o como un cobro. Esto
 * dice qué falta y **por qué se pide**, que es lo que convierte un muro en una
 * regla que se puede compartir. Y no dice lo mismo en las dos puertas: a una
 * protectora no le falta un chip, le falta que alguien mire su perfil —o no le
 * falta nada, porque eso no es para ella—.
 */
export function whyNot(level: AccessLevel, capability: Capability): string | null {
  if (can(level, capability)) return null;

  if (level === 'none') {
    return 'Da de alta a tu mascota para entrar. Si rescatas y no tienes, entra como protectora.';
  }

  if (level === 'shelter_pending') {
    return 'Estamos revisando vuestro perfil. Mientras tanto solo veréis sitios.';
  }

  if (level === 'shelter') {
    return REASON_SHELTER[capability] ?? 'Esto no forma parte de la cuenta de una protectora.';
  }

  if (capability === 'host') {
    return `Se abre con ${ESTABLISHED_MIN_WALKS} paseos registrados o una quedada a la que hayas ido.`;
  }

  return REASON_VERIFIED[capability] ?? 'Verifica el chip con la cartilla para ver esto.';
}

/**
 * Lo que una protectora aprobada no tiene, y por qué no es un olvido.
 *
 * Es la parte de esta decisión con la que alguien puede no estar de acuerdo, así
 * que se escribe entera: la puerta del rescate abre avisos de animales en
 * peligro, no el mapa de a qué hora saca cada vecino a su perro. Si abriera eso,
 * enseñar el enlace de una cuenta ajena sería la forma más barata de conseguir
 * justo la lista que esta aplicación protege.
 */
const REASON_SHELTER: Partial<Record<Capability, string>> = {
  feed: 'Las cuentas de protectora no tienen feed social. Aquí veis lo que necesita ayuda, no fotos.',
  live_people:
    'Las cuentas de protectora no ven quién pasea. Rescatar no necesita saber a qué hora sale cada vecino.',
  schedules: 'Las cuentas de protectora no ven horarios de vecinos.',
  check_in: 'No tienes animal dado de alta, así que no hay presencia que publicar.',
  host: 'Las quedadas las organizan tutores con animal dado de alta.',
};

const REASON_VERIFIED: Partial<Record<Capability, string>> = {
  live_people:
    'Verifica el chip para ver quién pasea ahora. Los sitios se ven siempre; las personas, no.',
  schedules: 'Verifica el chip para ver horarios. El horario de alguien es su rutina diaria.',
  message_first: 'Verifica el chip para escribir primero. Responder no hace falta.',
  rescue_alerts:
    'Verifica el chip para recibir avisos de rescate. Son animales heridos o perdidos, y no se abren a cualquiera.',
};

/**
 * Lo que hay que rellenar para dar de alta a un animal.
 *
 * El chip **no** está en la lista, y es una decisión con la que se puede no
 * estar de acuerdo: hay animales sin chip, adoptados hace años o de países
 * donde no era obligatorio, y dejar fuera a sus tutores no protege a nadie. El
 * chip abre puertas en vez de cerrar la entrada.
 *
 * El horario sí está, y es lo que más se discute. Va dentro porque es la mitad
 * del producto —cruzar horarios es lo que hace que esto funcione a las once de
 * la noche— y porque un alta sin horario deja una cuenta que solo mira, que es
 * justo lo que no queremos.
 */
export type PetDraft = {
  name: string;
  speciesId: string;
  ageMonths: number | null;
  size: string | null;
  energy: string | null;
  playStyles: readonly string[];
  /** Franjas de paseo declaradas. Al menos una. */
  availability: number;
};

export const REGISTRATION_STEPS = [
  'name',
  'species',
  'age',
  'size',
  'temperament',
  'schedule',
] as const;

export type RegistrationStep = (typeof REGISTRATION_STEPS)[number];

/** Qué le falta al alta, en el orden en que se pregunta. */
export function missingSteps(draft: PetDraft): RegistrationStep[] {
  const missing: RegistrationStep[] = [];
  if (draft.name.trim().length < 2) missing.push('name');
  if (draft.speciesId.trim() === '') missing.push('species');
  if (draft.ageMonths === null || draft.ageMonths < 0) missing.push('age');
  if (draft.size === null) missing.push('size');
  if (draft.energy === null || draft.playStyles.length === 0) missing.push('temperament');
  if (draft.availability < 1) missing.push('schedule');
  return missing;
}

export function isComplete(draft: PetDraft): boolean {
  return missingSteps(draft).length === 0;
}

export const STEP_LABEL: Record<RegistrationStep, string> = {
  name: 'Su nombre',
  species: 'Qué animal es',
  age: 'Su edad',
  size: 'Su tamaño',
  temperament: 'Su carácter',
  schedule: 'Vuestro horario',
};

/**
 * Lo que se le dice a quien se está registrando, tal cual.
 *
 * Sin esto la puerta parece un capricho. Con esto es una postura que alguien
 * puede repetirle a un vecino en el parque, que es como se sostienen las reglas
 * de una comunidad.
 */
export const GATE_NOTE =
  'Para entrar tienes que dar de alta a tu mascota. Dentro está quién pasea por tu barrio y a qué hora.';

export const CHIP_NOTE =
  'El chip no lleva GPS: no localiza a tu perro. Sirve para que te lo devuelvan si se pierde, y aquí para poder ver a otra gente.';

export const HONESTY_NOTE =
  'Esto no impide que alguien se registre con datos falsos. Sí impide que una cuenta nueva vea quién sale y a qué hora.';

/**
 * El enlace del colectivo.
 *
 * Lo primero, porque decide cómo hay que leer todo lo demás: **esto no
 * comprueba que la protectora sea real, ni que el perfil sea tuyo**. No hay API
 * pública que lo diga, y aunque la hubiera, el enlace de una cuenta ajena lo
 * pega cualquiera en diez segundos. Lo único que se puede hacer en código es
 * mirar la forma del enlace, y eso es lo que hace esto.
 *
 * Aun así vale la pena, porque descarta lo que se manda cuando no hay nada
 * detrás:
 *
 *  - **Un acortador** (bit.ly y compañía). Un enlace que no dice a dónde va no
 *    se puede revisar, y quien revisa acabaría abriendo lo que le manden.
 *  - **Una publicación suelta** en vez de un perfil. Un post no enseña ni
 *    cuánto tiempo lleva la cuenta ni qué hace: es la captura de un momento, y
 *    es lo que se manda cuando se quiere pasar rápido.
 *  - **Un perfil sin nombre de usuario**: la raíz de la red, o una búsqueda.
 *
 * Lo que sí acepta es una web propia, y no por generosidad: en América Latina
 * media protectora se organiza en una página de Facebook o en un sitio hecho a
 * mano, y exigir una lista cerrada de redes dejaría fuera a las de siempre.
 */
export type ShelterProfileCheck =
  | { ok: true; normalized: string; platform: string; handle: string | null }
  | { ok: false; reason: string };

/** Acortadores. La lista es corta a propósito: son los que se usan. */
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'cutt.ly', 'is.gd'];

const PLATFORMS: ReadonlyArray<{ host: RegExp; name: string; postPaths: readonly string[] }> = [
  { host: /(^|\.)instagram\.com$/, name: 'Instagram', postPaths: ['p', 'reel', 'reels', 'stories', 'explore'] },
  { host: /(^|\.)facebook\.com$/, name: 'Facebook', postPaths: ['photo', 'watch', 'story.php', 'permalink.php'] },
  { host: /(^|\.)(twitter|x)\.com$/, name: 'X', postPaths: ['status', 'i', 'search'] },
  { host: /(^|\.)tiktok\.com$/, name: 'TikTok', postPaths: ['video', 'tag', 'search'] },
  { host: /(^|\.)youtube\.com$/, name: 'YouTube', postPaths: ['watch', 'shorts', 'results'] },
];

export function validateShelterProfile(input: string): ShelterProfileCheck {
  const raw = input.trim();
  if (raw === '') return { ok: false, reason: 'Falta el enlace al perfil del colectivo.' };

  let url: URL;
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: 'Eso no parece un enlace.' };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'El enlace tiene que ser de una página web.' };
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (SHORTENERS.includes(host)) {
    return {
      ok: false,
      reason: 'Pega la dirección completa. Los enlaces acortados no podemos revisarlos.',
    };
  }

  const segments = url.pathname.split('/').filter((part) => part !== '');
  const platform = PLATFORMS.find((candidate) => candidate.host.test(host));

  if (platform) {
    if (segments.length === 0) {
      return { ok: false, reason: `Eso es la portada de ${platform.name}, no un perfil.` };
    }
    const first = segments[0]!.toLowerCase();
    if (platform.postPaths.includes(first)) {
      return {
        ok: false,
        reason: 'Eso es una publicación. Pega el enlace del perfil.',
      };
    }
    const handle = first.replace(/^@/, '');
    return { ok: true, normalized: `https://${host}/${handle}`, platform: platform.name, handle };
  }

  /* Una web propia. Se pide que tenga dominio de verdad —dos partes al menos—
     para descartar un `localhost` o un nombre a medio escribir. */
  if (!host.includes('.') || host.endsWith('.')) {
    return { ok: false, reason: 'Ese enlace no lleva a ningún sitio.' };
  }

  return { ok: true, normalized: `https://${host}${url.pathname.replace(/\/$/, '')}`, platform: 'su web', handle: null };
}

/** Lo que hace una protectora, en opciones y no en un campo de texto libre. */
export const SHELTER_ACTIVITIES = [
  { id: 'shelter', label: 'Albergue con instalaciones' },
  { id: 'foster', label: 'Casas de acogida' },
  { id: 'street_feeding', label: 'Alimentación de perros en calle' },
  { id: 'spay', label: 'Campañas de esterilización' },
  { id: 'poisoning', label: 'Respuesta a envenenamientos' },
  { id: 'adoption', label: 'Adopciones' },
] as const;

export type ShelterActivity = (typeof SHELTER_ACTIVITIES)[number]['id'];

export type ShelterDraft = {
  name: string;
  profile: string;
  activities: readonly string[];
};

export function missingShelterFields(draft: ShelterDraft): string[] {
  const missing: string[] = [];
  if (draft.name.trim().length < 3) missing.push('El nombre del colectivo');
  const link = validateShelterProfile(draft.profile);
  if (!link.ok) missing.push(link.reason);
  if (draft.activities.length === 0) missing.push('Qué hacéis');
  return missing;
}

export const SHELTER_GATE_NOTE =
  'Si rescatas y no tienes mascota propia, entra con el perfil público de tu colectivo.';

export const SHELTER_REVIEW_NOTE =
  'Lo mira una persona, no un robot: no hay forma de comprobarlo en automático. Mientras tanto ya podéis ver los sitios del mapa.';

export const SHELTER_SCOPE_NOTE =
  'En cuanto os aprobemos os llegarán los avisos de rescate de varios kilómetros. Lo que no veréis es quién pasea ni a qué hora sale nadie.';
