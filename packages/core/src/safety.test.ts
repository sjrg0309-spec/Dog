/**
 * El catálogo de seguridad como test.
 *
 * Lo que se comprueba aquí no es que las funciones «funcionen»: es que el
 * catálogo siga diciendo lo que decidimos que dijera. Un radio mal puesto en
 * este fichero no rompe ninguna pantalla —todo compila, todo se pinta— y sin
 * embargo manda un aviso de perro perdido a media manzana o uno de cebos
 * envenenados a media ciudad.
 */

import { describe, expect, it } from 'vitest';

import {
  alertRadiusM,
  findScenario,
  reaches,
  SAFETY_SCENARIOS,
  scenariosOfKind,
  shareAlertText,
  type SafetyScenario,
} from './safety.js';

const byId = (id: string): SafetyScenario => {
  const scenario = findScenario(id);
  if (!scenario) throw new Error(`falta el escenario ${id}`);
  return scenario;
};

describe('el catálogo', () => {
  it('no tiene identificadores repetidos', () => {
    const ids = SAFETY_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada escenario dice qué hacer, y en más de un paso', () => {
    // Un escenario sin pasos es una etiqueta. Quien abre esto está nervioso y lo
    // único accionable que hay en la pantalla son estas frases.
    for (const scenario of SAFETY_SCENARIOS) {
      expect(scenario.steps.length, `${scenario.id} no trae pasos`).toBeGreaterThanOrEqual(2);
    }
  });

  it('el radio máximo nunca es menor que el inicial', () => {
    for (const scenario of SAFETY_SCENARIOS) {
      expect(scenario.maxRadiusM, scenario.id).toBeGreaterThanOrEqual(scenario.initialRadiusM);
    }
  });

  it('cubre los cuatro tipos de alerta', () => {
    for (const kind of ['lost_pet', 'found_pet', 'hazard', 'outbreak'] as const) {
      expect(scenariosOfKind(kind).length, kind).toBeGreaterThan(0);
    }
  });

  it('un escenario desconocido devuelve null en lugar de reventar', () => {
    // Los identificadores llegan de la base de datos. Uno viejo tras un cambio de
    // catálogo no puede tumbar la pantalla de emergencias, que es justo la que no
    // se puede permitir un fallo.
    expect(findScenario('lo_que_sea')).toBeNull();
  });
});

/**
 * La distinción que justifica que esto sea un catálogo y no un enum.
 */
describe('lo que se mueve y lo que no', () => {
  it('un cebo envenenado no amplía su radio con el tiempo', () => {
    const bait = byId('poison_bait');
    expect(bait.growthPerHourM).toBe(0);
    expect(alertRadiusM(bait, 0)).toBe(bait.initialRadiusM);
    expect(alertRadiusM(bait, 12)).toBe(bait.initialRadiusM);
  });

  it('un perro huido por petardos sí, y deprisa', () => {
    const fireworks = byId('fireworks');
    expect(alertRadiusM(fireworks, 0)).toBe(fireworks.initialRadiusM);
    expect(alertRadiusM(fireworks, 1)).toBeGreaterThan(alertRadiusM(fireworks, 0));
    // A las dos horas ya avisa a un radio de varios kilómetros: en pánico corren
    // en línea recta, y buscar donde se perdió no sirve.
    expect(alertRadiusM(fireworks, 2)).toBeGreaterThanOrEqual(8000);
  });

  it('ningún escenario crece por encima de su tope', () => {
    for (const scenario of SAFETY_SCENARIOS) {
      expect(alertRadiusM(scenario, 1000), scenario.id).toBe(scenario.maxRadiusM);
    }
  });

  it('un tiempo negativo no encoge el radio por debajo del inicial', () => {
    // El reloj del cliente puede ir atrasado respecto al servidor. Si eso
    // recortara el radio, una alerta recién abierta avisaría a menos gente justo
    // en su primer minuto.
    const escape = byId('escape_walk');
    expect(alertRadiusM(escape, -3)).toBe(escape.initialRadiusM);
  });
});

describe('a quién alcanza', () => {
  it('alcanza justo hasta el borde del radio, y no más allá', () => {
    const bait = byId('poison_bait');
    expect(reaches(bait, 0, bait.initialRadiusM)).toBe(true);
    expect(reaches(bait, 0, bait.initialRadiusM + 1)).toBe(false);
  });

  it('quien estaba fuera del aviso entra al crecer el radio', () => {
    // Es el comportamiento que justifica el crecimiento: el vecino a cuatro
    // kilómetros no se entera al principio y sí una hora después, que es cuando
    // el animal puede estar en su calle.
    const fireworks = byId('fireworks');
    expect(reaches(fireworks, 0, 4000)).toBe(false);
    expect(reaches(fireworks, 1, 4000)).toBe(true);
  });

  it('el cebo no gana audiencia con el tiempo', () => {
    const bait = byId('poison_bait');
    expect(reaches(bait, 0, 800)).toBe(false);
    expect(reaches(bait, 24, 800)).toBe(false);
  });
});

/**
 * Las reglas de urgencia.
 *
 * Están escritas como test porque son las que se erosionan sin querer: alguien
 * añade un escenario nuevo, le copia los valores al de al lado y de pronto un
 * aviso de cristales en el suelo llega tan lejos como un perro perdido.
 */
describe('proporción entre escenarios', () => {
  it('toda pérdida de animal es crítica', () => {
    for (const scenario of scenariosOfKind('lost_pet')) {
      expect(scenario.severity, scenario.id).toBe('critical');
    }
  });

  it('perderse avisa más lejos que un peligro fijo de zona', () => {
    const worstLoss = Math.max(
      ...scenariosOfKind('lost_pet').map((scenario) => scenario.initialRadiusM),
    );
    const worstHazard = Math.max(
      ...scenariosOfKind('hazard').map((scenario) => scenario.initialRadiusM),
    );
    expect(worstLoss).toBeGreaterThan(worstHazard);
  });

  it('lo que no se mueve no crece, y lo que se mueve sí', () => {
    // Un peligro anclado a un sitio —un cebo, un pinar con procesionaria, unos
    // cristales— no puede ampliar su aviso: solo diluiría el mensaje hasta que
    // nadie lo mirase.
    for (const id of ['poison_bait', 'processionary', 'debris', 'outbreak']) {
      expect(byId(id).growthPerHourM, id).toBe(0);
    }
    for (const scenario of scenariosOfKind('lost_pet')) {
      expect(scenario.growthPerHourM, scenario.id).toBeGreaterThan(0);
    }
  });

  it('los petardos son el caso que más lejos llega', () => {
    // Es el pico anual de animales perdidos. Si algún día otro escenario lo
    // supera, que sea una decisión y no un descuido.
    const widest = SAFETY_SCENARIOS.reduce((worst, scenario) =>
      scenario.maxRadiusM > worst.maxRadiusM ? scenario : worst,
    );
    expect(widest.id).toBe('fireworks');
  });

  it('encontrar un perro no crece, porque el que se mueve es el que busca', () => {
    const found = byId('found');
    expect(found.growthPerHourM).toBe(0);
  });
});

/**
 * Un tope que no se puede alcanzar es un número que miente.
 *
 * Lo encontró este test y no una revisión: cinco escenarios traían un radio
 * máximo mayor que el inicial y crecimiento cero, así que el tope era
 * inalcanzable. Se leía como «esto puede llegar a un kilómetro» cuando el aviso
 * se quedaba en quinientos metros para siempre.
 */
describe('el tope es alcanzable', () => {
  it.each(SAFETY_SCENARIOS.map((scenario) => [scenario.id, scenario] as const))(
    '%s alcanza su radio máximo con el tiempo suficiente',
    (_id, scenario) => {
      expect(alertRadiusM(scenario, 10_000)).toBe(scenario.maxRadiusM);
    },
  );

  it('lo que no crece tiene el tope igual al inicial', () => {
    for (const scenario of SAFETY_SCENARIOS) {
      if (scenario.growthPerHourM > 0) continue;
      expect(scenario.maxRadiusM, scenario.id).toBe(scenario.initialRadiusM);
    }
  });
});

/**
 * Compartir saca un aviso de la aplicación, así que lo que lleva el texto es
 * una decisión de producto y no del componente que lo pinta.
 *
 * Los dos casos que importan son los dos que se pueden equivocar solos: que el
 * teléfono de alguien salga cuando no lo publicó, y que el mensaje lleve unas
 * coordenadas que sobreviven al aviso. Los dos se comprueban aquí en vez de
 * confiar en que nadie añada un campo de más al construir la cadena.
 */
describe('el texto para compartir un aviso', () => {
  const base = {
    scenario: byId('escape_walk'),
    petName: 'Tuco',
    areaName: 'Parque Central',
    openForHours: 3,
    radiusM: 2400,
    contactPhone: null as string | null,
    sightings: 0,
  };

  it('nombra al animal, el sitio y hasta dónde llega', () => {
    const text = shareAlertText(base);
    expect(text).toContain('Tuco');
    expect(text).toContain('Parque Central');
    expect(text).toContain('2,4 km');
  });

  it('no lleva teléfono si su tutor no lo publicó', () => {
    expect(shareAlertText(base)).not.toContain('Contacto');
  });

  it('lo lleva cuando sí lo publicó, porque lo puso para que le llamen', () => {
    expect(shareAlertText({ ...base, contactPhone: '600 12 34 56' })).toContain('600 12 34 56');
  });

  it('nunca lleva coordenadas: un mensaje reenviado sobrevive al aviso', () => {
    const text = shareAlertText({ ...base, sightings: 2, contactPhone: '600 12 34 56' });
    expect(text).not.toMatch(/-?\d{1,3}\.\d{3,}/);
  });

  it('dice cuánta gente lo ha visto después, que es lo que cambia dónde buscar', () => {
    expect(shareAlertText({ ...base, sightings: 1 })).toContain('1 persona lo ha visto');
    expect(shareAlertText({ ...base, sightings: 3 })).toContain('3 personas lo han visto');
    expect(shareAlertText(base)).toContain('Sin avistamientos');
  });

  it('usa el nombre del escenario cuando el peligro no es de nadie', () => {
    const hazard = byId('poison_bait');
    const text = shareAlertText({ ...base, scenario: hazard, petName: null });
    expect(text).toContain(hazard.label);
  });
});
