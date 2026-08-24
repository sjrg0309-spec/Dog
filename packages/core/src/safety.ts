/**
 * Los escenarios de seguridad, catalogados.
 *
 * El radar social solo se enciende en zonas pet-friendly. Este fichero existe
 * porque esa regla, siendo correcta, deja fuera exactamente los momentos en que
 * hace falta ayuda: **una emergencia no ocurre en una zona pet-friendly**. Un
 * perro se suelta en una obra, huye de los petardos y cruza tres calles, se
 * queda solo porque su tutor se ha desmayado. Los sitios donde el radar social
 * está apagado son justo donde importa.
 *
 * La respuesta no es relajar la regla del radar social —eso lo convertiría otra
 * vez en una baliza personal— sino tener **dos objetos con reglas distintas**:
 *
 *                    Radar social             Alerta de seguridad
 *   Dónde            Solo zonas pet-friendly   En cualquier sitio
 *   Quién la ve      Compatibles a 2 km        Todos los tutores del radio
 *   Caducidad        Máximo 4 h                Hasta que se resuelve
 *   Precisión        Anclada al lugar          Punto exacto
 *
 * La privacidad cede en una emergencia y solo ahí. Es deliberado: publicar el
 * punto exacto de un animal perdido es lo único que hace que alguien lo
 * encuentre, y quien lo activa lo hace sobre su propio animal.
 *
 * Lo que este catálogo aporta y una lista de tipos no: **cada escenario trae su
 * radio y su urgencia**, y no son iguales. Un cebo envenenado no se mueve, así
 * que un radio pequeño basta y no debe crecer; un perro asustado por petardos
 * puede recorrer kilómetros en una hora, y un radio fijo lo deja fuera del aviso
 * justo cuando más lejos está.
 */

export const ALERT_KINDS = ['lost_pet', 'found_pet', 'hazard', 'outbreak'] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export type SafetyScenario = {
  id: string;
  kind: AlertKind;
  /** Cómo lo diría el tutor, no cómo lo llamaría un ingeniero. */
  label: string;
  /** Qué está pasando de verdad, para la ficha de la alerta. */
  description: string;
  severity: AlertSeverity;
  /** Radio inicial del aviso, en metros. */
  initialRadiusM: number;
  /**
   * Cuánto crece el radio por hora sin resolver.
   *
   * Cero para lo que no se mueve. Un cebo envenenado sigue donde estaba; un
   * perro asustado, no.
   */
  growthPerHourM: number;
  /**
   * Tope, para que una alerta vieja no acabe avisando a media ciudad.
   *
   * En un escenario que no crece es igual al inicial, y no mayor. Un tope que
   * no se puede alcanzar es un número que miente: se lee como «esto puede
   * llegar a un kilómetro» cuando el aviso se queda en quinientos metros para
   * siempre. Hay un test que lo comprueba.
   */
  maxRadiusM: number;
  /** Qué hacer, en orden. Es lo único accionable cuando alguien está nervioso. */
  steps: readonly string[];
};

/**
 * El catálogo.
 *
 * Está ordenado por lo que de verdad ocurre y con qué frecuencia, no por
 * gravedad teórica: la noche de San Juan y la de fin de año son el pico anual de
 * perros perdidos en España, y una aplicación que no lo contemple falla el día
 * que más falta hace.
 */
export const SAFETY_SCENARIOS: readonly SafetyScenario[] = [
  // --- Pérdida ------------------------------------------------------------
  {
    id: 'escape_walk',
    kind: 'lost_pet',
    label: 'Se ha soltado durante el paseo',
    description:
      'Se soltó de la correa o del arnés y salió corriendo. Suele estar cerca y asustado, y suele volver al mismo sitio.',
    severity: 'critical',
    initialRadiusM: 1000,
    growthPerHourM: 800,
    maxRadiusM: 6000,
    steps: [
      'Quédate donde se soltó: es donde volverá a buscarte.',
      'No corras detrás. Un perro asustado interpreta la persecución como huida y se aleja más.',
      'Agáchate y llámalo con voz normal, no con voz de regañina.',
      'Avisa aquí: quien esté cerca lo verá, y también quien pase por aquí a su hora.',
    ],
  },
  {
    id: 'escape_home',
    kind: 'lost_pet',
    label: 'Se ha escapado de casa',
    description:
      'Puerta abierta, obra, mudanza o repartidor. Va sin correa y sin nadie, y probablemente por la calle.',
    severity: 'critical',
    initialRadiusM: 1500,
    growthPerHourM: 1000,
    maxRadiusM: 8000,
    steps: [
      'Deja la puerta abierta y algo suyo fuera: muchos vuelven solos en la primera hora.',
      'Recorre su ruta de paseo habitual antes que el barrio entero.',
      'Avisa aquí con el número del chip a mano.',
    ],
  },
  {
    id: 'fireworks',
    kind: 'lost_pet',
    label: 'Ha huido por petardos o tormenta',
    description:
      'El pico anual de animales perdidos. Un perro en pánico corre en línea recta y puede recorrer kilómetros sin parar; no reconoce su nombre ni su calle.',
    severity: 'critical',
    // Es el caso que necesita el radio más grande y el crecimiento más rápido:
    // en pánico no se queda cerca, y buscar donde se perdió no sirve.
    initialRadiusM: 3000,
    growthPerHourM: 2500,
    maxRadiusM: 20000,
    steps: [
      'No busques solo donde se perdió: en pánico corren lejos y en línea recta.',
      'Avisa a las clínicas y a la protectora de la zona, además de aquí.',
      'Deja a alguien en casa: muchos vuelven de madrugada cuando cesa el ruido.',
    ],
  },
  {
    id: 'escape_spot',
    kind: 'lost_pet',
    label: 'Ha saltado la valla de un espacio',
    description:
      'En un espacio alquilado o en una finca. Suele saber menos dónde está que en su propio barrio.',
    severity: 'critical',
    initialRadiusM: 1500,
    growthPerHourM: 1200,
    maxRadiusM: 10000,
    steps: [
      'Avisa a quien alquila el espacio: conoce el terreno y las salidas.',
      'Mira primero al otro lado de la valla por donde saltó.',
      'Avisa aquí: es zona que no conoce, así que no volverá solo.',
    ],
  },
  {
    id: 'with_sitter',
    kind: 'lost_pet',
    label: 'Se ha perdido con el cuidador',
    description:
      'Estaba con un paseador, una guardería o un familiar. El animal está en una zona que puede no ser la suya.',
    severity: 'critical',
    initialRadiusM: 2000,
    growthPerHourM: 1000,
    maxRadiusM: 10000,
    steps: [
      'Pide la última ubicación exacta a quien lo llevaba.',
      'Avisa desde allí, no desde tu casa.',
    ],
  },
  {
    id: 'found',
    kind: 'found_pet',
    label: 'He encontrado un perro sin dueño',
    description:
      'El otro lado del problema. Se publica sin cuenta a propósito: quien lo encuentra no tiene la aplicación instalada.',
    severity: 'warning',
    initialRadiusM: 3000,
    growthPerHourM: 0,
    maxRadiusM: 3000,
    steps: [
      'Si lleva chapa, llama al número. Es lo más rápido con diferencia.',
      'Cualquier veterinario o la policía local pueden leerle el chip gratis.',
      'Publícalo aquí con dónde lo encontraste: alguien lo está buscando ahora mismo.',
    ],
  },

  // --- Peligro en una zona -------------------------------------------------
  {
    id: 'poison_bait',
    kind: 'hazard',
    label: 'Cebos envenenados',
    description:
      'Aparecen por rachas y en sitios concretos. Matan en horas y el envenenamiento no siempre da síntomas al momento.',
    severity: 'critical',
    // No se mueve: un radio pequeño y que no crezca. Ampliarlo solo diluiría el
    // aviso hasta que nadie lo mirase.
    initialRadiusM: 500,
    growthPerHourM: 0,
    maxRadiusM: 500,
    steps: [
      'Con correa corta al pasar por la zona y bozal si come del suelo.',
      'Si ha comido algo: al veterinario ya, sin esperar síntomas.',
      'Avísalo aquí y en el ayuntamiento. Es delito.',
    ],
  },
  {
    id: 'processionary',
    kind: 'hazard',
    label: 'Procesionaria del pino',
    description:
      'De febrero a abril, bajo los pinos. El contacto con la lengua puede costar un trozo de ella; no hace falta que la coma.',
    severity: 'critical',
    initialRadiusM: 400,
    growthPerHourM: 0,
    maxRadiusM: 400,
    steps: [
      'No pases bajo pinos con orugas en fila ni con bolsones en las ramas.',
      'Si la ha tocado: lavar la boca con agua abundante y al veterinario inmediatamente.',
      'Avisa de qué pinar es exactamente.',
    ],
  },
  {
    id: 'hot_asphalt',
    kind: 'hazard',
    label: 'Asfalto que quema',
    description:
      'El suelo está mucho más caliente que el aire. Quema almohadillas en segundos, y quien lo pisa descalzo es él.',
    severity: 'warning',
    initialRadiusM: 1000,
    growthPerHourM: 0,
    maxRadiusM: 1000,
    steps: [
      'Pon el dorso de la mano en el suelo cinco segundos: si no aguantas, él tampoco.',
      'Hierba, tierra o sombra, o a otra hora.',
    ],
  },
  {
    id: 'loose_aggressive',
    kind: 'hazard',
    label: 'Perro agresivo suelto',
    description:
      'Sin correa y sin tutor a la vista, o con tutor que no lo controla. No es para señalar a nadie: es para poder cambiar de acera.',
    severity: 'warning',
    initialRadiusM: 800,
    growthPerHourM: 400,
    maxRadiusM: 3000,
    steps: [
      'Cambia de ruta mientras esté la alerta.',
      'No describas al tutor: describe dónde y cuándo.',
    ],
  },
  {
    id: 'debris',
    kind: 'hazard',
    label: 'Cristales, obra o vertido',
    description: 'Cortes en almohadillas y productos que se lamen de las patas.',
    severity: 'info',
    initialRadiusM: 300,
    growthPerHourM: 0,
    maxRadiusM: 300,
    steps: ['Evita la zona.', 'Si ha pisado algo, revisa entre los dedos antes de que se lama.'],
  },

  // --- Salud ---------------------------------------------------------------
  {
    id: 'outbreak',
    kind: 'outbreak',
    label: 'Brote contagioso en la zona',
    description:
      'Tos de las perreras, parvovirus, giardia. Se contagia justo donde se juntan varios, que es donde esta aplicación manda a la gente.',
    severity: 'critical',
    initialRadiusM: 1500,
    growthPerHourM: 0,
    maxRadiusM: 1500,
    steps: [
      'Si el tuyo no tiene la pauta terminada, no lo lleves a esa zona.',
      'Un animal con síntomas no va al parque, aunque parezca leve.',
      'Avisa sin nombrar a nadie: importa el sitio, no de quién es el perro.',
    ],
  },
];

const BY_ID = new Map(SAFETY_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function findScenario(id: string): SafetyScenario | null {
  return BY_ID.get(id) ?? null;
}

export function scenariosOfKind(kind: AlertKind): SafetyScenario[] {
  return SAFETY_SCENARIOS.filter((scenario) => scenario.kind === kind);
}

/**
 * El radio de aviso de una alerta según lo que lleva abierta.
 *
 * Crece solo para lo que se mueve. Un cebo envenenado sigue donde estaba, y
 * ampliar su radio cada hora solo diluiría el aviso hasta que nadie lo mirase;
 * un perro asustado, en cambio, está más lejos cada hora que pasa, y un radio
 * fijo lo dejaría fuera justo cuando más falta hace encontrarlo.
 */
export function alertRadiusM(scenario: SafetyScenario, openForHours: number): number {
  const hours = Math.max(0, openForHours);
  const grown = scenario.initialRadiusM + scenario.growthPerHourM * hours;
  return Math.min(scenario.maxRadiusM, Math.round(grown));
}

/**
 * ¿Le importa esta alerta a alguien que está a esta distancia?
 *
 * El radio de la alerta y el del interesado se suman: una alerta con dos
 * kilómetros de alcance llega a quien está a dos kilómetros de ella, no solo a
 * quien la mira desde encima.
 */
export function reaches(
  scenario: SafetyScenario,
  openForHours: number,
  distanceMeters: number,
): boolean {
  return distanceMeters <= alertRadiusM(scenario, openForHours);
}

export const SAFETY_DISCLAIMER =
  'Petnav no sustituye a un veterinario ni a la policía local. Ante un envenenamiento o un ' +
  'atropello, la llamada va antes que la aplicación.';
