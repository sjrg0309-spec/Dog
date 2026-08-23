/**
 * Teselas de mapa: la aritmética.
 *
 * Esto es lo que convierte «estoy en el parque del Retiro» en «hacen falta las
 * imágenes 2005/1543, 2006/1543 y 2006/1544 del nivel 12». Es el mismo esquema
 * XYZ que usan Google Maps, Waze, OpenStreetMap y cualquier mapa deslizante
 * desde 2005, así que **funciona en cualquier país sin cambiar nada**: no hay
 * una lista de ciudades soportadas, hay una fórmula.
 *
 * Va en un módulo aparte y sin React por la razón de siempre en este proyecto:
 * es lógica pura, se equivoca en silencio —una tesela mal calculada no revienta,
 * dibuja la calle equivocada— y por eso se prueba a fondo.
 *
 * **Proyección: Web Mercator.** No es la que usaba el esquema de antes, que era
 * equirectangular, y el cambio no es un detalle: si se dibujan marcadores con
 * una proyección sobre teselas hechas con otra, los puntos caen fuera de su
 * calle, y cuanto más al norte, peor. En Madrid el desfase pasa de doscientos
 * metros; en Oslo, del kilómetro.
 *
 * Mercator deforma las áreas —Groenlandia parece África— y a cambio conserva
 * los ángulos y la escala **local**, que es lo que hace que un círculo de
 * quinientos metros se dibuje redondo. Para un mapa de barrio es la elección
 * correcta, y además es la única compatible con las teselas de todo el mundo.
 */

/** Lado de una tesela, en píxeles. Es el estándar de facto del esquema XYZ. */
export const TILE_SIZE = 256;

/**
 * Metros por píxel en el ecuador y al nivel cero.
 *
 * Sale de la circunferencia del elipsoide WGS84 —40 075 016,686 m— repartida
 * entre los 256 píxeles del mundo entero al nivel cero.
 */
export const EQUATOR_METERS_PER_PIXEL = 156_543.03392804097;

export type LatLng = { lat: number; lng: number };
export type TileRef = { x: number; y: number; z: number };

/** Los niveles que ofrece la aplicación: manzana, barrio, zona, ciudad. */
export const ZOOMS = [17, 15, 13, 11] as const;
export type Zoom = (typeof ZOOMS)[number];

/**
 * Latitud máxima que Mercator puede representar.
 *
 * En los polos la proyección se va a infinito, así que el mundo se corta en
 * ±85,0511°. Sin este tope, una coordenada ártica devuelve una tesela fuera del
 * mundo y el mapa sale en blanco en vez de en el borde.
 */
export const MAX_LATITUDE = 85.05112878;

const clampLatitude = (lat: number): number =>
  Math.min(MAX_LATITUDE, Math.max(-MAX_LATITUDE, lat));

/** Cuántos píxeles mide el mundo entero a este nivel. */
export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/**
 * De coordenadas a píxeles del mundo.
 *
 * La longitud es lineal; la latitud pasa por el logaritmo de Mercator, que es
 * de donde sale que el norte se estire.
 */
export function project(point: LatLng, zoom: number): { x: number; y: number } {
  const size = worldSize(zoom);
  const lat = clampLatitude(point.lat);
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

/** El camino de vuelta. Hace falta para saber qué hay bajo el dedo. */
export function unproject(pixel: { x: number; y: number }, zoom: number): LatLng {
  const size = worldSize(zoom);
  const lng = (pixel.x / size) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (pixel.y / size);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

/**
 * Cuántos metros mide un píxel aquí.
 *
 * Depende de la latitud, y por eso la barra de escala de un mapa cambia de
 * longitud cuando te mueves al norte aunque no toques el zoom. Sin el coseno, un
 * mapa de Helsinki diría que un kilómetro son el doble de píxeles de los que
 * son.
 */
export function metersPerPixel(lat: number, zoom: number): number {
  return (EQUATOR_METERS_PER_PIXEL * Math.cos((clampLatitude(lat) * Math.PI) / 180)) / 2 ** zoom;
}

/** Cuánto abarca de lado a lado un cuadro de `width` píxeles. */
export function spanMeters(lat: number, zoom: number, width: number): number {
  return metersPerPixel(lat, zoom) * width;
}

/**
 * Las teselas que hacen falta para cubrir el cuadro, con dónde va cada una.
 *
 * `left` y `top` son la posición dentro del cuadro, ya con el desplazamiento
 * del centro aplicado, así que quien dibuja no tiene que saber nada de
 * proyecciones: coloca imágenes en las coordenadas que le dan.
 *
 * El eje X **da la vuelta al mundo** —de ahí el módulo—, así que un mapa
 * centrado en el meridiano 180 sigue teniendo teselas a los dos lados en vez de
 * un borde vacío. El eje Y no: por arriba y por abajo el mundo se acaba, y una
 * fila fuera de rango se descarta en vez de envolverse.
 */
export function visibleTiles(
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
): Array<TileRef & { left: number; top: number }> {
  const middle = project(center, zoom);
  const originX = middle.x - width / 2;
  const originY = middle.y - height / 2;

  /* El cuadro cubre `[origen, origen + ancho)`, con el final **abierto**. Con
     `floor` sobre el final se pedía una columna entera de más cada vez que el
     borde caía justo en una junta de teselas —al nivel cero, el mundo entero
     salían dos imágenes en vez de una—, y esa columna no se ve: son bytes del
     usuario y peticiones al servidor comunitario a cambio de nada. */
  const firstX = Math.floor(originX / TILE_SIZE);
  const lastX = Math.ceil((originX + width) / TILE_SIZE) - 1;
  const firstY = Math.floor(originY / TILE_SIZE);
  const lastY = Math.ceil((originY + height) / TILE_SIZE) - 1;
  const count = 2 ** zoom;

  const tiles: Array<TileRef & { left: number; top: number }> = [];
  for (let ty = firstY; ty <= lastY; ty += 1) {
    if (ty < 0 || ty >= count) continue;
    for (let tx = firstX; tx <= lastX; tx += 1) {
      tiles.push({
        x: ((tx % count) + count) % count,
        y: ty,
        z: zoom,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/**
 * De dónde salen las imágenes.
 *
 * OpenStreetMap, porque es el único proveedor mundial que no pide una clave
 * —y una clave dentro de una aplicación instalada no es una clave—, y porque su
 * cobertura es de todos los países sin listas ni regiones.
 *
 * **Su política de uso es explícita y aquí se cumple la parte que le toca al
 * código:** una cabecera de identificación, nada de descargas masivas y la
 * atribución visible en pantalla. Lo que el código no puede garantizar por sí
 * solo lo tiene que decir el producto, y está escrito en la pantalla y en el
 * README: para una aplicación publicada de verdad hay que pasar a un proveedor
 * propio o pagado, porque el servidor comunitario no está para sostener el
 * tráfico de una aplicación con usuarios.
 */
export const TILE_ATTRIBUTION = '© OpenStreetMap';

export function tileUrl(tile: TileRef): string {
  return `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`;
}
