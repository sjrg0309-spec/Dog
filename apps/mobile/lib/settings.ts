/**
 * Los ajustes que de verdad hacen algo.
 *
 * La regla de este módulo es la que decide si una pantalla de configuración
 * sirve o es decorado: **aquí solo entra lo que cambia el comportamiento de la
 * aplicación**. Un interruptor que no está conectado a nada es peor que no
 * tenerlo, porque alguien lo apaga y se queda tranquilo. Eso ya se razonó para
 * el modo fantasma —«un interruptor de privacidad que solo te esconde de tu
 * propia pantalla enseña a confiar en él»— y aquí vale igual para los cuatro.
 *
 * Lo que **no** vive aquí, a propósito:
 *
 *  - **El modo fantasma.** Es un ajuste de pleno derecho y sale en la pantalla,
 *    pero su estado sigue viviendo en `lib/presence`, que es quien lo apaga de
 *    verdad. Copiarlo aquí serían dos fuentes para el mismo interruptor, y de
 *    ahí a que la pantalla diga «apagado» mientras el radar publica presencia
 *    hay un despiste.
 *  - **El acento de color.** No es una preferencia: se deduce de qué mascota
 *    está activa. Ponerlo en ajustes lo convertiría en dos cosas que se
 *    contradicen.
 */

import { useSyncExternalStore } from 'react';

import { NEARBY_RADII_M, type NearbyRadius } from './posts';

/** Claro, oscuro, o lo que diga el teléfono. */
export type ThemeChoice = 'system' | 'light' | 'dark';

/** El movimiento se puede reducir desde aquí; nunca forzar. Ver `lib/motion`. */
export type MotionChoice = 'system' | 'reduced';

export type Settings = {
  theme: ThemeChoice;
  motion: MotionChoice;
  /**
   * Recibir los avisos de rescate con el alcance de quien se desplaza.
   *
   * No es «más notificaciones»: son dos usos distintos del mismo hecho. Un
   * tutor decide por dónde pasear —le sirve lo que tiene a mano—; una
   * rescatista coge el coche, así que se entera desde mucho más lejos y también
   * de lo que no es un peligro para su propio paseo, como un animal atado sin
   * agua en un patio ajeno. El catálogo lleva los dos radios desde el principio
   * (`alertReachM`); lo que faltaba era decir cuál eres.
   */
  rescuer: boolean;
  /** Cuánto barrio entra en el feed de vecindario. */
  feedRadiusM: NearbyRadius;
};

const DEFAULTS: Settings = {
  theme: 'system',
  motion: 'system',
  /* Apagado por defecto, y no por prudencia: encender esto a todo el mundo
     llenaría el teléfono de un tutor de avisos a cinco kilómetros, y un aviso
     que no te toca enseña a silenciar los que sí. */
  rescuer: false,
  feedRadiusM: NEARBY_RADII_M[0],
};

let settings: Settings = DEFAULTS;
const listeners = new Set<() => void>();

/**
 * Escuchar cambios.
 *
 * Se exporta —el resto de almacenes de la aplicación lo guardan para sí— porque
 * los tests de esta pantalla comprueban **cuándo no se avisa**, y eso no se
 * puede mirar desde fuera sin poder escuchar.
 */
export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = (): Settings => settings;

/** Leerlos fuera de un componente. Lo usan los tests y nadie más lo necesita. */
export function readSettings(): Settings {
  return settings;
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, snapshot, snapshot);
}

/**
 * Cambiar un ajuste.
 *
 * Se sale sin avisar si el valor ya era ese: sin eso, tocar el mismo botón dos
 * veces repinta la aplicación entera para dejarla igual.
 */
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  if (settings[key] === value) return;
  settings = { ...settings, [key]: value };
  for (const listener of listeners) listener();
}

/** Volver a lo de fábrica. Lo usan los tests para no heredarse entre sí. */
export function resetSettings(): void {
  settings = DEFAULTS;
  for (const listener of listeners) listener();
}

export const THEME_LABEL: Record<ThemeChoice, string> = {
  system: 'El del teléfono',
  light: 'Claro',
  dark: 'Oscuro',
};

/**
 * El índice de la pantalla de ajustes, como dato.
 *
 * Está aquí y no dentro de la pantalla por dos motivos, y el segundo es el que
 * importa:
 *
 *  1. El buscador necesita una lista sobre la que buscar, y buscar sobre
 *     componentes ya dibujados es rebuscar en el DOM.
 *  2. **Se puede comprobar.** Con esto escrito como dato, un test afirma que
 *     cada fila o cambia un ajuste de verdad, o lleva a una ruta que existe, o
 *     está declarada como «todavía no hay» con su motivo. Eso es lo único que
 *     impide que una pantalla de configuración se llene de interruptores
 *     bonitos: no la disciplina de quien la escriba, sino que la suite se ponga
 *     roja al añadir uno que no hace nada.
 */
export type SettingKind = 'switch' | 'choice' | 'link' | 'missing';

export type SettingRow = {
  id: string;
  label: string;
  hint: string;
  /**
   * Por lo que alguien lo buscaría y no está en el rótulo.
   *
   * «Vacunas» tiene que llevar a la ficha médica, y nadie escribe «ficha
   * médica» cuando lo que quiere ver es si toca la antirrábica.
   */
  keywords: readonly string[];
  kind: SettingKind;
  /** Solo en `link`: a dónde va. El test comprueba que la ruta existe. */
  href?: string;
  /** Solo en `missing`: por qué no está. Sin excusa no entra en la lista. */
  why?: string;
};

export type SettingGroup = {
  id: string;
  title: string;
  note?: string;
  rows: readonly SettingRow[];
};

export const SETTINGS: readonly SettingGroup[] = [
  {
    id: 'visibility',
    title: 'Quién te ve',
    rows: [
      {
        id: 'ghost',
        label: 'Modo fantasma',
        hint: 'Desapareces del mapa y el radar deja de ofrecerte salir',
        keywords: ['invisible', 'esconder', 'privacidad', 'mapa', 'ubicación'],
        kind: 'switch',
      },
      {
        id: 'rescuer',
        label: 'Soy rescatista',
        hint: 'Te llegan los avisos desde mucho más lejos, y también los que no son peligro para tu paseo',
        keywords: ['rescate', 'protectora', 'voluntaria', 'maltrato', 'avisos'],
        kind: 'switch',
      },
    ],
  },
  {
    id: 'display',
    title: 'Lo que ves',
    rows: [
      {
        id: 'feedRadius',
        label: 'Radio del vecindario',
        hint: 'Cuánto barrio entra en el feed cercano',
        keywords: ['distancia', 'kilómetros', 'feed', 'cerca'],
        kind: 'choice',
      },
      {
        id: 'theme',
        label: 'Tema',
        hint: 'Claro, oscuro, o el que tenga puesto el teléfono',
        keywords: ['oscuro', 'claro', 'noche', 'color', 'apariencia'],
        kind: 'choice',
      },
      {
        id: 'motion',
        label: 'Reducir movimiento',
        hint: 'El anillo del radar deja de pulsar y las entradas no se animan',
        keywords: ['animación', 'accesibilidad', 'mareo', 'pulso'],
        kind: 'choice',
      },
    ],
  },
  {
    id: 'private',
    title: 'Tuyo y privado',
    note: 'Nada de esto lo ve con quien quedes. Está aquí porque es donde se busca.',
    rows: [
      {
        id: 'walks',
        label: 'Historial de paseos',
        hint: 'El mes, el ritmo semanal y cada salida con su resumen',
        keywords: ['paseos', 'rutina', 'estadísticas', 'ritmo'],
        kind: 'link',
        href: '/historial',
      },
      {
        id: 'record',
        label: 'Ficha médica',
        hint: 'Vacunas, desparasitación y lo que está vencido',
        keywords: ['vacunas', 'antirrábica', 'veterinario', 'desparasitación', 'salud'],
        kind: 'link',
        href: '/perfil?tab=record',
      },
      {
        id: 'saved',
        label: 'Guardados',
        hint: 'Las publicaciones que has guardado. No lo ve nadie más',
        keywords: ['favoritos', 'marcadores', 'publicaciones'],
        kind: 'link',
        href: '/perfil?tab=saved',
      },
      {
        id: 'walkmode',
        label: 'Modo Paseo',
        hint: 'El código para quien encuentre a tu perro solo en la calle',
        keywords: ['qr', 'código', 'perdido', 'chip', 'emergencia', 'teléfono'],
        kind: 'link',
        href: '/perfil?modo=paseo',
      },
      {
        id: 'activity',
        label: 'Tu actividad',
        hint: 'Reacciones, avistamientos y recordatorios',
        keywords: ['notificaciones', 'novedades', 'avisos'],
        kind: 'link',
        href: '/actividad',
      },
    ],
  },
  {
    id: 'missing',
    title: 'Lo que todavía no hay',
    note: 'Se dice en vez de enseñar un interruptor apagado. Un ajuste que no hace nada es peor que no tenerlo: se apaga y se confía en él.',
    rows: [
      {
        id: 'account',
        label: 'Cuenta y contraseña',
        hint: 'Sin cuenta todavía',
        keywords: ['correo', 'contraseña', 'sesión', 'cerrar sesión', 'borrar cuenta'],
        kind: 'missing',
        why: 'Esta versión funciona con datos locales y no hay registro, así que no hay contraseña que cambiar ni sesión que cerrar.',
      },
      {
        id: 'push',
        label: 'Notificaciones del teléfono',
        hint: 'Los avisos se ven dentro de la aplicación',
        keywords: ['push', 'sonido', 'silenciar', 'alertas'],
        kind: 'missing',
        why: 'El reparto de avisos está construido y probado contra la base local, pero enviarlos al teléfono necesita credenciales de Expo que este entorno no tiene. Prefiero decirlo a poner un interruptor que no llega a ningún sitio.',
      },
      {
        id: 'blocks',
        label: 'Bloquear a alguien',
        hint: 'Hace falta cuenta',
        keywords: ['bloqueo', 'silenciar', 'denunciar', 'reportar'],
        kind: 'missing',
        why: 'Bloquear tiene sentido cuando hay cuentas de verdad detrás. Con datos de demostración sería un botón que no protege de nada.',
      },
      {
        id: 'export',
        label: 'Descargar tus datos',
        hint: 'Cuando haya servidor',
        keywords: ['exportar', 'datos', 'copia', 'rgpd'],
        kind: 'missing',
        why: 'Lo que hay ahora vive en el teléfono y se va al cerrar. Cuando los datos estén en el servidor, poder llevárselos es obligatorio, no una funcionalidad.',
      },
    ],
  },
];

/** Sin tildes y en minúsculas: quien busca «medica» quiere la ficha médica. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filtrar los ajustes por lo escrito, **conservando los grupos**.
 *
 * Devolver una lista plana sería más fácil y perdería lo único que da sentido a
 * un resultado: «Soy rescatista» debajo de «Quién te ve» se entiende, y suelta
 * en una lista parece otra casilla más.
 */
export function searchSettings(query: string): SettingGroup[] {
  const needle = fold(query.trim());
  if (needle === '') return [...SETTINGS];

  return SETTINGS.map((group) => ({
    ...group,
    rows: group.rows.filter((row) =>
      fold([row.label, row.hint, ...row.keywords].join(' ')).includes(needle),
    ),
  })).filter((group) => group.rows.length > 0);
}
