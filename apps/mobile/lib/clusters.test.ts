/**
 * Las burbujas del mapa, con números.
 *
 * Un grupo mal hecho no revienta: enseña cinco perros donde hay seis, o funde
 * dos parques en uno, y en la captura el mapa sigue pareciendo un mapa. Es la
 * clase de fallo que solo se atrapa contando.
 */

import { describe, expect, it } from 'vitest';

import { CLUSTER_BELOW_ZOOM, clusterMarkers, placeNameOf } from './clusters.js';
import type { MapMarker } from '../components/mini-map';

/* Un icono de mentira: el tipo pide uno y aquí no se dibuja nada. Importar el
   de verdad traería `react-native-svg` a un test que corre en Node pelado. */
const icon = (() => null) as unknown as MapMarker['icon'];

const RETIRO = { lat: 40.4153, lng: -3.6844 };
const ARGANZUELA = { lat: 40.3922, lng: -3.6959 };

function face(
  id: string,
  name: string,
  place: string,
  at: { lat: number; lng: number },
): MapMarker {
  return {
    id: `pet-${id}`,
    ...at,
    label: name,
    kind: `Paseando en ${place}`,
    detail: `${name} está fuera.`,
    icon,
    tone: 'friend',
    petId: id,
  };
}

const park: MapMarker = {
  id: 'place-retiro',
  ...RETIRO,
  label: 'El Retiro',
  kind: 'Parque',
  detail: 'Área canina vallada.',
  icon,
  tone: 'place',
  radiusM: 250,
  heat: 3,
};

describe('cuándo se agrupa', () => {
  it('al 15 y al 17 cada cara va sola, y la lista es la misma referencia', () => {
    const markers = [
      face('a', 'Nala', 'El Retiro', RETIRO),
      face('b', 'Bruno', 'El Retiro', RETIRO),
    ];
    for (const zoom of [CLUSTER_BELOW_ZOOM, 17]) {
      expect(clusterMarkers(markers, zoom)).toBe(markers);
    }
  });

  it('al 13 dos caras del mismo sitio son una burbuja de dos', () => {
    const result = clusterMarkers(
      [face('a', 'Nala', 'El Retiro', RETIRO), face('b', 'Bruno', 'El Retiro', RETIRO)],
      13,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'cluster',
      tone: 'friend',
      label: '2 perros en El Retiro',
      placeName: 'El Retiro',
      clusterCount: 2,
      clusterIds: ['pet-a', 'pet-b'],
      lat: RETIRO.lat,
      lng: RETIRO.lng,
    });
    // La burbuja no es una cara: sin `petId`, el mapa no le busca retrato.
    expect(result[0]?.petId).toBeUndefined();
    // Y no lleva halo ni radio: los lleva el parque, y dos halos en el mismo
    // punto son una mancha.
    expect(result[0]?.heat).toBeUndefined();
    expect(result[0]?.radiusM).toBeUndefined();
  });

  it('una cara sola en su sitio sigue siendo una cara', () => {
    const only = face('a', 'Nala', 'El Retiro', RETIRO);
    expect(clusterMarkers([only], 13)).toEqual([only]);
  });
});

describe('qué se agrupa con qué', () => {
  it('dos sitios distintos no se funden aunque estén cerca', () => {
    const result = clusterMarkers(
      [
        face('a', 'Nala', 'El Retiro', RETIRO),
        face('b', 'Bruno', 'El Retiro', RETIRO),
        face('c', 'Kira', 'Arganzuela', ARGANZUELA),
        face('d', 'Toby', 'Arganzuela', ARGANZUELA),
      ],
      11,
    );
    expect(result.map((marker) => marker.label)).toEqual([
      '2 perros en El Retiro',
      '2 perros en Arganzuela',
    ]);
  });

  it('lo que no es una cara pasa intacto y en su orden', () => {
    const alert: MapMarker = {
      id: 'alert-1',
      ...ARGANZUELA,
      label: 'Cebos envenenados',
      kind: 'Alerta abierta',
      detail: 'Aviso de hoy.',
      icon,
      tone: 'alert',
      radiusM: 300,
    };
    const result = clusterMarkers(
      [
        park,
        face('a', 'Nala', 'El Retiro', RETIRO),
        alert,
        face('b', 'Bruno', 'El Retiro', RETIRO),
      ],
      13,
    );
    expect(result[0]).toBe(park);
    expect(result[1]?.kind).toBe('cluster');
    expect(result[2]).toBe(alert);
    expect(result).toHaveLength(3);
  });

  it('el parque conserva su halo aunque encima haya una burbuja', () => {
    // El halo mide el sitio; la burbuja cuenta perros. Son datos distintos y
    // se dibujan una sola vez cada uno.
    const result = clusterMarkers(
      [park, face('a', 'Nala', 'El Retiro', RETIRO), face('b', 'Bruno', 'El Retiro', RETIRO)],
      13,
    );
    expect(result.find((marker) => marker.id === 'place-retiro')?.heat).toBe(3);
  });
});

describe('identificadores', () => {
  it('el mismo sitio da siempre el mismo id, en cualquier orden', () => {
    const a = face('a', 'Nala', 'El Retiro', RETIRO);
    const b = face('b', 'Bruno', 'El Retiro', RETIRO);
    const first = clusterMarkers([a, b], 13)[0]?.id;
    const second = clusterMarkers([b, a], 13)[0]?.id;
    expect(first).toBe('cluster-40.415300,-3.684400');
    expect(second).toBe(first);
  });

  it('el ruido de coma flotante no parte un grupo', () => {
    const result = clusterMarkers(
      [
        face('a', 'Nala', 'El Retiro', RETIRO),
        face('b', 'Bruno', 'El Retiro', { lat: RETIRO.lat + 1e-9, lng: RETIRO.lng - 1e-9 }),
      ],
      13,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.clusterCount).toBe(2);
  });
});

describe('el nombre del sitio', () => {
  it('prefiere el explícito y, si no, lo saca de «Paseando en …»', () => {
    const guessed = face('a', 'Nala', 'El Retiro', RETIRO);
    expect(placeNameOf(guessed)).toBe('El Retiro');
    expect(placeNameOf({ ...guessed, placeName: 'Retiro' })).toBe('Retiro');
  });

  it('si el texto cambia, se degrada a la frase entera en vez de romperse', () => {
    const odd = { ...face('a', 'Nala', 'El Retiro', RETIRO), kind: 'En el Retiro' };
    expect(placeNameOf(odd)).toBe('En el Retiro');
  });
});
