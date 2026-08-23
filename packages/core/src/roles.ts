/**
 * Qué hace este perro, y qué necesita su persona.
 *
 * Dos preguntas que casi ninguna aplicación de mascotas hace, y que cambian
 * bastante más que un icono en el perfil.
 *
 * ## El perro: no todos van al parque a jugar
 *
 * Un perro guía cruzando la ciudad **está trabajando**. Llamarlo, silbarle o
 * acariciarlo mientras trabaja no es cariño: es interrumpir a alguien que
 * depende de él para andar por la calle. Una aplicación que junta perros en
 * parques y no sabe distinguir eso acaba proponiéndole a un perro de asistencia
 * una quedada de lucha libre con cuatro desconocidos.
 *
 * Por eso la clase del perro decide tres cosas concretas:
 *
 *  1. **Si busca juego o busca paseo.** Un perro de asistencia en servicio no
 *     entra en las quedadas abiertas; lo que le encaja es un paseo tranquilo, y
 *     eso el algoritmo ya sabe puntuarlo.
 *  2. **Qué se le dice a los demás.** Una línea, y va antes que el nombre:
 *     «está trabajando, no lo llames».
 *  3. **Qué NO se publica.** Ver más abajo, porque es lo importante.
 *
 * ## Lo que no se publica jamás: para qué asiste
 *
 * Que un perro sea de asistencia se puede enseñar —es lo que evita que lo
 * distraigan y lo que sostiene su derecho de acceso a sitios públicos—. **Para
 * qué asiste, no.** «Alerta médica» es una enfermedad; «psiquiátrico» es un
 * diagnóstico; «autismo» es un diagnóstico de la persona, no del perro. Eso es
 * información médica de alguien y no tiene por qué ir al lado de la foto de un
 * perro en una aplicación de barrio.
 *
 * La distinción es exactamente esa: **el papel se enseña, el motivo no**, y está
 * escrita como una función que proyecta lo público con un test que lo comprueba,
 * no como una intención en un documento.
 *
 * ## La persona: acomodos, no etiquetas
 *
 * Se puede decir «soy autista», y no sirve para poner una insignia: sirve para
 * **preseleccionar unos acomodos**, que son lo que la aplicación hace distinto.
 * Los acomodos existen por su cuenta y cualquiera puede activarlos sin decir por
 * qué —hay gente con ansiedad, con TDAH, con hipersensibilidad al ruido, o que
 * simplemente odia los planes improvisados—.
 *
 * Que el mecanismo sean los acomodos y no el diagnóstico tiene una consecuencia
 * práctica que importa: **el diagnóstico no hace falta guardarlo para que la
 * aplicación funcione distinto**, y lo que no hace falta guardar no se filtra.
 *
 * Y nada de esto se enseña a nadie. Lo que ve la otra persona no es «Marta es
 * autista»: es que Marta propone quedar el martes a las 19:00 en un sitio
 * concreto, que es lo que hay que saber para quedar con ella.
 */

import type { PlayStyle } from './species.js';

export type DogRole = 'companion' | 'assistance' | 'therapy' | 'working' | 'sport';

export const DOG_ROLES: ReadonlyArray<{
  id: DogRole;
  label: string;
  hint: string;
}> = [
  { id: 'companion', label: 'Compañía', hint: 'La mayoría. Sale a pasear y a jugar' },
  {
    id: 'assistance',
    label: 'Perro de asistencia',
    hint: 'Trabaja para su persona: guía, alerta, apoyo. Tiene derecho de acceso',
  },
  {
    id: 'therapy',
    label: 'Perro de terapia',
    hint: 'Visita hospitales, residencias o colegios acompañado de un profesional',
  },
  {
    id: 'working',
    label: 'Perro de trabajo',
    hint: 'Búsqueda y rescate, detección, pastoreo, guarda de ganado',
  },
  { id: 'sport', label: 'Deportivo', hint: 'Agility, canicross, mantrailing, obediencia' },
];

/**
 * Para qué asiste. **Esto no sale del teléfono de su tutor.**
 *
 * Está en el catálogo porque sirve para dos cosas de puertas adentro: recordar
 * lo que le corresponde a cada tipo de trabajo y no proponerle lo que le
 * estorba. Fuera, un perro de asistencia es un perro de asistencia.
 */
export type AssistanceType =
  | 'guide'
  | 'hearing'
  | 'mobility'
  | 'medical_alert'
  | 'autism'
  | 'psychiatric';

export const ASSISTANCE_TYPES: ReadonlyArray<{
  id: AssistanceType;
  label: string;
  hint: string;
}> = [
  { id: 'guide', label: 'Guía', hint: 'Para una persona ciega o con baja visión' },
  { id: 'hearing', label: 'Señal', hint: 'Avisa de sonidos a una persona sorda' },
  { id: 'mobility', label: 'Movilidad', hint: 'Apoyo, recogida de objetos, abrir puertas' },
  { id: 'medical_alert', label: 'Alerta médica', hint: 'Avisa de crisis: diabetes, epilepsia' },
  {
    id: 'autism',
    label: 'Acompañamiento en autismo',
    hint: 'Ancla, evita fugas, ayuda a regular en sitios difíciles',
  },
  { id: 'psychiatric', label: 'Apoyo psiquiátrico', hint: 'Interrumpe crisis, da anclaje' },
];

export const WORKING_TYPES = [
  { id: 'search_rescue', label: 'Búsqueda y rescate' },
  { id: 'detection', label: 'Detección' },
  { id: 'herding', label: 'Pastoreo' },
  { id: 'livestock', label: 'Guarda de ganado' },
] as const;

/** ¿Está trabajando cuando sale a la calle? */
export function worksInPublic(role: DogRole): boolean {
  return role === 'assistance' || role === 'working';
}

/**
 * Lo que se le dice a quien se lo cruza, y por qué se dice antes que nada.
 *
 * Un perro de asistencia distraído deja de hacer su trabajo justo cuando hace
 * falta. La frase no pide permiso ni se disculpa: dice qué hacer.
 */
export function approachNote(role: DogRole): string | null {
  if (role === 'assistance') {
    return 'Está trabajando. No lo llames, no lo silbes y no lo acaricies sin preguntar a su persona: distraerlo es dejarla sin lo que necesita para moverse.';
  }
  if (role === 'working') {
    return 'Es un perro de trabajo. Fuera de servicio es un perro más, pero con el arnés puesto está en faena.';
  }
  if (role === 'therapy') {
    return 'Es un perro de terapia. Trabaja acompañado y en sitios concretos; en el parque es un perro corriente.';
  }
  return null;
}

/**
 * Qué encaja con este perro cuando sale.
 *
 * Un perro de asistencia en servicio no busca lucha libre con cuatro
 * desconocidos: le encaja un paseo tranquilo. Se **propone** en el alta en vez
 * de imponerse, porque el mismo perro fuera de servicio juega como cualquiera y
 * su tutor sabe cuál de las dos cosas está buscando aquí.
 */
export function suggestedPlayStyles(role: DogRole): readonly PlayStyle[] {
  if (role === 'assistance' || role === 'working') return ['calm_walk'];
  if (role === 'therapy') return ['calm_walk', 'toys'];
  if (role === 'sport') return ['chase', 'toys'];
  return [];
}

/** ¿Se le proponen quedadas abiertas con desconocidos? */
export function joinsOpenMeetups(role: DogRole): boolean {
  return role !== 'assistance';
}

/**
 * Lo orientativo, que aquí es obligatorio decir.
 *
 * El derecho de acceso de un perro de asistencia a sitios públicos existe en
 * casi toda América Latina y en España, y **cada país lo regula a su manera**:
 * qué acredita, quién certifica y a qué sitios llega no es lo mismo en México
 * que en Chile. Esta aplicación no certifica nada y no sustituye a ningún
 * carnet, y decirlo es parte de no hacer daño: alguien que se apoye en una
 * insignia de aquí para entrar en un sitio se lleva el disgusto en la puerta.
 */
export const ASSISTANCE_ACCESS_NOTE =
  'Un perro de asistencia tiene derecho a acompañar a su persona en sitios públicos, y cada país lo regula distinto. Esto no es un carnet ni acredita nada: es lo que ve quien se cruza con vosotros aquí.';

/* ------------------------------------------------------------------------ */
/*  La persona                                                               */
/* ------------------------------------------------------------------------ */

export type HandlerNeed = 'quiet_places' | 'plan_ahead' | 'less_motion';

export const HANDLER_NEEDS: ReadonlyArray<{
  id: HandlerNeed;
  label: string;
  /** Qué hace la aplicación distinto. Si no cambia nada, no entra en la lista. */
  effect: string;
}> = [
  {
    id: 'quiet_places',
    label: 'Prefiero sitios tranquilos',
    effect: 'Los sitios con menos gente ahora salen primero en el mapa, y se dice cuánta hay.',
  },
  {
    id: 'plan_ahead',
    label: 'Prefiero quedar con antelación',
    effect: 'Primero las quedadas con hora y sitio; el «salir ahora» deja de ser lo primero que ves.',
  },
  {
    id: 'less_motion',
    label: 'Menos movimiento en pantalla',
    effect: 'Enciende movimiento reducido: el anillo del radar deja de pulsar y nada entra animado.',
  },
];

/*
 * Faltan dos que se pensaron y **no están**: «mejor escribir que hablar» y
 * «decidme qué va a pasar, en pasos». No están porque hoy no cambiarían nada:
 * el compositor de mensajes ya es el único camino y las quedadas todavía no
 * tienen una ficha de plan que enseñar. Un acomodo que no hace nada es peor que
 * su ausencia —alguien lo enciende y cuenta con él— así que entran cuando haya
 * qué encender.
 */

/**
 * Lo que preselecciona decir «soy autista».
 *
 * Preselecciona, no impone: se quitan y se ponen uno a uno, porque no hay dos
 * personas autistas iguales y dar por hecho lo contrario es la mitad del
 * problema. Y funciona igual sin decirlo: los acomodos existen por su cuenta.
 */
export const AUTISTIC_DEFAULT_NEEDS: readonly HandlerNeed[] = ['quiet_places', 'plan_ahead'];

export type Handler = {
  /** Opcional y **privado**. No se publica, y ni siquiera hace falta para que los acomodos funcionen. */
  autistic?: boolean;
  needs: readonly HandlerNeed[];
};

export function needsOf(handler: Handler): readonly HandlerNeed[] {
  return handler.needs;
}

export function hasNeed(handler: Handler, need: HandlerNeed): boolean {
  return handler.needs.includes(need);
}

export function describeNeed(need: HandlerNeed): string {
  return HANDLER_NEEDS.find((candidate) => candidate.id === need)?.effect ?? '';
}

/* ------------------------------------------------------------------------ */
/*  Lo que ve el resto                                                       */
/* ------------------------------------------------------------------------ */

export type PetCard = {
  name: string;
  /** El papel, si su tutor decide enseñarlo. Nunca para qué asiste. */
  role: DogRole;
  /** Qué hacer al cruzárselo, cuando hay algo que decir. */
  note: string | null;
};

/**
 * Lo que sale de este teléfono sobre un perro y su persona.
 *
 * Es una función y no una intención escrita en un documento porque así se puede
 * comprobar: hay un test que le pasa una ficha con diagnóstico, tipo de
 * asistencia y acomodos, y afirma que nada de eso aparece en lo que devuelve.
 *
 * Lo que sí sale es el papel del perro cuando su tutor lo enseña, porque para
 * eso sirve: que no lo distraigan.
 */
export function publicPetCard(input: {
  name: string;
  role: DogRole;
  showRole: boolean;
  assistanceType?: AssistanceType;
  handler?: Handler;
}): PetCard {
  const role: DogRole = input.showRole ? input.role : 'companion';
  return {
    name: input.name,
    role,
    note: approachNote(role),
  };
}
