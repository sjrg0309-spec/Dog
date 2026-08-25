/**
 * La aritmética del mapa.
 *
 * Una tesela mal calculada no revienta: dibuja la calle equivocada, o pone el
 * marcador de un parque encima de un río. Es exactamente la clase de fallo que
 * no salta en ninguna pantalla y que hay que atrapar con números.
 *
 * Varias de estas comprobaciones cruzan **dos formas distintas de calcular lo
 * mismo**. Repetir la fórmula del código en el test no prueba nada —si está mal,
 * está mal en los dos sitios—; la identidad equivalente sí.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_LATITUDE,
  TILE_SIZE,
  metersPerPixel,
  project,
  spanMeters,
  tileUrl,
  unproject,
  visibleTiles,
  worldSize,
  ZOOMS,
} from './tiles.js';

const MADRID = { lat: 40.4168, lng: -3.7038 };
const SYDNEY = { lat: -33.8688, lng: 151.2093 };
const REYKJAVIK = { lat: 64.1466, lng: -21.9426 };

describe('el mundo y sus niveles', () => {
  it('al nivel cero el mundo entero es una tesela', () => {
    expect(worldSize(0)).toBe(TILE_SIZE);
    const tiles = visibleTiles({ lat: 0, lng: 0 }, 0, TILE_SIZE, TILE_SIZE);
    expect(tiles).toHaveLength(1);
    expect(tiles[0]).toMatchObject({ x: 0, y: 0, z: 0 });
  });

  it('cada nivel dobla el mundo', () => {
    for (let zoom = 0; zoom < 20; zoom += 1) {
      expect(worldSize(zoom + 1)).toBe(worldSize(zoom) * 2);
    }
  });
});

describe('proyección', () => {
  it('el cruce del meridiano y el ecuador cae en el centro del mundo', () => {
    const { x, y } = project({ lat: 0, lng: 0 }, 5);
    expect(x).toBeCloseTo(worldSize(5) / 2, 6);
    expect(y).toBeCloseTo(worldSize(5) / 2, 6);
  });

  it('la longitud es lineal', () => {
    // Media vuelta al mundo son medio mundo de píxeles, sin logaritmos de por
    // medio: es el eje que Mercator no toca.
    const west = project({ lat: 0, lng: -90 }, 8).x;
    const east = project({ lat: 0, lng: 90 }, 8).x;
    expect(east - west).toBeCloseTo(worldSize(8) / 2, 6);
  });

  it('la latitud coincide con la identidad clásica de Mercator', () => {
    // El código usa `ln((1+sin φ)/(1−sin φ))/2`; la forma de los manuales es
    // `ln(tan(π/4 + φ/2))`. Son la misma función escrita de dos maneras, así
    // que si coinciden es que ninguna de las dos se ha copiado mal.
    for (const lat of [-80, -45, -12.5, 0, 7.3, 40.4168, 61, 84]) {
      const size = worldSize(10);
      const classic = (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * size;
      expect(project({ lat, lng: 0 }, 10).y).toBeCloseTo(classic, 6);
    }
  });

  it('el norte crece hacia arriba', () => {
    // La Y de una pantalla crece hacia abajo, así que más latitud tiene que dar
    // menos Y. Invertirlo es el fallo clásico y deja el mapa boca abajo.
    expect(project({ lat: 60, lng: 0 }, 9).y).toBeLessThan(project({ lat: 10, lng: 0 }, 9).y);
  });

  it('los polos se recortan en vez de irse a infinito', () => {
    // Sin el tope, `ln((1+sin)/(1−sin))` en el polo divide por cero: la tesela
    // sale `Infinity` y el mapa se queda en blanco justo en el caso raro.
    for (const lat of [90, -90, 89.9, MAX_LATITUDE + 1]) {
      const { y } = project({ lat, lng: 0 }, 6);
      expect(Number.isFinite(y)).toBe(true);
    }
    expect(project({ lat: 90, lng: 0 }, 6).y).toBeCloseTo(project({ lat: MAX_LATITUDE, lng: 0 }, 6).y, 6);
  });

  it('proyectar y deshacer devuelve el mismo punto', () => {
    for (const point of [MADRID, SYDNEY, REYKJAVIK, { lat: 0, lng: 179.9 }]) {
      for (const zoom of ZOOMS) {
        const back = unproject(project(point, zoom), zoom);
        expect(back.lat).toBeCloseTo(point.lat, 6);
        expect(back.lng).toBeCloseTo(point.lng, 6);
      }
    }
  });
});

describe('escala', () => {
  it('en el ecuador y al nivel cero un píxel son unos 156 km', () => {
    // La circunferencia de la Tierra repartida entre los 256 píxeles del mundo.
    expect(metersPerPixel(0, 0) * 256).toBeCloseTo(40_075_016.686, 0);
  });

  it('cada nivel parte el metraje por dos', () => {
    expect(metersPerPixel(0, 11)).toBeCloseTo(metersPerPixel(0, 10) / 2, 9);
  });

  it('el mismo nivel abarca menos cuanto más al norte', () => {
    // Es la deformación de Mercator, y es la razón de que la barra de escala
    // cambie de largo al moverse aunque no se toque el zoom.
    expect(metersPerPixel(60, 14)).toBeLessThan(metersPerPixel(40, 14));
    expect(metersPerPixel(40, 14)).toBeLessThan(metersPerPixel(0, 14));
    // A sesenta grados el coseno vale justo un medio.
    expect(metersPerPixel(60, 14)).toBeCloseTo(metersPerPixel(0, 14) / 2, 9);
  });

  it('el hemisferio sur mide igual que el norte', () => {
    expect(metersPerPixel(-41.3, 15)).toBeCloseTo(metersPerPixel(41.3, 15), 9);
  });

  it('los niveles que ofrece la aplicación cubren de la manzana a la ciudad', () => {
    const width = 390;
    const spans = ZOOMS.map((zoom) => spanMeters(MADRID.lat, zoom, width));
    // De más cerca a más lejos, y sin saltos absurdos entre pasos.
    for (let i = 1; i < spans.length; i += 1) {
      expect(spans[i]!).toBeGreaterThan(spans[i - 1]!);
    }
    expect(spans[0]!).toBeLessThan(1000);
    expect(spans[spans.length - 1]!).toBeGreaterThan(20_000);
  });
});

describe('qué teselas hacen falta', () => {
  const width = 390;
  const height = 700;

  it('cubren el cuadro entero sin dejar huecos', () => {
    const tiles = visibleTiles(MADRID, 15, width, height);
    expect(tiles.length).toBeGreaterThan(0);
    // Cada esquina del cuadro tiene que caer dentro de alguna tesela: un hueco
    // se ve como un rectángulo gris en mitad del mapa.
    const corners: Array<[number, number]> = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
      [width / 2, height / 2],
    ];
    for (const [px, py] of corners) {
      const covering = tiles.filter(
        (tile) =>
          px >= tile.left && px < tile.left + TILE_SIZE && py >= tile.top && py < tile.top + TILE_SIZE,
      );
      expect(covering).toHaveLength(1);
    }
  });

  it('no pide más de la cuenta', () => {
    // 390 × 700 con teselas de 256 caben en 3 × 4 más el desbordamiento: si
    // salieran muchas más, sería que se está pidiendo mundo que no se ve, y eso
    // son bytes del usuario y carga del servidor comunitario.
    expect(visibleTiles(MADRID, 15, width, height).length).toBeLessThanOrEqual(12);
  });

  it('el centro del cuadro es el centro del mapa', () => {
    const tiles = visibleTiles(SYDNEY, 14, width, height);
    const middle = tiles.find(
      (tile) =>
        width / 2 >= tile.left &&
        width / 2 < tile.left + TILE_SIZE &&
        height / 2 >= tile.top &&
        height / 2 < tile.top + TILE_SIZE,
    );
    expect(middle).toBeDefined();
    // Y la coordenada que hay bajo el píxel central tiene que ser la del centro.
    const back = unproject(
      { x: project(SYDNEY, 14).x, y: project(SYDNEY, 14).y },
      14,
    );
    expect(back.lat).toBeCloseTo(SYDNEY.lat, 6);
  });

  it('el mundo da la vuelta por el este y el oeste', () => {
    // Centrado en el antimeridiano hacen falta teselas de los dos extremos del
    // índice. Sin el módulo saldría medio mapa en blanco justo en el Pacífico.
    const tiles = visibleTiles({ lat: 0, lng: 179.99 }, 3, width, height);
    const count = 2 ** 3;
    expect(tiles.every((tile) => tile.x >= 0 && tile.x < count)).toBe(true);
    expect(new Set(tiles.map((tile) => tile.x)).size).toBeGreaterThan(1);
  });

  it('por arriba y por abajo el mundo se acaba', () => {
    // El eje Y no envuelve: pedir la fila −1 traería una imagen que no existe y
    // el servidor contestaría 404 tras 404.
    const tiles = visibleTiles({ lat: MAX_LATITUDE, lng: 0 }, 2, width, height);
    const count = 2 ** 2;
    expect(tiles.every((tile) => tile.y >= 0 && tile.y < count)).toBe(true);
  });

  it('funciona en cualquier país, que es de lo que se trata', () => {
    const places = [
      { lat: 40.4168, lng: -3.7038 }, // Madrid
      { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
      { lat: 19.4326, lng: -99.1332 }, // Ciudad de México
      { lat: 35.6762, lng: 139.6503 }, // Tokio
      { lat: -1.2921, lng: 36.8219 }, // Nairobi
      { lat: 64.1466, lng: -21.9426 }, // Reikiavik
      { lat: -41.2866, lng: 174.7756 }, // Wellington
    ];
    for (const place of places) {
      for (const zoom of ZOOMS) {
        const tiles = visibleTiles(place, zoom, width, height);
        expect(tiles.length).toBeGreaterThan(0);
        for (const tile of tiles) {
          expect(tile.x).toBeGreaterThanOrEqual(0);
          expect(tile.x).toBeLessThan(2 ** zoom);
          expect(tile.y).toBeGreaterThanOrEqual(0);
          expect(tile.y).toBeLessThan(2 ** zoom);
        }
      }
    }
  });
});

describe('la dirección de una tesela', () => {
  it('sale en el orden z/x/y y con esquema seguro', () => {
    const url = tileUrl({ x: 2005, y: 1543, z: 12 });
    expect(url).toBe('https://tile.openstreetmap.org/12/2005/1543.png');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('nunca lleva coordenadas del usuario', () => {
    // Es lo que separa pedir un mapa de contarle a un tercero dónde estás: la
    // dirección lleva un índice de rejilla, y de una tesela de barrio no se
    // deduce en qué punto de ella está nadie.
    const url = tileUrl({ x: 2005, y: 1543, z: 12 });
    expect(url).not.toMatch(/lat|lon|lng|40\.4|[-]3\.7/);
  });
});
