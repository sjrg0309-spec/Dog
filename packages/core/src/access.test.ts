/**
 * La puerta de entrada.
 *
 * Estos tests comprueban una postura, no un cálculo: **los sitios son públicos
 * y las personas no**. Dos de ellos son de los que no se caen solos —afirman
 * que algo *sigue sin poder hacerse*— y están escritos sobre la tabla de
 * requisitos en vez de sobre el texto de una pantalla, porque una regla de
 * privacidad que vive en un `if` dentro de un componente se pierde en el
 * siguiente rediseño.
 */

import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES,
  ESTABLISHED_MIN_WALKS,
  accessLevel,
  can,
  isComplete,
  missingShelterFields,
  missingSteps,
  validateShelterProfile,
  whyNot,
  type AccountState,
  type PetDraft,
} from './access.js';

const account = (overrides: Partial<AccountState> = {}): AccountState => ({
  kind: 'tutor',
  pets: 1,
  microchipVerified: false,
  walks: 0,
  meetupsAttended: 0,
  ...overrides,
});

const draft = (overrides: Partial<PetDraft> = {}): PetDraft => ({
  name: 'Nina',
  speciesId: 'dog',
  ageMonths: 48,
  size: 'medium',
  energy: 'explorer',
  playStyles: ['chase'],
  availability: 3,
  ...overrides,
});

describe('sin animal no se entra', () => {
  it('cero animales es cero acceso', () => {
    expect(accessLevel(account({ pets: 0 }))).toBe('none');
  });

  it('no hay modo mirón: ni siquiera el mapa de parques', () => {
    /* La comprobación que sostiene la decisión entera. Si `places` se abriera
       sin cuenta «porque son sitios públicos», la aplicación tendría un modo de
       solo lectura, y entonces el alta obligatoria no protege de nada. */
    const level = accessLevel(account({ pets: 0 }));
    for (const capability of CAPABILITIES) {
      expect(can(level, capability), `${capability} se ve sin cuenta`).toBe(false);
    }
  });

  it('dice qué falta en vez de dejar la puerta muda', () => {
    expect(whyNot('none', 'places')).toContain('Da de alta');
  });
});

describe('con el animal declarado', () => {
  const level = accessLevel(account());

  it('se ven los sitios y el feed', () => {
    expect(level).toBe('declared');
    expect(can(level, 'places')).toBe(true);
    expect(can(level, 'feed')).toBe(true);
  });

  it('se puede publicar la propia presencia', () => {
    /* Hacer check-in expone a quien lo pulsa y a nadie más. Pedir chip para eso
       sería cobrar un peaje por enseñarte tú, que es al revés de lo que hay que
       proteger. */
    expect(can(level, 'check_in')).toBe(true);
  });

  it('NO se ve quién está fuera ahora', () => {
    /* La cara, el sitio y la hora son las tres cosas que le sirven a quien
       busca animales para llevárselos, y las tres están detrás del chip. */
    expect(can(level, 'live_people')).toBe(false);
    expect(whyNot(level, 'live_people')).toContain('Verifica el chip');
  });

  it('NO se ven los horarios de nadie', () => {
    expect(can(level, 'schedules')).toBe(false);
    expect(whyNot(level, 'schedules')).toContain('rutina diaria');
  });

  it('NO se escribe el primero a un desconocido', () => {
    expect(can(level, 'message_first')).toBe(false);
  });

  it('NO llegan los avisos de rescate de kilómetros', () => {
    /* El hueco más grande que había: el papel de rescatista amplía a kilómetros
       la lista de animales heridos, perdidos o sin dueño. Es justo lo que no
       debe poder consultar una cuenta hecha en treinta segundos. */
    expect(can(level, 'rescue_alerts')).toBe(false);
    expect(whyNot(level, 'rescue_alerts')).toContain('heridos');
  });
});

describe('con el chip verificado', () => {
  const level = accessLevel(account({ microchipVerified: true }));

  it('se abren las personas, no solo los sitios', () => {
    expect(level).toBe('verified');
    expect(can(level, 'live_people')).toBe(true);
    expect(can(level, 'schedules')).toBe(true);
    expect(can(level, 'message_first')).toBe(true);
    expect(can(level, 'rescue_alerts')).toBe(true);
  });

  it('todavía no se organizan quedadas ni se publica un espacio', () => {
    /* Abrir tu casa a un grupo, o convocarlo, es lo que más daño hace en malas
       manos. Se gana usando la aplicación, que es lo único de esta escalera que
       no se puede escribir a mano. */
    expect(can(level, 'host')).toBe(false);
    expect(whyNot(level, 'host')).toContain('paseos registrados');
  });
});

describe('asentado', () => {
  it('se gana paseando', () => {
    expect(accessLevel(account({ microchipVerified: true, walks: ESTABLISHED_MIN_WALKS }))).toBe(
      'established',
    );
  });

  it('o yendo a una quedada', () => {
    expect(accessLevel(account({ microchipVerified: true, meetupsAttended: 1 }))).toBe(
      'established',
    );
  });

  it('los paseos no saltan el chip', () => {
    /* Sin esta regla, alguien registra cinco paseos consigo mismo y se salta la
       única parte comprobable de la escalera. */
    expect(accessLevel(account({ walks: 50, meetupsAttended: 9 }))).toBe('declared');
  });
});

describe('el alta', () => {
  it('un alta completa lo es', () => {
    expect(isComplete(draft())).toBe(true);
    expect(missingSteps(draft())).toEqual([]);
  });

  it('sin horario no hay alta', () => {
    /* Es la mitad del producto: cruzar horarios es lo que hace que esto sirva a
       las once de la noche. Y un alta sin horario deja una cuenta que solo
       mira, que es lo que este módulo existe para impedir. */
    expect(missingSteps(draft({ availability: 0 }))).toEqual(['schedule']);
  });

  it('sin carácter no hay alta: es lo que decide con quién se junta', () => {
    expect(missingSteps(draft({ playStyles: [] }))).toEqual(['temperament']);
  });

  it('un nombre de una letra no cuenta', () => {
    expect(missingSteps(draft({ name: 'a' }))).toContain('name');
  });

  it('el chip no hace falta para entrar', () => {
    /* A propósito, y se puede discutir: hay animales adoptados hace años o de
       países donde no era obligatorio. Dejar fuera a sus tutores no protege a
       nadie; el chip abre puertas en vez de cerrar la entrada. */
    expect(isComplete(draft())).toBe(true);
  });

  it('lo que falta sale en el orden en que se pregunta', () => {
    const empty = draft({ name: '', ageMonths: null, size: null, energy: null, playStyles: [], availability: 0 });
    expect(missingSteps(empty)).toEqual(['name', 'age', 'size', 'temperament', 'schedule']);
  });
});

describe('la segunda puerta: quien rescata y no tiene animal', () => {
  const shelter = (overrides: Partial<AccountState> = {}): AccountState =>
    account({
      kind: 'rescuer',
      pets: 0,
      shelterProfile: 'https://instagram.com/patitas',
      ...overrides,
    });

  it('sin enlace no hay puerta', () => {
    expect(accessLevel(shelter({ shelterProfile: null }))).toBe('none');
  });

  it('con el enlace, queda pendiente de que alguien lo mire', () => {
    expect(accessLevel(shelter())).toBe('shelter_pending');
  });

  it('esperar no abre nada', () => {
    /* Si la espera diera acceso a algo, la espera sería la vía de entrada:
       cualquiera pega un enlace y se sienta a esperar. */
    const level = accessLevel(shelter());
    expect(can(level, 'rescue_alerts')).toBe(false);
    expect(can(level, 'live_people')).toBe(false);
    expect(can(level, 'message_first')).toBe(false);
    expect(can(level, 'places')).toBe(true);
  });

  it('no tiene feed social, y esa es la decisión que define esta cuenta', () => {
    /* Una protectora no entra a ver fotos del perro de nadie: entra a ver qué
       animal necesita ayuda cerca. Dejarle el feed sería convertir una
       herramienta de trabajo en otra aplicación de la que salir. */
    for (const level of ['shelter_pending', 'shelter'] as const) {
      expect(can(level, 'feed'), level).toBe(false);
      expect(can(level, 'rescue_board'), level).toBe(true);
    }
    expect(whyNot('shelter', 'feed')).toContain('no tienen feed social');
  });

  it('el tablero está desde el primer momento, incluso en revisión', () => {
    /* Es a lo que vienen, y es información ya publicada: quien abre un aviso de
       perro perdido quiere que lo vea el máximo de gente. Lo que la espera no
       abre son los avisos a kilómetros. */
    expect(can('shelter_pending', 'rescue_board')).toBe(true);
    expect(can('shelter_pending', 'rescue_alerts')).toBe(false);
  });

  it('aprobada, abre el rescate entero', () => {
    const level = accessLevel(shelter({ shelterReviewed: true }));
    expect(level).toBe('shelter');
    expect(can(level, 'rescue_alerts')).toBe(true);
    expect(can(level, 'message_first')).toBe(true);
  });

  it('aprobada, NO abre quién pasea ni los horarios', () => {
    /* La comprobación que sostiene toda la decisión. La puerta del rescate abre
       avisos de animales en peligro; si además abriera el mapa de gente,
       enseñar el enlace de una cuenta ajena sería la forma más barata de
       conseguir justo la lista que esta aplicación protege. */
    const level = accessLevel(shelter({ shelterReviewed: true }));
    expect(can(level, 'live_people')).toBe(false);
    expect(can(level, 'schedules')).toBe(false);
    expect(whyNot(level, 'live_people')).toContain('no necesita saber a qué hora');
  });

  it('una protectora aprobada ve más rescate que un tutor verificado y menos gente', () => {
    /* Los niveles no están en una línea, y este test lo fija: con un `>=` esto
       no se puede expresar, y al intentarlo se acaba dando de más. */
    const tutor = accessLevel(account({ microchipVerified: true }));
    const approved = accessLevel(shelter({ shelterReviewed: true }));
    expect(can(approved, 'rescue_alerts')).toBe(can(tutor, 'rescue_alerts'));
    expect(can(tutor, 'live_people')).toBe(true);
    expect(can(approved, 'live_people')).toBe(false);
  });

  it('no hay check-in sin animal propio', () => {
    const level = accessLevel(shelter({ shelterReviewed: true }));
    expect(can(level, 'check_in')).toBe(false);
    expect(whyNot(level, 'check_in')).toContain('no nos has presentado a tu animal');
  });
});

describe('el enlace del colectivo', () => {
  it('acepta un perfil de una red', () => {
    const check = validateShelterProfile('https://www.instagram.com/patitas.rescate/');
    expect(check.ok).toBe(true);
    expect(check.ok && check.platform).toBe('Instagram');
    expect(check.ok && check.handle).toBe('patitas.rescate');
  });

  it('acepta escribirlo sin https', () => {
    expect(validateShelterProfile('facebook.com/refugiosur').ok).toBe(true);
  });

  it('acepta una web propia', () => {
    /* En América Latina media protectora se organiza en una página propia o en
       Facebook. Una lista cerrada de redes dejaría fuera a las de siempre. */
    expect(validateShelterProfile('https://refugiolaesperanza.org').ok).toBe(true);
  });

  it('rechaza una publicación suelta', () => {
    /* Un post no dice cuánto lleva la cuenta ni qué hace: es lo que se manda
       cuando se quiere pasar rápido. */
    const check = validateShelterProfile('https://instagram.com/p/Cxyz123/');
    expect(check.ok).toBe(false);
    expect(!check.ok && check.reason).toContain('publicación');
  });

  it('rechaza un acortador', () => {
    /* Un enlace que no dice a dónde va no se puede revisar, y quien revisa
       acabaría abriendo lo que le manden. */
    const check = validateShelterProfile('https://bit.ly/3xAbcd');
    expect(check.ok).toBe(false);
    expect(!check.ok && check.reason).toContain('acortados');
  });

  it('rechaza la portada de la red', () => {
    expect(validateShelterProfile('https://instagram.com').ok).toBe(false);
  });

  it('rechaza lo que no es un enlace', () => {
    expect(validateShelterProfile('mi protectora').ok).toBe(false);
    expect(validateShelterProfile('').ok).toBe(false);
  });

  it('no promete lo que no puede: solo mira la forma', () => {
    /* Comprobación de expectativas, no de código. Un enlace con forma correcta
       a una cuenta que no existe pasa, y tiene que pasar: lo contrario sería
       fingir una verificación que aquí no se puede hacer. La cuenta queda
       pendiente de revisión humana justo por esto. */
    const check = validateShelterProfile('https://instagram.com/esta-cuenta-no-existe-12345');
    expect(check.ok).toBe(true);
  });
});

describe('el alta de la protectora', () => {
  it('pide nombre, enlace y qué hacéis', () => {
    expect(
      missingShelterFields({ name: '', profile: '', activities: [] }).length,
    ).toBe(3);
  });

  it('completa no falta nada', () => {
    expect(
      missingShelterFields({
        name: 'Patitas del Sur',
        profile: 'instagram.com/patitas',
        activities: ['foster'],
      }),
    ).toEqual([]);
  });

  it('lo que hace un colectivo son opciones, no un campo de texto', () => {
    /* La misma regla que en los avisos de rescate: un campo donde escribir lo
       que sea acaba siendo un campo donde escribir sobre alguien. */
    expect(Object.keys({ name: '', profile: '', activities: [] }).sort()).toEqual([
      'activities',
      'name',
      'profile',
    ]);
  });
});
