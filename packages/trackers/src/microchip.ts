/**
 * Validación del código de microchip.
 *
 * Conviene decirlo desde el principio, porque es una confusión muy extendida:
 * **un microchip no localiza**. Es un transpondedor RFID pasivo, sin batería y
 * sin GPS, legible solo con un lector a pocos centímetros. No emite, no se
 * puede seguir y no aparece en ningún mapa.
 *
 * Lo que sí aporta a DoggyMeet es identidad: ligar el chip a la cuenta permite
 * mostrar una insignia de tutor verificado, y en una aplicación donde quedas en
 * un parque con desconocidos y sueltas a tu perro con los suyos, esa señal vale.
 *
 * Y lo que este módulo NO puede hacer, por si alguien lo espera: comprobar que
 * un código existe de verdad. El número impreso en la cartilla no lleva dígito
 * de control —el CRC vive en el protocolo de radio, no en el número—, así que
 * validar el formato no demuestra que el chip sea real. La verificación de
 * verdad exige un documento veterinario o un acuerdo con un registro nacional.
 */

export type MicrochipStandard = 'iso-fdx-b' | 'legacy-9' | 'legacy-10';

export type MicrochipValidation =
  | {
      valid: true;
      normalized: string;
      standard: MicrochipStandard;
      /** Código de país o de fabricante, solo en los ISO de 15 dígitos. */
      prefix: string | null;
      /** `country` para códigos ISO 3166 numéricos, `manufacturer` para 900–999. */
      prefixKind: 'country' | 'manufacturer' | null;
      /** Recordatorio de que el formato válido no implica chip existente. */
      requiresRegistryCheck: true;
    }
  | { valid: false; reason: string };

/** Quita separadores habituales de la cartilla: espacios, guiones y puntos. */
export function normalizeMicrochip(input: string): string {
  return input.replace(/[\s.\-_]/g, '');
}

/**
 * Valida el formato de un código de microchip.
 *
 * Se aceptan tres formatos porque los tres circulan:
 *  - ISO 11784/11785 FDX-B, 15 dígitos. Es el estándar en Europa desde 2011.
 *  - Formatos heredados de 9 y 10 dígitos (AVID, Trovan, Destron), todavía
 *    presentes en muchos perros adultos. Rechazarlos dejaría fuera justo a los
 *    animales mayores.
 */
export function validateMicrochip(input: string): MicrochipValidation {
  const normalized = normalizeMicrochip(input);

  if (normalized.length === 0) {
    return { valid: false, reason: 'El código está vacío' };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, reason: 'El código solo puede contener dígitos' };
  }

  if (normalized.length === 9) {
    return {
      valid: true,
      normalized,
      standard: 'legacy-9',
      prefix: null,
      prefixKind: null,
      requiresRegistryCheck: true,
    };
  }

  if (normalized.length === 10) {
    return {
      valid: true,
      normalized,
      standard: 'legacy-10',
      prefix: null,
      prefixKind: null,
      requiresRegistryCheck: true,
    };
  }

  if (normalized.length !== 15) {
    return {
      valid: false,
      reason: 'Un código válido tiene 15 dígitos (ISO) o 9 y 10 en formatos antiguos',
    };
  }

  const prefix = normalized.slice(0, 3);
  const prefixNumber = Number(prefix);

  // 000 no es un código de país ni de fabricante asignable: es el hueco que
  // dejan los lectores cuando no consiguen leer bien.
  if (prefixNumber === 0) {
    return { valid: false, reason: 'El prefijo 000 no corresponde a ningún país ni fabricante' };
  }

  // ICAR reserva el rango 900–999 a fabricantes; por debajo son códigos de país
  // ISO 3166 numéricos (724 es España, 250 Francia, 380 Italia).
  const prefixKind = prefixNumber >= 900 ? 'manufacturer' : 'country';

  return {
    valid: true,
    normalized,
    standard: 'iso-fdx-b',
    prefix,
    prefixKind,
    requiresRegistryCheck: true,
  };
}

/**
 * Formatea un código para leerlo en voz alta o compararlo con la cartilla.
 *
 * Se agrupa 3-4-4-4 porque los tres primeros dígitos son el prefijo y separarlo
 * ayuda a detectar errores de transcripción, que es de lejos el fallo más común
 * cuando alguien teclea quince cifras a mano.
 */
export function formatMicrochip(code: string): string {
  const normalized = normalizeMicrochip(code);
  if (normalized.length !== 15) return normalized;
  return [
    normalized.slice(0, 3),
    normalized.slice(3, 7),
    normalized.slice(7, 11),
    normalized.slice(11, 15),
  ].join(' ');
}

/**
 * Registros públicos de consulta de chip, para poder enlazar al usuario.
 *
 * Son buscadores web, no APIs abiertas: la consulta automática exigiría un
 * acuerdo con cada registro. Enlazar es honesto; simular una comprobación
 * automática no lo sería.
 */
export const MICROCHIP_REGISTRIES = [
  {
    name: 'Europetnet',
    url: 'https://www.europetnet.com/',
    scope: 'Europa',
    hasPublicApi: false,
  },
  {
    name: 'AAHA Universal Pet Microchip Lookup',
    url: 'https://www.petmicrochiplookup.org/',
    scope: 'Estados Unidos',
    hasPublicApi: false,
  },
  {
    name: 'PetMaxx',
    url: 'https://www.petmaxx.com/',
    scope: 'Internacional',
    hasPublicApi: false,
  },
] as const;
