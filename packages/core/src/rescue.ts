/**
 * Rescate: animales que necesitan ayuda, y zonas donde alguien está envenenando.
 *
 * El resto de la aplicación protege **al perro de su tutor**. Esto es otra cosa:
 * el animal que no tiene a nadie, y la persona que sale a buscarlo. En
 * Latinoamérica esa persona suele ser una rescatista sin estructura detrás —sin
 * refugio, sin presupuesto, coordinándose por WhatsApp— y lo que le falta no es
 * voluntad: es saber a tiempo dónde está pasando algo.
 *
 * ## Dos cosas que este módulo hace, y una que se niega a hacer
 *
 * **Hace: agrupar avisos repetidos en una zona marcada.** Un cebo envenenado no
 * es un suceso, es una **campaña**: quien envenena un parque vuelve, y vuelve al
 * mismo sitio durante semanas. Una alerta que caduca en horas cuenta un caso y
 * pierde el patrón. `hazardZones` mira treinta días hacia atrás y dice «en este
 * parque ha habido cuatro avisos de cebos este mes», que es la frase que hace
 * que alguien no lleve ahí a su perro y que una rescatista sepa dónde ir a
 * mirar.
 *
 * **Hace: separar a quien avisa de quien recibe.** Una rescatista quiere
 * enterarse de un animal herido a cinco kilómetros porque va a ir; un tutor
 * solo necesita saber lo que pasa en su parque. Son radios distintos para el
 * mismo hecho.
 *
 * **No hace: acusar a nadie.** Y esto no es timidez, es la decisión de diseño
 * más importante del módulo. Una aplicación que deja publicar «Fulano de la
 * calle tal envenena perros» es un arma, y en la región de la que hablamos las
 * acusaciones de maltrato animal han terminado en linchamientos de personas que
 * después resultaron no tener nada que ver. Así que la garantía no se confía a
 * moderar textos —que falla— sino a la **forma del dato**: un aviso no tiene
 * campo para un nombre, ni para una matrícula, ni para una foto de una persona,
 * ni texto libre. Es un escenario, un sitio y cuántos animales. No hay dónde
 * escribir una acusación, así que no se puede. Un test comprueba que sigue sin
 * haberlo.
 *
 * Lo que sí hay es a dónde llevarlo: reunir la prueba y presentarla donde tiene
 * efecto legal, que es una denuncia y no un post.
 */

import type { AlertSeverity } from './safety.js';

/**
 * Situaciones en las que el que necesita ayuda es el animal, no su tutor.
 *
 * Cada una lleva sus pasos, y los pasos son lo único que sirve cuando alguien
 * está delante de un perro moribundo y no sabe qué hacer primero.
 */
export type RescueScenario = {
  id: string;
  label: string;
  description: string;
  severity: AlertSeverity;
  /** A cuánto se avisa a una rescatista. Más que a un tutor: va a desplazarse. */
  rescuerRadiusM: number;
  /** A cuánto se avisa a un tutor corriente, si es que se le avisa. */
  tutorRadiusM: number;
  steps: readonly string[];
};

export const RESCUE_SCENARIOS: readonly RescueScenario[] = [
  {
    id: 'poisoning_seen',
    label: 'Un animal envenenado',
    description:
      'Temblores, babeo espeso, convulsiones o rigidez. El veneno actúa en minutos y no siempre da síntomas al momento de comerlo.',
    severity: 'critical',
    rescuerRadiusM: 5000,
    tutorRadiusM: 1000,
    steps: [
      'Al veterinario ya. No esperes a que empeore: en un envenenamiento el margen se cuenta en minutos.',
      'No le hagas vomitar por tu cuenta. Con un cáustico o con el animal ya convulsionando, provocar el vómito hace más daño que el veneno.',
      'Si puedes hacerlo sin riesgo, llévate una muestra o una foto de lo que comió. El tratamiento cambia según qué sea, y el veterinario va a ciegas sin eso.',
      'Manéjalo con guantes o con una tela: si es un tóxico de contacto, te afecta a ti también.',
      'Avísalo aquí para que el resto del barrio no pase por ahí.',
    ],
  },
  {
    id: 'injured_animal',
    label: 'Un animal herido en la calle',
    description: 'Atropello, herida abierta o no se puede levantar.',
    severity: 'critical',
    rescuerRadiusM: 5000,
    tutorRadiusM: 800,
    steps: [
      'Un animal con dolor muerde aunque sea manso. Una manta por encima antes de tocarlo.',
      'No le des agua ni comida: si hay que operar, el estómago lleno lo complica.',
      'Muévelo en plano, con una tabla o una manta tensa, sin doblarle la espalda.',
      'Al veterinario más cercano. Avisa por el camino de que vas.',
    ],
  },
  {
    id: 'abandoned_litter',
    label: 'Una camada abandonada',
    description: 'Cachorros solos, en una caja o en un descampado.',
    severity: 'critical',
    rescuerRadiusM: 8000,
    tutorRadiusM: 500,
    steps: [
      'Lo primero es el calor, antes que la comida: un cachorro pequeño se muere de frío antes que de hambre.',
      'No les des leche de vaca. No la digieren y les provoca una diarrea que los deshidrata.',
      'Mira alrededor antes de llevártelos: si la madre anda cerca, moverlos es peor.',
      'Avisa aquí; hacen falta manos, no solo un sitio.',
    ],
  },
  {
    id: 'neglect_situation',
    label: 'Un animal en malas condiciones',
    description:
      'Atado sin agua ni sombra, sin poder moverse, o visiblemente desnutrido. Situación que se repite, no un mal día.',
    severity: 'warning',
    rescuerRadiusM: 3000,
    tutorRadiusM: 0,
    steps: [
      'Anota el día, la hora y el sitio, y hazlo cada vez que lo veas. Una denuncia se sostiene sobre la repetición, no sobre una foto suelta.',
      'Fotografía al animal y al lugar. A personas no: no aporta a la denuncia y te expone a ti.',
      'Llévalo a donde tiene efecto: la autoridad que corresponda en tu país. Un post no abre un expediente.',
      'No entres a una propiedad ajena ni te lleves al animal por tu cuenta. Además del riesgo, invalida la denuncia.',
    ],
  },
];

export function findRescueScenario(id: string): RescueScenario | null {
  return RESCUE_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

/**
 * Un aviso, tal cual se guarda.
 *
 * **Fíjate en lo que no tiene**: ni nombre, ni apodo, ni matrícula, ni texto
 * libre, ni foto de nadie. No es una omisión pendiente de completar — es la
 * garantía. Mientras no exista el campo, no existe la acusación, y eso no
 * depende de que alguien modere a tiempo.
 */
export type RescueReport = {
  id: string;
  scenarioId: string;
  /** Dónde. Un sitio del catálogo, no unas coordenadas de nadie. */
  placeId: string;
  /** Quién avisó. **No se publica**: sirve para contar personas distintas. */
  reporterId: string;
  reportedAt: string;
  /** Cuántos animales, cuando se sabe. */
  animalCount?: number;
};

/** Días hacia atrás que se miran para decidir si un sitio está marcado. */
export const ZONE_WINDOW_DAYS = 30;

/**
 * Personas distintas que hacen falta para marcar un sitio.
 *
 * **Personas, no avisos**, y esa palabra es toda la regla. Contando avisos,
 * una sola persona marca el parque que quiera repitiendo el formulario cinco
 * veces, y eso convierte una herramienta de protección en una forma de
 * ahuyentar gente de un sitio. Contando personas, hace falta que a tres
 * vecinos que no se conocen les pase lo mismo.
 *
 * Tres y no dos: con dos, basta con una persona y una cuenta de más.
 */
export const ZONE_MIN_REPORTERS = 3;

export type HazardZone = {
  placeId: string;
  scenarioId: string;
  /** Avisos dentro de la ventana. */
  reports: number;
  /** Personas distintas que avisaron. Es lo que sostiene la zona. */
  reporters: number;
  /** El más reciente, en ISO. */
  lastAt: string;
  severity: AlertSeverity;
};

/**
 * Los sitios marcados: dónde se repite algo, no dónde pasó una vez.
 *
 * Es la respuesta a que envenenar un parque es una campaña y no un suceso.
 * Quien lo hace vuelve, y una alerta que caduca en horas cuenta cada visita por
 * separado y pierde justo lo que había que ver.
 *
 * La zona **caduca sola** al salirse de la ventana: un cebo en marzo no hace
 * peligroso el parque en septiembre, y una marca que no se borra acaba siendo
 * un mapa de barrios señalados que ya no dice nada.
 */
export function hazardZones(
  reports: readonly RescueReport[],
  options: { now?: Date; windowDays?: number; minReporters?: number } = {},
): HazardZone[] {
  const now = options.now ?? new Date();
  const windowDays = options.windowDays ?? ZONE_WINDOW_DAYS;
  const minReporters = options.minReporters ?? ZONE_MIN_REPORTERS;
  const cutoff = now.getTime() - windowDays * 86_400_000;

  const groups = new Map<
    string,
    { placeId: string; scenarioId: string; reports: number; people: Set<string>; lastAt: string }
  >();

  for (const report of reports) {
    const at = Date.parse(report.reportedAt);
    if (!Number.isFinite(at) || at < cutoff || at > now.getTime()) continue;

    const key = `${report.placeId}|${report.scenarioId}`;
    const group = groups.get(key) ?? {
      placeId: report.placeId,
      scenarioId: report.scenarioId,
      reports: 0,
      people: new Set<string>(),
      lastAt: report.reportedAt,
    };

    group.reports += 1;
    group.people.add(report.reporterId);
    if (at > Date.parse(group.lastAt)) group.lastAt = report.reportedAt;
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.people.size >= minReporters)
    .map((group) => ({
      placeId: group.placeId,
      scenarioId: group.scenarioId,
      reports: group.reports,
      reporters: group.people.size,
      lastAt: group.lastAt,
      severity: findRescueScenario(group.scenarioId)?.severity ?? 'warning',
    }))
    .sort((a, b) => b.reporters - a.reporters || Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

/**
 * Cómo se dice una zona marcada, en la frase que hace que alguien cambie de ruta.
 *
 * Números y no adjetivos: «cuatro avisos de siete personas este mes» se puede
 * comprobar y se puede discutir. «Zona peligrosa» es una etiqueta que nadie
 * puede rebatir y que se queda pegada a un barrio.
 */
export function describeZone(zone: HazardZone): string {
  const what = findRescueScenario(zone.scenarioId)?.label.toLowerCase() ?? 'avisos';
  const reports = zone.reports === 1 ? '1 aviso' : `${zone.reports} avisos`;
  const people = zone.reporters === 1 ? '1 persona' : `${zone.reporters} personas`;
  return `${reports} de ${what} este mes, de ${people} distintas`;
}

/**
 * A cuánto llega un aviso, según a quién.
 *
 * Una rescatista y un tutor reciben el mismo hecho a distancias distintas
 * porque van a hacer cosas distintas con él: una se desplaza, el otro decide
 * por dónde pasear. Mandarle a un tutor todo lo que le llega a una rescatista
 * es la forma más rápida de que silencie los avisos, y entonces tampoco recibe
 * el que sí le tocaba.
 */
export function alertReachM(scenario: RescueScenario, role: 'rescuer' | 'tutor'): number {
  return role === 'rescuer' ? scenario.rescuerRadiusM : scenario.tutorRadiusM;
}

/**
 * Qué se necesita para que una denuncia se sostenga.
 *
 * Esto es lo que de verdad falta y lo que ninguna aplicación da: no cómo
 * indignarse, sino qué reunir. Va aquí y no en un texto de una pantalla porque
 * viaja con el escenario: quien lo lea la primera vez lo verá donde tiene que
 * decidir.
 */
export const EVIDENCE_CHECKLIST: readonly string[] = [
  'Fecha, hora y sitio exacto, cada vez que lo veas. La repetición es lo que convierte una foto en un caso.',
  'Fotos del animal y del lugar. De personas no: no aporta a la denuncia y te expone.',
  'Si hubo veterinario, el informe. Es la única prueba que nadie discute.',
  'Nombres de quien más lo haya visto, con su permiso, por si hace falta que lo confirmen.',
];

/**
 * Lo que la aplicación **no** sabe y no va a inventarse.
 *
 * A dónde se lleva una denuncia cambia por país y a veces por municipio:
 * policía ambiental, fiscalía, la unidad del ayuntamiento, el colegio de
 * veterinarios. Poner aquí un número de teléfono sacado de memoria sería lo
 * peor que puede hacer este módulo — alguien con un animal envenenado delante
 * llamando a un número que no existe—. Así que se dice qué buscar y se deja
 * el hueco marcado como hueco.
 */
export const REPORTING_CHANNELS_NOTE =
  'A dónde se denuncia cambia según el país y a veces según el municipio. Petnav todavía no ' +
  'trae los contactos verificados de cada sitio, y prefiere decirlo a darte un número que no ' +
  'conteste: búscalo como «denuncia por maltrato animal» más el nombre de tu municipio, o ' +
  'pregúntalo en tu veterinario, que suele saberlo.';

export const RESCUE_DISCLAIMER =
  'Estos pasos son de primera reacción, no un tratamiento. En un envenenamiento el veterinario ' +
  'va antes que la aplicación, y llegar diez minutos antes cambia el resultado.';
