/**
 * Agrupar caras que están en el mismo sitio.
 *
 * Es la otra mitad de lo que hace legible el mapa de Snapchat: de cerca, cada
 * cara; de lejos, **una burbuja con un número**. Sin esto, alejar el mapa a
 * escala de ciudad apilaba seis retratos sobre el mismo parque y el corro que
 * los reparte —pensado para dos o tres— los mandaba a un anillo del tamaño del
 * barrio, con seis hilos cruzados que no decían nada. Seis caras a cuatro
 * kilómetros no se reconocen de todas formas; «6 perros en el Retiro» sí se
 * lee, y de un vistazo.
 *
 * Va sin React y sin importar el mapa —solo su tipo— por la razón de siempre:
 * es lógica pura que se equivoca en silencio. Un grupo mal hecho no revienta,
 * enseña cinco perros donde hay seis, y eso solo lo atrapa un número.
 *
 * **Se agrupa por coordenada, no por distancia en pantalla.** La aplicación
 * ancla cada cara al parque donde está su perro —todos los que están en el
 * Retiro llevan exactamente la latitud y longitud del Retiro—, así que «el
 * mismo sitio» es literal: misma coordenada, mismo grupo. Dos parques a cien
 * metros siguen siendo dos grupos aunque a escala de ciudad se toquen; para
 * eso ya está el corro del mapa, que reparte lo que se pisa sin fingir que es
 * una sola cosa.
 */

import type { MapMarker } from '../components/mini-map';

/**
 * Por debajo de este nivel se agrupa; en él y por encima, cada cara va sola.
 *
 * El 15 es «barrio»: menos de dos kilómetros de ancho en Madrid, donde un
 * retrato de cuarenta píxeles todavía se reconoce y donde dos caras en el
 * mismo parque caben de sobra con el corro. Al 13, el mismo parque son doce
 * píxeles y ya no hay sitio para nadie.
 */
export const CLUSTER_BELOW_ZOOM = 15;

/**
 * Cómo se llama hoy el sitio en `kind` de una cara: «Paseando en <sitio>».
 * Es frágil a propósito de admitirlo: si alguien cambia el texto, el nombre
 * del grupo se degrada a la frase entera en vez de romperse, y `placeName`
 * existe para que el sitio llegue sin adivinar.
 */
const WALKING_PREFIX = 'Paseando en ';

/** El nombre del sitio de una cara: el explícito si viene, y si no, se deduce. */
export function placeNameOf(marker: MapMarker): string {
  if (marker.placeName) return marker.placeName;
  return marker.kind.startsWith(WALKING_PREFIX)
    ? marker.kind.slice(WALKING_PREFIX.length)
    : marker.kind;
}

/**
 * La clave de un sitio: la coordenada a un millonésimo de grado.
 *
 * Son unos once centímetros en el ecuador, muy por debajo de lo que separa dos
 * parques y muy por encima del ruido de coma flotante que dejaría dos caras
 * del mismo sitio en dos grupos. Y es lo que hace el identificador
 * **determinista**: el mismo sitio da siempre el mismo `id`, así que la
 * selección sobrevive a un render y las pruebas pueden esperarlo por su nombre.
 */
function placeKey(marker: MapMarker): string {
  return `${marker.lat.toFixed(6)},${marker.lng.toFixed(6)}`;
}

/**
 * Los marcadores como se van a dibujar a este nivel.
 *
 * Al 15 o más cerca devuelve la lista tal cual —la misma referencia, para que
 * nadie de arriba se entere—. Más lejos, las caras que comparten coordenada
 * se funden en un solo marcador `kind: 'cluster'` que ocupa el sitio de la
 * primera de ellas en la lista; lo que no es una cara pasa intacto y en su
 * orden. Una cara sola en su sitio sigue siendo una cara: una burbuja con un
 * «1» diría menos que el retrato.
 */
export function clusterMarkers(markers: MapMarker[], zoom: number): MapMarker[] {
  if (zoom >= CLUSTER_BELOW_ZOOM) return markers;

  const groups = new Map<string, MapMarker[]>();
  for (const marker of markers) {
    if (marker.petId === undefined) continue;
    const key = placeKey(marker);
    const group = groups.get(key);
    if (group) group.push(marker);
    else groups.set(key, [marker]);
  }

  const emitted = new Set<string>();
  const result: MapMarker[] = [];
  for (const marker of markers) {
    if (marker.petId === undefined) {
      result.push(marker);
      continue;
    }
    const key = placeKey(marker);
    if (emitted.has(key)) continue;
    emitted.add(key);

    const group = groups.get(key) ?? [marker];
    if (group.length < 2) {
      result.push(marker);
      continue;
    }

    const first = group[0] ?? marker;
    const place = placeNameOf(first);
    result.push({
      id: `cluster-${key}`,
      lat: first.lat,
      lng: first.lng,
      label: `${group.length} perros en ${place}`,
      kind: 'cluster',
      detail: 'Toca para acercar y ver quién está.',
      icon: first.icon,
      /* Del color de «en vivo», como las caras que resume: es gente que está
         fuera ahora, no un sitio. Sin `heat` ni `radiusM` a propósito: el halo
         de actividad lo lleva el parque, y ponérselo también a la burbuja lo
         dibujaría dos veces en el mismo punto. */
      tone: 'friend',
      placeName: place,
      clusterCount: group.length,
      clusterIds: group.map((member) => member.id),
    });
  }
  return result;
}
