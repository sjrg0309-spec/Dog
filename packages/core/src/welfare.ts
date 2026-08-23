/**
 * El interés del animal, por encima del plan del tutor.
 *
 * Esta es la pieza que decide de quién es la aplicación. Todo lo demás
 * —afinidad, horarios, cercanía— responde a la pregunta del tutor: *con quién
 * puedo salir*. Este módulo responde a la del animal: *¿le conviene salir?*, y
 * puede contestar que no.
 *
 * Y cuando contesta que no, **manda**. Un veto de bienestar no se compensa con
 * una afinidad del 100 %, no se entierra en una advertencia gris y no se
 * convierte en un "continuar de todas formas" con letra pequeña: la aplicación
 * deja de proponer el encuentro y dice por qué. Un golpe de calor no se arregla
 * con un aviso que nadie lee.
 *
 * Tres aclaraciones para que nadie lea esto como lo que no es:
 *
 *  1. **No es criterio veterinario.** Son umbrales prudentes que la aplicación
 *     declara para tener una postura por defecto en lugar de ninguna. Están en
 *     el catálogo, a la vista, y cada uno se puede discutir.
 *  2. **El tutor puede endurecerlos, no ablandarlos.** Quien conoce a su animal
 *     puede decir "el mío no aguanta ni eso"; nadie puede decir "el mío sí
 *     aguanta un encuentro a 34 grados sobre asfalto".
 *  3. **Es una función pura.** No consulta el tiempo ni la hora: recibe las
 *     condiciones y devuelve un veredicto. Quien las obtiene es `packages/weather`,
 *     que pregunta a Open-Meteo por la celda donde está el tutor. Que la consulta
 *     viva fuera es lo que permite probar este módulo entero sin red y sin
 *     relojes, y lo que hace que un proveedor caído no cambie ningún umbral: si
 *     no hay dato, quien llama no llama, en vez de llamar con un número supuesto.
 */

import { findSpecies } from './species.js';
import type { SpeciesProfile } from './species.js';
import type { MatchablePet } from './types.js';

/**
 * Circunstancias del animal que cambian lo que puede hacer hoy.
 *
 * Van en la ficha porque son suyas, no del encuentro: un bulldog es braquicéfalo
 * en julio y en enero, y quien está convaleciente lo está para cualquier plan.
 */
export const HEALTH_FLAGS = [
  /** Hocico chato: respira peor y disipa calor mucho peor. */
  'brachycephalic',
  /** En recuperación de una lesión, cirugía o enfermedad. */
  'recovering',
  /** Pauta de vacunación sin terminar. */
  'vaccination_pending',
  /** Problemas de articulaciones: el rato largo o el juego bruto le pasan factura. */
  'joint_issues',
  /** Sensible al calor por peso, pelaje o historia previa. */
  'heat_sensitive',
  /** En celo: los encuentros con desconocidos se posponen. */
  'in_heat',
  /**
   * Sin pelo.
   *
   * Entra con las razas americanas —xoloitzcuintle, peruano sin pelo, pila
   * argentino— y no es un detalle estético: un perro sin pelo **se quema al sol
   * y pasa frío antes que cualquier otro**. El techo de calor no le cambia
   * (aguanta bien el calor, que para eso viene de donde viene); lo que le
   * cambia es el suelo, y es la primera señal de este catálogo que toca el frío
   * en vez del calor.
   */
  'hairless',
] as const;
export type HealthFlag = (typeof HEALTH_FLAGS)[number];

/** Por debajo de esto, un perro sin pelo necesita abrigo para estar fuera. */
export const HAIRLESS_FLOOR_C = 10;

export const HEALTH_FLAG_LABEL: Record<HealthFlag, string> = {
  brachycephalic: 'Hocico chato',
  recovering: 'En recuperación',
  vaccination_pending: 'Vacunación sin terminar',
  joint_issues: 'Problemas de articulaciones',
  heat_sensitive: 'Sensible al calor',
  in_heat: 'En celo',
  hairless: 'Sin pelo',
};

/** Superficie del encuentro. El asfalto quema mucho antes que la hierba. */
export const SURFACES = ['grass', 'earth', 'asphalt', 'indoor', 'unknown'] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * La temperatura, escrita como se escribe en español.
 *
 * Existe desde que el dato viene de un servicio: mientras lo ponía el tutor con
 * un control de saltos de cinco grados siempre era entero, y una interpolación
 * a pelo bastaba. Con 31.4 grados de Open-Meteo esa interpolación escribía
 * «31.4 °C» en mitad de una frase en castellano, con punto decimal. Un decimal
 * es también toda la precisión que este juicio merece: el modelo no distingue
 * la terraza de la acera de enfrente.
 */
const degrees = (value: number): string =>
  value.toLocaleString('es-ES', { maximumFractionDigits: 1 });

export type Conditions = {
  /** Temperatura del aire en el momento del encuentro. */
  temperatureC: number;
  surface: Surface;
  /** Duración de contacto propuesta, en minutos. */
  durationMinutes: number;
  /** Horas desde el último encuentro de este animal, o null si no hubo. */
  hoursSinceLastSession?: number | null;
  /**
   * Temperatura del suelo, cuando se conoce.
   *
   * Es opcional a propósito: quien no la sepa no tiene que inventársela, y
   * cuando falta se sigue juzgando el asfalto por la temperatura del aire, que
   * es lo que se hacía antes. La diferencia es que el aire acierta de media y
   * falla en los dos extremos —el mediodía despejado de abril, en el que el
   * asfalto ya quema con el aire a 24 °C, y la noche de agosto, en la que no
   * quema con el aire a 29—. Quien la calcula es `@coincide/weather`, a partir
   * de la radiación solar; aquí solo se usa.
   *
   * `undefined` significa «no se sabe» y `null` también: nunca «está fría».
   */
  groundTemperatureC?: number | null;
};

/**
 * A partir de aquí el suelo daña una almohadilla en menos de un minuto.
 *
 * Vive aquí y no en la capa meteorológica porque es un umbral de bienestar, no
 * una propiedad del tiempo: quien lo discuta lo discute con el resto del
 * catálogo. Coincide con `GROUND_BURN_C` de `@coincide/weather`, y hay un test
 * que comprueba que no se separan.
 */
export const GROUND_BURN_C = 48;

/** Temperatura del aire desde la que el asfalto se juzga peligroso a ciegas. */
export const ASPHALT_AIR_FALLBACK_C = 28;

/**
 * `stop` no es "muy grave": es que la aplicación deja de ofrecerlo.
 * `caution` sí se ofrece, con el motivo y con el límite ya aplicado.
 */
export type WelfareLevel = 'ok' | 'caution' | 'stop';

export type WelfareReason = {
  level: 'caution' | 'stop';
  /** Identificador estable, para poder contar y probar sin depender del texto. */
  code: string;
  /** Explicación en español, redactada desde el animal y no desde el plan. */
  message: string;
};

export type WelfareVerdict = {
  level: WelfareLevel;
  reasons: readonly WelfareReason[];
  /**
   * Minutos que la aplicación propone de verdad.
   *
   * Nunca es mayor que lo pedido: este número solo recorta. Si el tutor propone
   * dos horas de hurones, aquí salen veinte minutos, y es lo que se enseña.
   */
  recommendedMinutes: number;
};

/** El animal, con lo que hace falta para juzgar si le conviene salir. */
export type CareSubject = Pick<MatchablePet, 'speciesId' | 'ageMonths' | 'energyLevel'> & {
  healthFlags?: readonly HealthFlag[];
  /**
   * Techo propio, si su tutor lo ha declarado.
   *
   * Solo puede bajar del de la especie. Un campo que pudiera subirlo sería una
   * forma elegante de que la regla no existiera.
   */
  ownMaxSessionMinutes?: number | null;
  /** Techo térmico propio, también solo hacia abajo. */
  ownMaxTempC?: number | null;
};

/**
 * Cuánto calor tolera este animal concreto.
 *
 * Parte del techo de su especie y lo baja por lo que sabemos de él. Los
 * descuentos se acumulan: un bulldog sénior y con sobrepeso no está en la misma
 * situación que un bulldog joven, y sumar es la forma prudente de equivocarse.
 */
export function heatCeilingC(subject: CareSubject, species: SpeciesProfile): number {
  const flags = subject.healthFlags ?? [];
  let ceiling = species.care.comfortTempC.max;

  // Un braquicéfalo jadea peor, y jadear es como un perro se refrigera.
  if (flags.includes('brachycephalic')) ceiling -= 4;
  if (flags.includes('heat_sensitive')) ceiling -= 2;
  if (subject.ageMonths < species.juvenileUntilMonths) ceiling -= 1;
  if (subject.ageMonths >= species.care.seniorFromMonths) ceiling -= 2;

  if (subject.ownMaxTempC !== null && subject.ownMaxTempC !== undefined) {
    ceiling = Math.min(ceiling, subject.ownMaxTempC);
  }
  return ceiling;
}

/** Cuántos minutos de contacto seguido admite este animal concreto. */
export function sessionCeilingMinutes(subject: CareSubject, species: SpeciesProfile): number {
  let ceiling = species.care.maxSessionMinutes;

  const flags = subject.healthFlags ?? [];
  if (subject.ageMonths < species.juvenileUntilMonths) ceiling = Math.round(ceiling * 0.5);
  if (subject.ageMonths >= species.care.seniorFromMonths) ceiling = Math.round(ceiling * 0.6);
  if (flags.includes('joint_issues')) ceiling = Math.round(ceiling * 0.6);

  if (subject.ownMaxSessionMinutes !== null && subject.ownMaxSessionMinutes !== undefined) {
    ceiling = Math.min(ceiling, subject.ownMaxSessionMinutes);
  }
  return Math.max(0, ceiling);
}

/**
 * ¿Le conviene a este animal el encuentro que se le propone?
 *
 * El orden importa: primero lo que impide salir de casa, luego lo que impide
 * este encuentro concreto, y solo al final los ajustes de duración. Así el
 * primer motivo que lee el tutor es siempre el más importante.
 */
export function assessWelfare(subject: CareSubject, conditions: Conditions): WelfareVerdict {
  const species = findSpecies(subject.speciesId);
  const reasons: WelfareReason[] = [];

  if (!species) {
    return {
      level: 'stop',
      reasons: [
        {
          level: 'stop',
          code: 'unknown_species',
          message:
            'No sabemos qué necesita esta especie, así que no proponemos nada. Es preferible no ' +
            'servir de nada que dar por bueno un encuentro del que no sabemos nada.',
        },
      ],
      recommendedMinutes: 0,
    };
  }

  const flags = subject.healthFlags ?? [];
  const name = species.commonName.toLowerCase();

  // --- Lo que impide cualquier encuentro ----------------------------------
  if (flags.includes('recovering')) {
    reasons.push({
      level: 'stop',
      code: 'recovering',
      message:
        'Está en recuperación. Hasta que no le den el alta, un encuentro es un riesgo sin ' +
        'ninguna contrapartida para él.',
    });
  }

  if (flags.includes('vaccination_pending')) {
    reasons.push({
      level: species.socialModel === 'pack' ? 'stop' : 'caution',
      code: 'vaccination_pending',
      message:
        species.socialModel === 'pack'
          ? 'Le falta pauta de vacunación. Un parque abierto con desconocidos es justo donde no ' +
            'debería estar todavía.'
          : 'Le falta pauta de vacunación: conviene esperar, y si no, que sea con un animal ' +
            'conocido y con la suya al día.',
    });
  }

  if (flags.includes('in_heat')) {
    reasons.push({
      level: 'caution',
      code: 'in_heat',
      message:
        'Está en celo. Un encuentro con desconocidos ahora es más tenso para él y para los ' +
        'demás, aunque todos se lleven bien el resto del año.',
    });
  }

  // --- Condiciones del momento --------------------------------------------
  const ceiling = heatCeilingC(subject, species);
  /* El suelo de un perro sin pelo no es «un poco más alto»: es otro.
     El de la especie está puesto para un perro con pelaje —menos cinco grados
     es un día de invierno para un husky—, y a esa temperatura un xoloitzcuintle
     sin abrigo lleva un rato tiritando. Diez grados es el número que se repite
     en las guías de estas razas para sacar el abrigo, y es el que se usa. */
  const floor = flags.includes('hairless')
    ? Math.max(species.care.comfortTempC.min, HAIRLESS_FLOOR_C)
    : species.care.comfortTempC.min;
  const outdoors = conditions.surface !== 'indoor';

  if (outdoors && conditions.temperatureC > ceiling) {
    // Cuánto se le permite pasarse del techo antes de dejar de proponerlo.
    //
    // Para un animal corriente, unos grados de más son incomodidad: sombra,
    // agua y menos rato. Para uno que ya tenía el techo rebajado por cómo
    // respira o por su historia, pasarse no es estar incómodo: es el camino al
    // golpe de calor. Ahí el margen es cero, y esa asimetría es deliberada.
    const fragile =
      flags.includes('brachycephalic') || flags.includes('heat_sensitive');
    const severe = conditions.temperatureC > ceiling + (fragile ? 0 : 3);
    const because = describeHeatCeiling(subject, species, ceiling);
    reasons.push({
      level: severe ? 'stop' : 'caution',
      code: severe ? 'too_hot' : 'warm',
      message: severe
        ? `${degrees(conditions.temperatureC)} °C es demasiado para este ${name}${because}. No es cuestión ` +
          'de ir más despacio: a esa temperatura el problema es estar fuera.'
        : `${degrees(conditions.temperatureC)} °C ya aprieta para este ${name}${because}. Sombra, agua y ` +
          'menos rato, o mejor a otra hora.',
    });
  }

  if (outdoors && conditions.temperatureC < floor) {
    reasons.push({
      level: conditions.temperatureC < floor - 5 ? 'stop' : 'caution',
      code: 'too_cold',
      message: flags.includes('hairless')
        ? `${degrees(conditions.temperatureC)} °C es poco para un perro sin pelo: sin abrigo, a esta ` +
          'temperatura se enfría antes de terminar el paseo.'
        : `${degrees(conditions.temperatureC)} °C está por debajo de lo que esta especie lleva bien a la ` +
          'intemperie. Dentro, sí.',
    });
  }

  /* Y el sol, que en un perro sin pelo no es incomodidad sino quemadura. Va
     aparte del calor a propósito: un día de veinte grados con sol de mediodía
     no dispara ningún techo y le quema igual. */
  if (outdoors && flags.includes('hairless') && conditions.temperatureC >= 18) {
    reasons.push({
      level: 'caution',
      code: 'hairless_sun',
      message:
        'Sin pelo, la piel se quema como la de una persona. Sombra a mediodía, y si le da el sol, ' +
        'protector apto para perros.',
    });
  }

  // El suelo, que es lo que se pisa.
  //
  // Cuando se conoce su temperatura se juzga esa. Cuando no, se cae al umbral
  // del aire de siempre: es peor criterio, pero no saber la temperatura del
  // suelo no es motivo para dejar de mirar el asfalto.
  const ground = conditions.groundTemperatureC;
  const groundKnown = ground !== null && ground !== undefined;

  if (groundKnown && outdoors && ground >= GROUND_BURN_C) {
    reasons.push({
      level: 'stop',
      code: 'hot_ground',
      message:
        `El suelo está a unos ${Math.round(ground)} °C y le quema las almohadillas: va descalzo. ` +
        'Hierba, sombra, o a otra hora.',
    });
  } else if (
    !groundKnown &&
    conditions.surface === 'asphalt' &&
    conditions.temperatureC >= ASPHALT_AIR_FALLBACK_C
  ) {
    reasons.push({
      level: 'stop',
      code: 'hot_ground',
      message:
        'Asfalto con este calor: el suelo está mucho más caliente que el aire y le quema las ' +
        'almohadillas. Hierba, tierra o sombra, o a otra hora.',
    });
  }

  // --- Descanso entre encuentros ------------------------------------------
  const since = conditions.hoursSinceLastSession;
  if (since !== null && since !== undefined && since < species.care.restBetweenSessionsHours) {
    reasons.push({
      level: since < species.care.restBetweenSessionsHours / 2 ? 'stop' : 'caution',
      code: 'needs_rest',
      message:
        `Ya tuvo un encuentro hace ${formatHours(since)}. Esta especie necesita alrededor de ` +
        `${species.care.restBetweenSessionsHours} h de descanso: encadenarlos cansa aunque cada ` +
        'uno por separado saliera bien.',
    });
  }

  // --- Duración ------------------------------------------------------------
  const maxMinutes = sessionCeilingMinutes(subject, species);
  const recommended = Math.min(conditions.durationMinutes, maxMinutes);

  if (conditions.durationMinutes > maxMinutes && maxMinutes > 0) {
    reasons.push({
      level: 'caution',
      code: 'too_long',
      message:
        `${conditions.durationMinutes} min es demasiado seguido para este ${name}: se propone ` +
        `${maxMinutes} min y luego descanso. Un rato largo es buen plan para una persona y una ` +
        'jornada agotadora para él.',
    });
  }

  const level: WelfareLevel = reasons.some((reason) => reason.level === 'stop')
    ? 'stop'
    : reasons.length > 0
      ? 'caution'
      : 'ok';

  return {
    level,
    // Los motivos de parada van primero: es lo que hay que leer.
    reasons: [...reasons].sort((a, b) => Number(b.level === 'stop') - Number(a.level === 'stop')),
    recommendedMinutes: level === 'stop' ? 0 : recommended,
  };
}

/** Por qué el techo de este animal no es el de su especie. */
function describeHeatCeiling(
  subject: CareSubject,
  species: SpeciesProfile,
  ceiling: number,
): string {
  if (ceiling >= species.care.comfortTempC.max) return '';
  const flags = subject.healthFlags ?? [];
  const parts: string[] = [];
  if (flags.includes('brachycephalic')) parts.push('de hocico chato');
  if (flags.includes('heat_sensitive')) parts.push('sensible al calor');
  if (subject.ageMonths >= species.care.seniorFromMonths) parts.push('sénior');
  else if (subject.ageMonths < species.juvenileUntilMonths) parts.push('joven');
  return parts.length > 0 ? `, que es ${parts.join(' y ')},` : '';
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const rounded = Math.round(hours);
  return rounded === 1 ? '1 h' : `${rounded} h`;
}

/**
 * El veredicto de un grupo es el del animal que peor lo lleve.
 *
 * Igual que la afinidad grupal se mide por el peor par: si a uno de los seis le
 * está prohibiendo el calor, el encuentro no se hace porque a los otros cinco
 * les venga bien.
 */
export function groupWelfare(
  subjects: readonly CareSubject[],
  conditions: Conditions,
): WelfareVerdict {
  const verdicts = subjects.map((subject) => assessWelfare(subject, conditions));
  if (verdicts.length === 0) {
    return { level: 'ok', reasons: [], recommendedMinutes: conditions.durationMinutes };
  }

  const level: WelfareLevel = verdicts.some((verdict) => verdict.level === 'stop')
    ? 'stop'
    : verdicts.some((verdict) => verdict.level === 'caution')
      ? 'caution'
      : 'ok';

  // Los motivos se deduplican por código: seis perros con el mismo calor son un
  // problema, no seis.
  const seen = new Set<string>();
  const reasons: WelfareReason[] = [];
  for (const verdict of verdicts) {
    for (const reason of verdict.reasons) {
      if (seen.has(reason.code)) continue;
      seen.add(reason.code);
      reasons.push(reason);
    }
  }

  return {
    level,
    reasons: reasons.sort((a, b) => Number(b.level === 'stop') - Number(a.level === 'stop')),
    recommendedMinutes:
      level === 'stop' ? 0 : Math.min(...verdicts.map((verdict) => verdict.recommendedMinutes)),
  };
}

export const WELFARE_DISCLAIMER =
  'Coincide no da consejo veterinario. Estos límites son umbrales prudentes de la propia ' +
  'aplicación, pensados para no proponer de más; ante una duda sobre tu animal, el criterio es ' +
  'el de su veterinario.';
