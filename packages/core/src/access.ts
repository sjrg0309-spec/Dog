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
  declared: ['places', 'feed', 'check_in'],
  verified: ['places', 'feed', 'check_in', 'live_people', 'schedules', 'message_first', 'rescue_alerts'],
  established: [
    'places',
    'feed',
    'check_in',
    'live_people',
    'schedules',
    'message_first',
    'rescue_alerts',
    'host',
  ],
  /* Mientras se mira el perfil, lo mismo que una cuenta recién hecha: sitios.
     Si la espera diera acceso a algo, la espera sería la vía de entrada. */
  shelter_pending: ['places', 'feed'],
  /* Aprobada: todo el rescate y ninguna persona. `check_in` tampoco, porque no
     hay animal propio que esté fuera. */
  shelter: ['places', 'feed', 'rescue_alerts', 'message_first'],
};

/** Todas las capacidades, para que un test pueda recorrerlas sin listarlas. */
export const CAPABILITIES: readonly Capability[] = [
  'places',
  'feed',
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
    return 'Para esto hace falta una cuenta: da de alta a tu animal, o entra como protectora enseñando el perfil público del colectivo. Aquí no se entra a mirar.';
  }

  if (level === 'shelter_pending') {
    return 'Estamos mirando el perfil que enseñaste. Hasta entonces ves lo mismo que una cuenta recién hecha: los sitios. Si esperar abriera algo, esperar sería la vía de entrada.';
  }

  if (level === 'shelter') {
    return REASON_SHELTER[capability] ?? 'Esto no forma parte de la cuenta de una protectora.';
  }

  if (capability === 'host') {
    return `Esto se abre al llevar ${ESTABLISHED_MIN_WALKS} paseos registrados o una quedada a la que hayas ido. No se pide nada: sale solo.`;
  }

  return REASON_VERIFIED[capability] ?? 'Hace falta verificar el chip con la cartilla.';
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
  live_people:
    'Ver quién pasea ahora no entra en la cuenta de una protectora. No es desconfianza: es que rescatar no necesita saber a qué hora sale cada vecino, y esa lista no se abre por enseñar un enlace.',
  schedules:
    'Los horarios de los vecinos no entran en la cuenta de una protectora, por lo mismo: no hacen falta para ayudar a un animal.',
  check_in:
    'El check-in dice que tu animal está fuera, y esta cuenta no tiene animal dado de alta.',
  host: 'Organizar quedadas es cosa de tutores con animal dado de alta.',
};

const REASON_VERIFIED: Partial<Record<Capability, string>> = {
  live_people:
    'Ver quién está paseando ahora pide el chip verificado. Es la lista de a quién y a qué hora, y es exactamente lo que buscaría quien anda mirando qué animal llevarse. Los sitios se ven sin esto; las personas no.',
  schedules:
    'Los horarios pide el chip verificado. Un horario de paseo es la rutina diaria de alguien: a qué hora sale de casa y qué días no está.',
  message_first:
    'Escribir el primero a alguien con quien no has quedado pide el chip verificado. Responder no: quien te escribe ya decidió.',
  rescue_alerts:
    'Los avisos de rescate a varios kilómetros piden el chip verificado. Son animales heridos, perdidos o sin dueño —la lista más fácil de aprovechar que hay aquí—, así que se abre a quien ha dejado algo comprobable.',
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
  name: 'Cómo se llama',
  species: 'Qué animal es',
  age: 'Qué edad tiene',
  size: 'Cuánto ocupa',
  temperament: 'Cómo es',
  schedule: 'Cuándo salís',
};

/**
 * Lo que se le dice a quien se está registrando, tal cual.
 *
 * Sin esto la puerta parece un capricho. Con esto es una postura que alguien
 * puede repetirle a un vecino en el parque, que es como se sostienen las reglas
 * de una comunidad.
 */
export const GATE_NOTE =
  'Aquí no se entra a mirar. Para registrarte tienes que dar de alta a tu animal, porque lo que hay dentro es a quién y a qué hora se pasea por tu barrio, y eso no es un catálogo público.';

export const CHIP_NOTE =
  'El chip no localiza a nadie: es un código que se lee con un lector a pocos centímetros. Sirve para dos cosas: que te lo devuelvan si se pierde, y abrir aquí lo que enseña gente en vez de sitios.';

export const HONESTY_NOTE =
  'Esto no impide que alguien que roba animales se registre: cualquiera puede escribir un nombre. Lo que impide es mirar sin dejar nada, y que una cuenta recién hecha vea quién sale y a qué hora.';

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
      reason: 'Los enlaces acortados no se pueden revisar: no dicen a dónde llevan. Pega la dirección completa del perfil.',
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
        reason: 'Eso es una publicación, no un perfil. Hace falta la cuenta entera: es lo que se puede mirar.',
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
  'Si rescatas y no tienes animal propio, entras por aquí: enseñando el perfil público del colectivo. Es la cuenta que ya tenéis y que ya se puede mirar.';

export const SHELTER_REVIEW_NOTE =
  'La revisión la hace una persona. Aquí no se puede comprobar en automático que un perfil exista ni que sea tuyo: no hay forma de preguntárselo a esas redes, y un enlace ajeno lo pega cualquiera. Mientras tanto ves los sitios y no ves a nadie.';

export const SHELTER_SCOPE_NOTE =
  'Aprobada, la cuenta abre los avisos de rescate a kilómetros y poder escribir el primero. No abre quién pasea ahora ni los horarios de nadie: para ayudar a un animal no hace falta saber a qué hora sale cada vecino.';
