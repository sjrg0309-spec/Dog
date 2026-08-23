/**
 * Lo que quema no es el aire: es el suelo.
 *
 * La regla anterior de la aplicación era «asfalto y 28 °C o más, se para». Es
 * una regla razonable y tiene un fallo: usa la temperatura del aire para hablar
 * de una superficie cuya temperatura depende sobre todo del sol. A 24 °C con el
 * sol de mediodía en agosto el asfalto quema; a 29 °C bajo un cielo cubierto, a
 * las nueve de la noche, no. El umbral del aire acierta de media y falla en los
 * dos casos que importan: el que para de más y el que no para.
 *
 * Con la radiación solar sí se puede estimar la superficie. La aproximación que
 * se usa aquí es la de las tablas de quemaduras en almohadillas que circulan en
 * veterinaria, que a su vez vienen de mediciones de pavimento: con sol pleno el
 * asfalto se pone entre 25 y 30 grados por encima del aire —25 °C de aire con
 * ~52 °C de asfalto es el par que más se cita—. Eso da un coeficiente de unos
 * 0,028 grados por cada W/m² de radiación, que a los ~1000 W/m² del mediodía
 * despejado son los ~28 grados de diferencia.
 *
 * **Es una estimación y se dice que lo es.** No hay ningún termómetro en el
 * suelo, la superficie real depende del color del asfalto, de su edad, del
 * viento y de cuánto lleve dando el sol ahí. Por eso el veredicto que sale de
 * aquí nunca sustituye a la comprobación que sí es fiable y que la pantalla
 * sigue diciendo: la mano en el suelo siete segundos.
 *
 * El sentido del error también es deliberado. La estimación tiende a quedarse
 * corta —usa la radiación del momento y no la acumulada— así que los umbrales
 * de abajo se fijan por debajo de lo que la literatura marca como daño, no por
 * encima. En una función que decide si un animal pisa algo que quema, el error
 * caro es el optimista.
 */

/** Grados de superficie por cada W/m² de radiación de onda corta. */
export const RADIATION_TO_GROUND_C = 0.028;

/**
 * A partir de aquí una almohadilla se daña en menos de un minuto de contacto.
 * La cifra que se cita para daño es ~52 °C; se para antes.
 */
export const GROUND_BURN_C = 48;

/** Aquí todavía no quema, pero un rato largo o correr ya es mala idea. */
export const GROUND_HOT_C = 40;

/** Superficies que dan la cara al sol. Bajo techo y la hierba no cuentan igual. */
const SUN_EXPOSURE: Record<string, number> = {
  /* El asfalto es oscuro y almacena: es el caso peor y el de referencia. */
  asphalt: 1,
  /* La tierra se calienta menos y disipa antes. */
  earth: 0.55,
  /* La hierba transpira: su superficie se queda cerca del aire. */
  grass: 0.25,
  indoor: 0,
  unknown: 0.55,
};

/**
 * Estima la temperatura de la superficie.
 *
 * Devuelve `null` cuando no hay radiación medida, que es lo mismo que decir
 * «no lo sé»: por la noche vale cero y de noche el suelo no quema, pero un
 * proveedor que no da el dato no es lo mismo que un cielo sin sol, y quien
 * llama tiene que poder distinguirlos.
 */
export function estimateGroundC(
  airC: number,
  solarRadiation: number | null,
  surface: string,
): number | null {
  if (solarRadiation === null || Number.isNaN(solarRadiation)) return null;
  const exposure = SUN_EXPOSURE[surface] ?? SUN_EXPOSURE['unknown'] ?? 0.55;
  const rise = Math.max(0, solarRadiation) * RADIATION_TO_GROUND_C * exposure;
  return Math.round((airC + rise) * 10) / 10;
}

export type GroundVerdict = 'safe' | 'hot' | 'burns';

export function judgeGround(groundC: number | null): GroundVerdict | null {
  if (groundC === null) return null;
  if (groundC >= GROUND_BURN_C) return 'burns';
  if (groundC >= GROUND_HOT_C) return 'hot';
  return 'safe';
}

/**
 * La comprobación que sí es de fiar, y que ninguna estimación reemplaza.
 *
 * Está aquí y no en la pantalla para que viaje con el veredicto: un consejo que
 * vive en un componente se pierde la primera vez que alguien reutiliza el dato.
 */
export const HAND_TEST =
  'Pon el dorso de la mano en el suelo siete segundos. Si no aguantas, él tampoco: ' +
  'va descalzo y no puede decírtelo.';
