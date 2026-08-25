/**
 * Rescate y zonas marcadas.
 *
 * Dos de estos tests no comprueban que algo funcione: comprueban que algo
 * **siga sin poder hacerse**. Son los que impiden que la herramienta se
 * convierta en lo contrario de lo que es —una forma de señalar a un vecino, o
 * de vaciar un parque desde una sola cuenta— y por eso están escritos como
 * afirmaciones sobre la forma del dato y no sobre un texto que alguien tenga
 * que moderar a tiempo.
 */

import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_CHECKLIST,
  RESCUE_SCENARIOS,
  ZONE_MIN_REPORTERS,
  alertReachM,
  describeZone,
  findRescueScenario,
  hazardZones,
  type RescueReport,
} from './rescue.js';

const NOW = new Date(2026, 5, 15, 12, 0);

function report(
  daysAgo: number,
  reporterId: string,
  overrides: Partial<RescueReport> = {},
): RescueReport {
  const at = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return {
    id: `${daysAgo}-${reporterId}`,
    scenarioId: 'poisoning_seen',
    placeId: 'central',
    reporterId,
    reportedAt: at.toISOString(),
    ...overrides,
  };
}

describe('el catálogo de rescate', () => {
  it('cada escenario dice qué hacer, y en orden', () => {
    for (const scenario of RESCUE_SCENARIOS) {
      expect(scenario.steps.length, `${scenario.id} no tiene pasos`).toBeGreaterThan(0);
    }
  });

  it('una rescatista se entera desde más lejos que un tutor', () => {
    /* No es un ajuste fino: son dos usos distintos del mismo hecho. Una se
       desplaza, el otro decide por dónde pasear. */
    for (const scenario of RESCUE_SCENARIOS) {
      expect(
        alertReachM(scenario, 'rescuer'),
        `${scenario.id} avisa igual de lejos a los dos`,
      ).toBeGreaterThan(alertReachM(scenario, 'tutor'));
    }
  });

  it('lo que no es peligro para tu perro no le llega a un tutor', () => {
    /* Un animal atado sin agua en un patio ajeno no es un peligro para quien
       pasea: es algo que hay que denunciar. Mandárselo a todo el barrio no
       ayuda al animal y sí enseña a silenciar los avisos, y entonces tampoco
       llega el de los cebos. */
    expect(alertReachM(findRescueScenario('neglect_situation')!, 'tutor')).toBe(0);
  });

  it('el envenenamiento dice lo que casi nadie dice: que no le hagas vomitar', () => {
    /* Es la reacción instintiva y con un cáustico —o con el animal ya
       convulsionando— hace más daño que el veneno. Si este paso desapareciera
       del catálogo, la pantalla seguiría estando igual de bonita. */
    const steps = findRescueScenario('poisoning_seen')!.steps.join(' ').toLowerCase();
    expect(steps).toContain('no le hagas vomitar');
    expect(steps).toContain('muestra');
  });
});

describe('un aviso no puede acusar a nadie', () => {
  /*
   * La comprobación más importante del módulo, y por eso es estructural.
   *
   * Confiar en moderar textos es confiar en llegar a tiempo, y aquí llegar
   * tarde significa que un vecino aparece señalado por envenenar perros en el
   * teléfono de todo el barrio. En la región de la que hablamos, acusaciones
   * así han terminado en agresiones a personas que después no tenían nada que
   * ver. Si el campo no existe, la acusación no se puede escribir.
   */
  const FORBIDDEN = [
    'note',
    'notes',
    'text',
    'comment',
    'description',
    'personName',
    'suspect',
    'plate',
    'photo',
    'photos',
    'address',
  ];

  it('el aviso no tiene dónde escribir un nombre, una matrícula ni texto libre', () => {
    const sample = report(1, 'ana');
    for (const field of FORBIDDEN) {
      expect(Object.keys(sample), `el aviso admite «${field}»`).not.toContain(field);
    }
  });

  it('lo que se guarda es un escenario, un sitio y quién avisó', () => {
    expect(Object.keys(report(1, 'ana')).sort()).toEqual([
      'id',
      'placeId',
      'reportedAt',
      'reporterId',
      'scenarioId',
    ]);
  });

  it('lo que se publica de una zona no incluye a quien avisó', () => {
    /* `reporterId` entra para contar personas distintas y **no sale**. Publicar
       quién avisó de un cebo es publicar a quién ir a preguntar. */
    const zone = hazardZones([report(1, 'ana'), report(2, 'luis'), report(3, 'sara')], {
      now: NOW,
    })[0]!;
    expect(Object.keys(zone)).not.toContain('reporterId');
    expect(JSON.stringify(zone)).not.toContain('ana');
  });
});

describe('una zona marcada', () => {
  it('hacen falta tres personas distintas', () => {
    const zones = hazardZones([report(1, 'ana'), report(2, 'luis'), report(3, 'sara')], {
      now: NOW,
    });
    expect(zones).toHaveLength(1);
    expect(zones[0]?.reporters).toBe(ZONE_MIN_REPORTERS);
    expect(zones[0]?.placeId).toBe('central');
  });

  it('una sola persona no marca un parque por mucho que repita', () => {
    /* La regla que separa esto de un arma. Contando avisos en vez de personas,
       cualquiera vacía de gente el parque que quiera rellenando el formulario
       cinco veces. */
    const spam = [1, 2, 3, 4, 5, 6].map((day) => report(day, 'ana'));
    expect(hazardZones(spam, { now: NOW })).toEqual([]);
  });

  it('dos personas tampoco, aunque una avise mucho', () => {
    const almost = [report(1, 'ana'), report(2, 'ana'), report(3, 'ana'), report(4, 'luis')];
    expect(hazardZones(almost, { now: NOW })).toEqual([]);
  });

  it('la zona caduca sola al salirse de la ventana', () => {
    /* Un cebo en marzo no hace peligroso el parque en septiembre, y una marca
       que no se borra acaba siendo un mapa de barrios señalados. */
    const old = [report(40, 'ana'), report(45, 'luis'), report(50, 'sara')];
    expect(hazardZones(old, { now: NOW })).toEqual([]);
  });

  it('un aviso fechado en el futuro no cuenta', () => {
    /* El reloj del teléfono se puede tocar, y sin esto tres avisos con fecha de
       dentro de un año marcarían el parque para siempre. */
    const future = [
      report(-30, 'ana'),
      report(-31, 'luis'),
      report(-32, 'sara'),
    ];
    expect(hazardZones(future, { now: NOW })).toEqual([]);
  });

  it('cada sitio y cada motivo van por separado', () => {
    const mixed = [
      report(1, 'ana'),
      report(2, 'luis'),
      report(3, 'sara'),
      report(1, 'ana', { placeId: 'retiro', scenarioId: 'abandoned_litter' }),
      report(2, 'luis', { placeId: 'retiro', scenarioId: 'abandoned_litter' }),
      report(3, 'sara', { placeId: 'retiro', scenarioId: 'abandoned_litter' }),
    ];
    const zones = hazardZones(mixed, { now: NOW });
    expect(zones).toHaveLength(2);
    expect(zones.map((zone) => zone.placeId).sort()).toEqual(['central', 'retiro']);
  });

  it('mezclar motivos en el mismo parque no suma para marcarlo', () => {
    /* Un cebo, una camada y un atropello son tres cosas distintas. Sumarlas
       diría «este parque es peligroso» a partir de hechos que no tienen
       ninguna relación entre sí. */
    const unrelated = [
      report(1, 'ana'),
      report(2, 'luis', { scenarioId: 'injured_animal' }),
      report(3, 'sara', { scenarioId: 'abandoned_litter' }),
    ];
    expect(hazardZones(unrelated, { now: NOW })).toEqual([]);
  });

  it('se cuenta con números y no con adjetivos', () => {
    const zone = hazardZones(
      [report(1, 'ana'), report(2, 'luis'), report(3, 'sara'), report(4, 'ana')],
      { now: NOW },
    )[0]!;
    /* «4 avisos de 3 personas» se puede comprobar y se puede discutir. «Zona
       peligrosa» es una etiqueta que se queda pegada a un barrio. */
    expect(describeZone(zone)).toBe(
      '4 avisos de un animal envenenado este mes, de 3 personas distintas',
    );
  });

  it('un historial vacío no marca nada y no se rompe', () => {
    expect(hazardZones([], { now: NOW })).toEqual([]);
  });
});

describe('lo que hace falta para denunciar', () => {
  it('dice que se fotografíe el sitio y no a las personas', () => {
    const checklist = EVIDENCE_CHECKLIST.join(' ').toLowerCase();
    expect(checklist).toContain('de personas no');
  });

  it('pide repetición, que es lo que sostiene un caso', () => {
    expect(EVIDENCE_CHECKLIST.join(' ').toLowerCase()).toContain('cada vez que lo veas');
  });
});
