/**
 * La clase del perro y lo que necesita su persona.
 *
 * Tres de estos tests no comprueban que algo funcione: comprueban que algo
 * **no salga de aquí**. Son los que separan «decir que tu perro es de
 * asistencia para que no lo distraigan» de «publicar el diagnóstico de su
 * tutora al lado de una foto en una aplicación de barrio», y por eso están
 * escritos sobre la proyección de lo público y no sobre el texto de una
 * pantalla.
 */

import { describe, expect, it } from 'vitest';

import {
  ASSISTANCE_TYPES,
  AUTISTIC_DEFAULT_NEEDS,
  DOG_ROLES,
  HANDLER_NEEDS,
  approachNote,
  describeNeed,
  hasNeed,
  joinsOpenMeetups,
  publicPetCard,
  suggestedPlayStyles,
  worksInPublic,
  type Handler,
} from './roles.js';
import { PLAY_STYLES } from './species.js';

const handler: Handler = { autistic: true, needs: ['quiet_places', 'plan_ahead'] };

describe('la clase del perro', () => {
  it('lo normal es compañía y no hace falta explicarlo', () => {
    expect(DOG_ROLES[0]?.id).toBe('companion');
    expect(approachNote('companion')).toBeNull();
  });

  it('un perro de asistencia está trabajando, y se dice qué hacer', () => {
    /* La frase no pide permiso ni se disculpa: dice qué hacer. Un perro guía
       distraído deja de hacer su trabajo justo cuando hace falta. */
    expect(worksInPublic('assistance')).toBe(true);
    const note = approachNote('assistance')!;
    expect(note).toContain('No lo llames');
    expect(note).toContain('acaricies');
  });

  it('no se le proponen quedadas abiertas con desconocidos', () => {
    expect(joinsOpenMeetups('assistance')).toBe(false);
    expect(joinsOpenMeetups('companion')).toBe(true);
  });

  it('lo que se le propone es paseo tranquilo, no lucha libre', () => {
    expect(suggestedPlayStyles('assistance')).toEqual(['calm_walk']);
  });

  it('lo que propone cada clase son estilos de juego que existen', () => {
    /* Un estilo mal escrito aquí pasaría por la interfaz sin que el algoritmo
       de afinidad lo mire: no rompe nada y no hace nada. */
    for (const role of DOG_ROLES) {
      for (const style of suggestedPlayStyles(role.id)) {
        expect(PLAY_STYLES, `${role.id} propone «${style}»`).toContain(style);
      }
    }
  });
});

describe('para qué asiste no sale de aquí', () => {
  /*
   * La comprobación central del módulo. El papel se enseña —es lo que evita que
   * lo distraigan y lo que sostiene su acceso a sitios públicos—; el motivo es
   * información médica de una persona, y no tiene por qué ir al lado de la foto
   * de un perro en una aplicación de barrio.
   */
  const card = publicPetCard({
    name: 'Nube',
    role: 'assistance',
    showRole: true,
    assistanceType: 'autism',
    handler,
  });

  it('lo que se publica es el nombre, el papel y qué hacer', () => {
    expect(Object.keys(card).sort()).toEqual(['name', 'note', 'role']);
  });

  it('el tipo de asistencia no aparece por ningún lado', () => {
    const serialized = JSON.stringify(card).toLowerCase();
    for (const type of ASSISTANCE_TYPES) {
      expect(serialized, `se publica «${type.id}»`).not.toContain(type.id);
    }
    expect(serialized).not.toContain('autis');
    expect(serialized).not.toContain('psiqui');
    expect(serialized).not.toContain('epilep');
  });

  it('nada de la persona sale en la ficha del perro', () => {
    const serialized = JSON.stringify(card).toLowerCase();
    for (const need of HANDLER_NEEDS) {
      expect(serialized, `se publica «${need.id}»`).not.toContain(need.id);
    }
    expect(serialized).not.toContain('handler');
  });

  it('quien no quiera enseñar el papel, no lo enseña', () => {
    /* Enseñar «perro de asistencia» dice que su tutora tiene una discapacidad.
       Es útil y por eso se puede enseñar, pero es de ella decidirlo. */
    const hidden = publicPetCard({
      name: 'Nube',
      role: 'assistance',
      showRole: false,
      assistanceType: 'guide',
      handler,
    });
    expect(hidden.role).toBe('companion');
    expect(hidden.note).toBeNull();
  });
});

describe('los acomodos de la persona', () => {
  it('cada uno dice qué hace la aplicación distinto', () => {
    /* Si no cambia nada, no entra en la lista: es la misma regla que en la
       pantalla de configuración. Un acomodo decorativo es peor que ninguno,
       porque alguien lo enciende y cuenta con él. */
    for (const need of HANDLER_NEEDS) {
      expect(need.effect.length, `«${need.label}» no dice qué hace`).toBeGreaterThan(30);
      expect(describeNeed(need.id)).toBe(need.effect);
    }
  });

  it('decir «soy autista» preselecciona, no impone', () => {
    /* No hay dos personas autistas iguales, y dar por hecho lo contrario es la
       mitad del problema. */
    expect(AUTISTIC_DEFAULT_NEEDS.length).toBeGreaterThan(0);
    expect(AUTISTIC_DEFAULT_NEEDS.length).toBeLessThan(HANDLER_NEEDS.length);
    for (const need of AUTISTIC_DEFAULT_NEEDS) {
      expect(HANDLER_NEEDS.map((candidate) => candidate.id)).toContain(need);
    }
  });

  it('los acomodos funcionan sin decir por qué', () => {
    /* Que el mecanismo sean los acomodos y no el diagnóstico tiene una
       consecuencia práctica: el diagnóstico no hace falta guardarlo, y lo que
       no se guarda no se filtra. */
    const anonymous: Handler = { needs: ['quiet_places'] };
    expect(hasNeed(anonymous, 'quiet_places')).toBe(true);
    expect(anonymous.autistic).toBeUndefined();
  });

  it('lo que no se ha pedido, no está', () => {
    expect(hasNeed(handler, 'less_motion')).toBe(false);
  });
});
