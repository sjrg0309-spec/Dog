/**
 * La presencia, comprobada como lo que es: una promesa de apagado.
 *
 * El radar promete que nadie se queda visible por olvido, y desde que el
 * check-in se ve desde varias pantallas la promesa ya no la puede cumplir
 * ninguna de ellas: la cumple el almacén, o no la cumple nadie. Estos tests
 * miran las cuatro cosas que, si fallan, no se ven en una captura:
 *
 *  - que una sesión vencida **no se lee**, sin que nadie la borre;
 *  - que cerrar devuelve lo que se cierra, porque el resumen del paseo vive de
 *    ese dato;
 *  - que el modo fantasma **apaga de verdad**: se niega a salir, desde
 *    cualquier sitio;
 *  - y que apagar nunca está bloqueado, ni con el modo fantasma puesto.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  checkIn,
  checkOut,
  livePresence,
  readLivePresence,
  readPresence,
  remainingMinutes,
  resetPresence,
  setGhostMode,
  type PresenceSession,
} from './presence.js';

const NOW = Date.UTC(2026, 8, 3, 18, 0);
const MINUTE = 60_000;

const session = (partial: Partial<PresenceSession> = {}): PresenceSession => ({
  petId: 'nina',
  placeId: 'central',
  placeName: 'Parque Central',
  startedAt: NOW,
  until: NOW + 60 * MINUTE,
  recommendedMinutes: 60,
  temperatureC: 17,
  surface: 'grass',
  welfareLevel: 'ok',
  ...partial,
});

beforeEach(() => {
  resetPresence();
});

describe('salir y volver', () => {
  it('sin sesión no hay nada que leer', () => {
    expect(readPresence()).toBeNull();
    expect(readLivePresence(NOW)).toBeNull();
  });

  it('tras el check-in la sesión se lee en vivo', () => {
    expect(checkIn(session())).toBe(true);
    expect(readLivePresence(NOW)).toEqual(session());
    expect(readLivePresence(NOW + 59 * MINUTE)).toEqual(session());
  });

  it('una sesión vencida se lee como nula sin que nadie la borre', () => {
    /* No hay ningún proceso que barra: la sesión sigue guardada tal cual y es
       la lectura la que decide. Es lo que hace que dos pantallas abiertas a la
       vez no puedan discrepar, y lo que hace que cerrar la aplicación no
       cambie nada. */
    checkIn(session());
    expect(readPresence()).not.toBeNull();
    expect(readLivePresence(NOW + 60 * MINUTE)).toBeNull();
    expect(readLivePresence(NOW + 3 * 60 * MINUTE)).toBeNull();
  });

  it('cerrar devuelve la sesión y deja el hueco vacío', () => {
    /* Quien cierra necesita lo que se cierra: la hora de salida y el consejo
       congelado son lo que se escribe en el paseo. Sin devolverlo, el resumen
       tendría que haberse copiado antes, que es como se pierde. */
    checkIn(session());
    expect(checkOut()).toEqual(session());
    expect(readPresence()).toBeNull();
    expect(checkOut()).toBeNull();
  });

  it('cerrar devuelve también una sesión ya vencida', () => {
    /* Que haya vencido no significa que el paseo no ocurriera. */
    checkIn(session());
    expect(livePresence(readPresence(), NOW + 2 * 60 * MINUTE)).toBeNull();
    expect(checkOut()).toEqual(session());
  });

  it('un segundo check-in sustituye al primero', () => {
    checkIn(session());
    checkIn(session({ placeId: 'berlin', placeName: 'Parque Berlín' }));
    expect(readLivePresence(NOW)?.placeName).toBe('Parque Berlín');
  });
});

describe('modo fantasma', () => {
  it('con el modo puesto no se puede hacer check-in', () => {
    /* Un interruptor de privacidad que solo te esconde de tu propia pantalla
       es peor que no tenerlo. Por eso la negativa vive aquí y no en el botón:
       ninguna superficie nueva puede publicar una presencia que el tutor pidió
       esconder, aunque se le olvide comprobar el modo. */
    setGhostMode(true);
    expect(checkIn(session())).toBe(false);
    expect(readPresence()).toBeNull();
    expect(readLivePresence(NOW)).toBeNull();
  });

  it('al volver a aparecer se puede salir otra vez', () => {
    setGhostMode(true);
    setGhostMode(false);
    expect(checkIn(session())).toBe(true);
  });

  it('cerrar funciona aunque el modo fantasma esté puesto', () => {
    /* Nada de lo que hace la privacidad puede dejar a alguien visible más
       tiempo: esconderse a mitad de paseo tiene que poder apagar el paseo. */
    checkIn(session());
    setGhostMode(true);
    expect(checkOut()).toEqual(session());
    expect(readPresence()).toBeNull();
  });
});

describe('cuánto queda', () => {
  it('redondea hacia arriba y nunca baja de un minuto', () => {
    /* El rótulo es una promesa de apagado: «1 min» con cuarenta segundos por
       delante es verdad; «0 min» mientras sigue visible no lo es. */
    expect(remainingMinutes(NOW + 42 * MINUTE, NOW)).toBe(42);
    expect(remainingMinutes(NOW + 41 * MINUTE + 1, NOW)).toBe(42);
    expect(remainingMinutes(NOW + 40_000, NOW)).toBe(1);
    expect(remainingMinutes(NOW, NOW)).toBe(1);
  });
});
