/**
 * El estado del cielo, del código al castellano.
 *
 * Open-Meteo devuelve la tabla WMO 4677, que es un entero. Traducirlo es lo que
 * permite que la pantalla diga «cubierto» en vez de «3».
 *
 * Dos cosas del cielo cambian decisiones y por eso no son decoración: la lluvia
 * y la tormenta. Un perro con miedo a los truenos —el mismo miedo que llena el
 * SOS cada Nochevieja— no debería recibir una propuesta de quedada mientras cae
 * una tormenta, y eso solo se sabe leyendo este código.
 *
 * El mapa es deliberadamente incompleto: la tabla WMO tiene cien entradas y los
 * modelos usan estas. Un código que no esté cae en un texto neutro en lugar de
 * dejar la pantalla en blanco o reventar, y hay un test que lo comprueba sobre
 * los cien enteros. Un servicio que añade un código no puede romper una app.
 */

export type SkyCategory = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

type SkyEntry = { label: string; category: SkyCategory };

const CODES: Record<number, SkyEntry> = {
  0: { label: 'Despejado', category: 'clear' },
  1: { label: 'Casi despejado', category: 'clear' },
  2: { label: 'Parcialmente nublado', category: 'cloudy' },
  3: { label: 'Cubierto', category: 'cloudy' },
  45: { label: 'Niebla', category: 'fog' },
  48: { label: 'Niebla helada', category: 'fog' },
  51: { label: 'Llovizna débil', category: 'drizzle' },
  53: { label: 'Llovizna', category: 'drizzle' },
  55: { label: 'Llovizna intensa', category: 'drizzle' },
  56: { label: 'Llovizna helada', category: 'drizzle' },
  57: { label: 'Llovizna helada intensa', category: 'drizzle' },
  61: { label: 'Lluvia débil', category: 'rain' },
  63: { label: 'Lluvia', category: 'rain' },
  65: { label: 'Lluvia fuerte', category: 'rain' },
  66: { label: 'Lluvia helada', category: 'rain' },
  67: { label: 'Lluvia helada fuerte', category: 'rain' },
  71: { label: 'Nieve débil', category: 'snow' },
  73: { label: 'Nieve', category: 'snow' },
  75: { label: 'Nieve intensa', category: 'snow' },
  77: { label: 'Cinarra', category: 'snow' },
  80: { label: 'Chubascos débiles', category: 'rain' },
  81: { label: 'Chubascos', category: 'rain' },
  82: { label: 'Chubascos fuertes', category: 'rain' },
  85: { label: 'Chubascos de nieve', category: 'snow' },
  86: { label: 'Chubascos de nieve fuertes', category: 'snow' },
  95: { label: 'Tormenta', category: 'storm' },
  96: { label: 'Tormenta con granizo', category: 'storm' },
  99: { label: 'Tormenta con granizo fuerte', category: 'storm' },
};

const UNKNOWN: SkyEntry = { label: 'Sin datos del cielo', category: 'cloudy' };

export function describeSky(code: number): SkyEntry {
  return CODES[code] ?? UNKNOWN;
}

/** Truenos. Lo que asusta a un perro no es la lluvia, es esto. */
export function isThunderstorm(code: number): boolean {
  return describeSky(code).category === 'storm';
}

/** Cae agua de forma que moja de verdad. La llovizna no cuenta. */
export function isWet(code: number): boolean {
  const { category } = describeSky(code);
  return category === 'rain' || category === 'snow';
}
