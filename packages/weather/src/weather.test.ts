/**
 * Tests de la capa meteorológica.
 *
 * El adaptador no se ha podido ejecutar contra Open-Meteo desde el contenedor
 * de construcción —el proxy de salida bloquea su dominio—, así que estos tests
 * son la verificación que sí existe. Las respuestas de muestra están calcadas de
 * la especificación OpenAPI del propio servicio, y la mitad de los casos son
 * respuestas rotas, que es lo que de verdad hay que probar: lo que hace la
 * aplicación cuando el dato no viene bien.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  FRESH_MS,
  GRID_DECIMALS,
  GROUND_BURN_C,
  RETRY_AFTER_MS,
  buildUrl,
  cellKey,
  coarsen,
  createOpenMeteoProvider,
  describeSky,
  estimateGroundC,
  isThunderstorm,
  judgeGround,
  parseResponse,
  radiationAt,
  withCache,
} from './index.js';
import type { WeatherProvider, WeatherResult } from './index.js';

const MADRID = { lat: 40.409812, lng: -3.693911 };

/** Una respuesta con la forma exacta que declara `openapi/forecast.yml`. */
const response = (overrides: Record<string, unknown> = {}) => ({
  latitude: 40.41,
  longitude: -3.69,
  generationtime_ms: 0.045,
  utc_offset_seconds: 7200,
  timezone: 'Europe/Madrid',
  timezone_abbreviation: 'CEST',
  elevation: 665,
  current_units: {
    time: 'iso8601',
    interval: 'seconds',
    temperature_2m: '°C',
    apparent_temperature: '°C',
    relative_humidity_2m: '%',
    is_day: '',
    weather_code: 'wmo code',
    wind_speed_10m: 'km/h',
  },
  current: {
    time: '2026-08-23T14:00',
    interval: 900,
    temperature_2m: 31.4,
    apparent_temperature: 33.8,
    relative_humidity_2m: 28,
    is_day: 1,
    weather_code: 0,
    wind_speed_10m: 9.2,
  },
  hourly_units: { time: 'iso8601', shortwave_radiation: 'W/m²' },
  hourly: {
    time: ['2026-08-23T12:00', '2026-08-23T13:00', '2026-08-23T14:00', '2026-08-23T15:00'],
    shortwave_radiation: [780, 860, 910, 840],
  },
  ...overrides,
});

describe('privacidad de la coordenada', () => {
  it('redondea a la celda de la rejilla antes de enviarla', () => {
    expect(coarsen(MADRID)).toEqual({ lat: 40.41, lng: -3.69 });
  });

  it('no manda más decimales de los que el modelo puede usar', () => {
    const url = new URL(buildUrl(MADRID));
    for (const key of ['latitude', 'longitude']) {
      const value = url.searchParams.get(key) ?? '';
      const decimals = value.split('.')[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(GRID_DECIMALS);
    }
  });

  it('no arrastra la posición exacta a ningún sitio de la URL', () => {
    /* La comprobación de arriba mira dos parámetros; esta mira la cadena
       entera, que es donde se colaría si alguien añadiera otro parámetro. */
    expect(buildUrl(MADRID)).not.toContain('40.4098');
    expect(buildUrl(MADRID)).not.toContain('3.6939');
  });

  it('no confunde hemisferios al redondear el empate', () => {
    expect(coarsen({ lat: 0.005, lng: -0.005 })).toEqual({ lat: 0.01, lng: -0.01 });
    expect(cellKey({ lat: 3.5, lng: 3.5 })).not.toBe(cellKey({ lat: -3.5, lng: -3.5 }));
  });

  it('da la misma celda a dos puntos del mismo parque', () => {
    expect(cellKey({ lat: 40.4098, lng: -3.6939 })).toBe(cellKey({ lat: 40.4103, lng: -3.6942 }));
  });
});

describe('lectura de la respuesta', () => {
  it('extrae la observación de una respuesta buena', () => {
    const result = parseResponse(response(), MADRID);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.observation.temperatureC).toBe(31.4);
    expect(result.observation.apparentTemperatureC).toBe(33.8);
    expect(result.observation.isDay).toBe(true);
    expect(result.observation.provider).toBe('open-meteo');
  });

  it('toma la radiación de la hora en curso, no la primera de la serie', () => {
    const result = parseResponse(response(), MADRID);
    if (result.status !== 'ok') throw new Error('debería haber leído la respuesta');
    expect(result.observation.solarRadiation).toBe(910);
  });

  it('deja la radiación en null si esa hora no está en la serie', () => {
    const body = response({
      hourly: { time: ['2026-08-23T20:00'], shortwave_radiation: [0] },
    });
    const result = parseResponse(body, MADRID);
    if (result.status !== 'ok') throw new Error('debería haber leído la respuesta');
    expect(result.observation.solarRadiation).toBeNull();
  });

  it('convierte is_day=0 en falso y no en «hay un valor, luego sí»', () => {
    const body = response();
    (body.current as Record<string, unknown>)['is_day'] = 0;
    const result = parseResponse(body, MADRID);
    if (result.status !== 'ok') throw new Error('debería haber leído la respuesta');
    expect(result.observation.isDay).toBe(false);
  });

  it('guarda la celda consultada y no la posición recibida', () => {
    const result = parseResponse(response(), MADRID);
    if (result.status !== 'ok') throw new Error('debería haber leído la respuesta');
    expect(result.observation.queriedFor).toEqual({ lat: 40.41, lng: -3.69 });
  });
});

describe('buscar la hora en curso dentro de la serie', () => {
  /**
   * Se compara por prefijo de hora y no convirtiendo a `Date`. Las marcas
   * vienen sin zona —`2026-08-23T14:00`— así que un `new Date()` las
   * interpretaría como locales del dispositivo, que puede estar en otro huso
   * que el sitio consultado. En verano en España eso son dos horas de error,
   * suficiente para coger la radiación de media tarde a media mañana.
   */
  const times = ['2026-08-23T13:00', '2026-08-23T14:00', '2026-08-23T15:00'];

  it('coge el valor de su hora aunque los minutos no cuadren', () => {
    expect(radiationAt('2026-08-23T14:37', times, [1, 2, 3])).toBe(2);
  });

  it('devuelve null si esa hora no está', () => {
    expect(radiationAt('2026-08-24T14:00', times, [1, 2, 3])).toBeNull();
  });

  it('devuelve null si la serie no es una lista', () => {
    expect(radiationAt('2026-08-23T14:00', null, [1, 2, 3])).toBeNull();
    expect(radiationAt('2026-08-23T14:00', times, 'muchos')).toBeNull();
  });

  it('devuelve null si el valor de esa hora no es un número', () => {
    expect(radiationAt('2026-08-23T14:00', times, [1, null, 3])).toBeNull();
  });
});

describe('respuestas que no sirven', () => {
  /**
   * El caso que justifica validar campo a campo.
   *
   * Si una temperatura ausente se colara como `undefined`, saldría por el otro
   * lado como `NaN`, y `NaN > techo` es falso: la aplicación diría que hace
   * buen tiempo. Un dato roto tiene que parecerse a no tener dato.
   */
  it('una temperatura ausente no se lee como buen tiempo', () => {
    const body = response();
    delete (body.current as Record<string, unknown>)['temperature_2m'];
    const result = parseResponse(body, MADRID);
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.failure).toBe('malformed');
  });

  it.each([
    ['nula', null],
    ['una cadena', 'hace calor'],
    ['un número', 31.4],
    ['un array', []],
  ])('rechaza una respuesta que es %s', (_name, body) => {
    expect(parseResponse(body, MADRID).status).toBe('unavailable');
  });

  it('rechaza una temperatura que no es número', () => {
    const body = response();
    (body.current as Record<string, unknown>)['temperature_2m'] = '31.4';
    expect(parseResponse(body, MADRID).status).toBe('unavailable');
  });

  it('rechaza una hora ilegible en vez de fechar la medida en 1970', () => {
    const body = response();
    (body.current as Record<string, unknown>)['time'] = 'ayer por la tarde';
    const result = parseResponse(body, MADRID);
    expect(result.status).toBe('unavailable');
  });

  it('reconoce el error que devuelve el propio servicio', () => {
    const result = parseResponse(
      { error: true, reason: 'Latitude must be in range of -90 to 90°' },
      MADRID,
    );
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.failure).toBe('rejected');
    expect(result.detail).toContain('Latitude');
  });

  it('sobrevive a que falte la sensación térmica usando la del aire', () => {
    const body = response();
    delete (body.current as Record<string, unknown>)['apparent_temperature'];
    const result = parseResponse(body, MADRID);
    if (result.status !== 'ok') throw new Error('no debería descartarse por esto');
    expect(result.observation.apparentTemperatureC).toBe(31.4);
  });
});

describe('el proveedor sobre la red', () => {
  const ok = () =>
    Promise.resolve(new Response(JSON.stringify(response()), { status: 200 }));

  it('devuelve la observación cuando la llamada sale bien', async () => {
    const provider = createOpenMeteoProvider(ok as unknown as typeof fetch);
    const result = await provider.read(MADRID);
    expect(result.status).toBe('ok');
  });

  it('traduce un 429 a rechazo y no a fallo de red', async () => {
    const provider = createOpenMeteoProvider((() =>
      Promise.resolve(new Response('', { status: 429 }))) as unknown as typeof fetch);
    const result = await provider.read(MADRID);
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.failure).toBe('rejected');
    expect(result.detail).toContain('429');
  });

  it('traduce un corte de red a offline', async () => {
    const provider = createOpenMeteoProvider((() =>
      Promise.reject(new Error('Failed to fetch'))) as unknown as typeof fetch);
    const result = await provider.read(MADRID);
    if (result.status !== 'unavailable') throw new Error('debería fallar');
    expect(result.failure).toBe('offline');
  });

  it('traduce un cuerpo que no es JSON a malformado', async () => {
    const provider = createOpenMeteoProvider((() =>
      Promise.resolve(new Response('<html>502</html>', { status: 200 }))) as unknown as typeof fetch);
    const result = await provider.read(MADRID);
    if (result.status !== 'unavailable') throw new Error('debería fallar');
    expect(result.failure).toBe('malformed');
  });

  it('nunca lanza: siempre devuelve un resultado que la pantalla puede pintar', async () => {
    const provider = createOpenMeteoProvider((() => {
      throw new Error('algo muy raro');
    }) as unknown as typeof fetch);
    await expect(provider.read(MADRID)).resolves.toHaveProperty('status', 'unavailable');
  });
});

describe('caché', () => {
  const stub = (results: WeatherResult[]): { provider: WeatherProvider; calls: () => number } => {
    let calls = 0;
    return {
      calls: () => calls,
      provider: {
        id: 'stub',
        attribution: '',
        read: async () => {
          const result = results[Math.min(calls, results.length - 1)];
          calls += 1;
          return result as WeatherResult;
        },
      },
    };
  };

  const good: WeatherResult = {
    status: 'ok',
    observation: {
      temperatureC: 20,
      apparentTemperatureC: 20,
      humidityPct: 50,
      windSpeedKmh: 5,
      isDay: true,
      solarRadiation: 400,
      weatherCode: 0,
      observedAt: new Date('2026-08-23T14:00:00Z'),
      queriedFor: { lat: 40.41, lng: -3.69 },
      provider: 'stub',
    },
  };

  it('no vuelve a preguntar dentro de la ventana de frescura', async () => {
    const { provider, calls } = stub([good]);
    const cached = withCache(provider, () => 1000);
    await cached.read(MADRID);
    await cached.read(MADRID);
    await cached.read({ lat: 40.4103, lng: -3.6942 });
    expect(calls()).toBe(1);
  });

  it('vuelve a preguntar cuando el dato caduca', async () => {
    const { provider, calls } = stub([good]);
    let now = 0;
    const cached = withCache(provider, () => now);
    await cached.read(MADRID);
    now += FRESH_MS + 1;
    await cached.read(MADRID);
    expect(calls()).toBe(2);
  });

  it('reintenta un fallo mucho antes que un acierto', async () => {
    const bad: WeatherResult = { status: 'unavailable', failure: 'offline', detail: '' };
    const { provider, calls } = stub([bad, good]);
    let now = 0;
    const cached = withCache(provider, () => now);
    await cached.read(MADRID);
    now += RETRY_AFTER_MS + 1;
    await cached.read(MADRID);
    expect(calls()).toBe(2);
  });

  it('dos pantallas a la vez producen una sola petición', async () => {
    let calls = 0;
    const slow: WeatherProvider = {
      id: 'slow',
      attribution: '',
      read: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return good;
      },
    };
    const cached = withCache(slow, () => 0);
    await Promise.all([cached.read(MADRID), cached.read(MADRID), cached.read(MADRID)]);
    expect(calls).toBe(1);
  });

  it('celdas distintas no se pisan la caché', async () => {
    const { provider, calls } = stub([good]);
    const cached = withCache(provider, () => 0);
    await cached.read(MADRID);
    await cached.read({ lat: 41.38, lng: 2.17 });
    expect(calls()).toBe(2);
  });

  it('peek no dispara ninguna consulta', async () => {
    const { provider, calls } = stub([good]);
    const cached = withCache(provider, () => 0);
    expect(cached.peek(MADRID)).toBeNull();
    expect(calls()).toBe(0);
    await cached.read(MADRID);
    expect(cached.peek(MADRID)).not.toBeNull();
  });
});

describe('temperatura del suelo', () => {
  it('a pleno sol el asfalto se pone muy por encima del aire', () => {
    /* El par que citan las tablas de quemaduras: ~25 °C de aire con el asfalto
       cerca de 52. Con 1000 W/m² el modelo tiene que caer en ese entorno. */
    const ground = estimateGroundC(25, 1000, 'asphalt');
    expect(ground).not.toBeNull();
    expect(ground as number).toBeGreaterThan(50);
    expect(ground as number).toBeLessThan(56);
  });

  it('la hierba se queda cerca del aire con la misma radiación', () => {
    const asphalt = estimateGroundC(25, 1000, 'asphalt') as number;
    const grass = estimateGroundC(25, 1000, 'grass') as number;
    expect(grass).toBeLessThan(asphalt - 15);
  });

  it('sin sol el asfalto no quema aunque el aire esté caliente', () => {
    expect(judgeGround(estimateGroundC(29, 0, 'asphalt'))).toBe('safe');
  });

  it('con sol fuerte quema aunque el aire no llegue al umbral viejo de 28', () => {
    /* Este es el caso que la regla anterior dejaba pasar: 24 °C de aire con el
       sol de agosto a mediodía. El umbral del aire decía que no pasaba nada. */
    expect(judgeGround(estimateGroundC(24, 950, 'asphalt'))).toBe('burns');
  });

  it('bajo techo la radiación no calienta nada', () => {
    expect(estimateGroundC(30, 900, 'indoor')).toBe(30);
  });

  it('sin radiación medida dice que no sabe, no que está bien', () => {
    expect(estimateGroundC(30, null, 'asphalt')).toBeNull();
    expect(judgeGround(null)).toBeNull();
  });

  it('el umbral de quemadura queda por debajo del daño documentado', () => {
    /* El daño se cita cerca de 52 °C. Si el umbral subiera hasta ahí, el margen
       de error de la estimación se comería la protección entera. */
    expect(GROUND_BURN_C).toBeLessThan(52);
  });
});

describe('estado del cielo', () => {
  it('traduce los códigos que usan los modelos', () => {
    expect(describeSky(0).label).toBe('Despejado');
    expect(describeSky(95).category).toBe('storm');
  });

  it('un código desconocido no rompe la pantalla', () => {
    for (let code = 0; code <= 100; code += 1) {
      const sky = describeSky(code);
      expect(typeof sky.label).toBe('string');
      expect(sky.label.length).toBeGreaterThan(0);
    }
  });

  it('distingue la tormenta de la lluvia, que es lo que asusta al perro', () => {
    expect(isThunderstorm(95)).toBe(true);
    expect(isThunderstorm(63)).toBe(false);
  });
});

describe('cancelación', () => {
  it('abandona la petición si quien la pidió se va', async () => {
    const controller = new AbortController();
    const provider = createOpenMeteoProvider(((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
      })) as unknown as typeof fetch);

    const pending = provider.read(MADRID, controller.signal);
    controller.abort();
    const result = await pending;
    expect(result.status).toBe('unavailable');
  });

  it('no deja temporizadores colgando tras responder', async () => {
    vi.useFakeTimers();
    const provider = createOpenMeteoProvider((() =>
      Promise.resolve(new Response(JSON.stringify(response()), { status: 200 }))) as unknown as typeof fetch);
    await provider.read(MADRID);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

describe('paridad con el catálogo de bienestar', () => {
  /**
   * El umbral vive en dos sitios porque los dos lo necesitan: aquí para estimar
   * y en `@coincide/core` para decidir. Que se separen no rompe ningún test de
   * los otros —cada paquete seguiría coherente consigo mismo— y sin embargo la
   * aplicación diría «el suelo quema» en una pantalla y ofrecería la quedada en
   * la siguiente. Es justo la clase de fallo que no se ve hasta que se ve.
   */
  it('el umbral de quemadura es el mismo en las dos capas', async () => {
    const core = await import('@coincide/core');
    expect(GROUND_BURN_C).toBe(core.GROUND_BURN_C);
  });
});
