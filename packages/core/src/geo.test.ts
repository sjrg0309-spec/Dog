import { describe, expect, it } from 'vitest';

import { coarsen, distanceMeters, formatDistance, isInsideGeofence, proximityScore } from './geo.js';

/** Parque del Retiro y Puerta del Sol, Madrid: unos 1,9 km en línea recta. */
const RETIRO = { lat: 40.4153, lng: -3.6844 };
const SOL = { lat: 40.4169, lng: -3.7033 };

describe('distancia', () => {
  it('la distancia a uno mismo es cero', () => {
    expect(distanceMeters(RETIRO, RETIRO)).toBe(0);
  });

  it('coincide con la distancia real entre dos puntos conocidos', () => {
    const distance = distanceMeters(RETIRO, SOL);
    expect(distance).toBeGreaterThan(1500);
    expect(distance).toBeLessThan(1800);
  });

  it('es simétrica', () => {
    expect(distanceMeters(RETIRO, SOL)).toBeCloseTo(distanceMeters(SOL, RETIRO), 6);
  });

  it('un grado de latitud son unos 111 km', () => {
    const distance = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_000);
  });

  it('cruza el antimeridiano sin dar la vuelta al mundo', () => {
    const distance = distanceMeters({ lat: 0, lng: 179.99 }, { lat: 0, lng: -179.99 });
    expect(distance).toBeLessThan(3000);
  });
});

describe('degradación de precisión — la regla de privacidad como código', () => {
  it('redondea a una rejilla de aproximadamente un kilómetro', () => {
    expect(coarsen({ lat: 40.41536, lng: -3.68445 })).toEqual({ lat: 40.42, lng: -3.68 });
  });

  it('el error introducido es del orden de un kilómetro, no de diez metros', () => {
    const precise = { lat: 40.41536, lng: -3.68445 };
    const coarse = coarsen(precise);
    const error = distanceMeters(precise, coarse);

    // Suficiente para decidir un radio de dos kilómetros, inútil para seguir a
    // nadie: ese es exactamente el compromiso que se busca.
    expect(error).toBeGreaterThan(100);
    expect(error).toBeLessThan(1500);
  });

  it('dos puntos de la misma manzana caen en la misma celda', () => {
    const a = coarsen({ lat: 40.4153, lng: -3.6844 });
    const b = coarsen({ lat: 40.4157, lng: -3.6841 });
    expect(a).toEqual(b);
  });

  it('es idempotente: redondear lo ya redondeado no lo mueve', () => {
    const once = coarsen(RETIRO);
    expect(coarsen(once)).toEqual(once);
  });
});

describe('geocercas — la base del check-in automático', () => {
  it('detecta que el perro está dentro', () => {
    expect(isInsideGeofence({ lat: 40.4155, lng: -3.6846 }, RETIRO, 200)).toBe(true);
  });

  it('detecta que el perro salió', () => {
    expect(isInsideGeofence(SOL, RETIRO, 200)).toBe(false);
  });

  it('el borde exacto cuenta como dentro', () => {
    expect(isInsideGeofence(RETIRO, RETIRO, 0)).toBe(true);
  });
});

describe('puntuación de cercanía', () => {
  it('el mismo punto puntúa cien y el borde del radio, cero', () => {
    expect(proximityScore(0)).toBe(100);
    expect(proximityScore(2000, 2000)).toBe(0);
    expect(proximityScore(5000, 2000)).toBe(0);
  });

  it('decrece de forma monótona con la distancia', () => {
    let previous = 101;
    for (let distance = 0; distance <= 2000; distance += 100) {
      const score = proximityScore(distance, 2000);
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  });
});

describe('formato de distancia', () => {
  it('usa metros por debajo del kilómetro y kilómetros por encima', () => {
    expect(formatDistance(640)).toBe('640 m');
    expect(formatDistance(1400)).toBe('1,4 km');
  });

  it('usa la coma decimal del español', () => {
    expect(formatDistance(2500)).toContain(',');
    expect(formatDistance(2500)).not.toContain('.');
  });
});
