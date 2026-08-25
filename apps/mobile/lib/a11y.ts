/**
 * Las preferencias del sistema que esta aplicación se estaba saltando.
 *
 * `lib/motion` ya leía «reducir movimiento». Faltaban las otras dos que sí
 * cambian cómo se ve una pantalla, y las dos son justo las que una tipografía
 * propia y un cristal desenfocado se saltan **por construcción**:
 *
 *  - **Texto en negrita.** Es un ajuste de accesibilidad de la plataforma, no
 *    un gusto. Las tipografías del sistema lo respetan solas; una tipografía
 *    cargada por fichero, no: se queda en el peso que pidió el programador y la
 *    preferencia no hace nada. La guía lo dice con todas las letras —«si usas
 *    una tipografía propia, asegúrate de que implementa los mismos
 *    comportamientos»—, así que aquí el cuerpo pasa a su variante negrita.
 *  - **Reducir transparencia.** Quien lo activa suele hacerlo porque el
 *    contenido moviéndose detrás de un panel translúcido le dificulta leer, o
 *    porque le marea. La barra de pestañas y las cabeceras de esta aplicación
 *    son de cristal; con esta preferencia puesta se vuelven opacas.
 *
 * Las dos se resuelven de forma asíncrona y avisan de los cambios en caliente:
 * alguien puede activarlas con la aplicación abierta, y en iOS es lo normal
 * —se cambian desde el centro de control de accesibilidad sin salir—.
 *
 * Ninguna existe en web ni en Android, así que allí la promesa se cae sola al
 * valor de siempre: `AccessibilityInfo` devuelve `false` y no hay evento.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Suscribirse a una preferencia de accesibilidad.
 *
 * Es el mismo baile tres veces —preguntar, escuchar, limpiar—, y escrito tres
 * veces es donde se olvida el `alive` y aparece el aviso de actualizar un
 * componente desmontado.
 */
function useSystemFlag(
  read: () => Promise<boolean>,
  event: 'boldTextChanged' | 'reduceTransparencyChanged',
): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;

    /*
     * Se pregunta con red debajo, y no por prudencia genérica.
     *
     * En react-native-web estos dos métodos **no existen**: `AccessibilityInfo`
     * está, pero sin `isBoldTextEnabled` ni `isReduceTransparencyEnabled`, que
     * son preferencias que el navegador no tiene forma de saber. Llamarlos a
     * pelo no devuelve una promesa rechazada: lanza `undefined is not a
     * function` en el propio render, y eso **tumba la aplicación entera** con
     * una pantalla en blanco. Pasó, y lo cazó la auditoría al no encontrar
     * nada dentro de la raíz.
     */
    read()
      .then((value) => {
        if (alive) setOn(value);
      })
      .catch(() => {
        /* Si no se puede preguntar, se deja como está: es el comportamiento de
           siempre y no hay nada mejor que suponer. */
      });

    let remove = () => {};
    try {
      remove = AccessibilityInfo.addEventListener(event, setOn).remove;
    } catch {
      /* Una plataforma que no tiene la preferencia tampoco avisa de que
         cambie. No es un fallo: es que no hay nada que escuchar. */
    }

    return () => {
      alive = false;
      remove();
    };
  }, [read, event]);

  return on;
}

/**
 * Los lectores, cada uno comprobando que el método existe.
 *
 * Se declaran fuera del componente para que su identidad no cambie entre
 * renders: son dependencia del efecto, y una función nueva en cada render
 * volvería a suscribirse sesenta veces por segundo.
 */
const readBoldText = async (): Promise<boolean> =>
  typeof AccessibilityInfo.isBoldTextEnabled === 'function'
    ? AccessibilityInfo.isBoldTextEnabled()
    : false;

const readReduceTransparency = async (): Promise<boolean> =>
  typeof AccessibilityInfo.isReduceTransparencyEnabled === 'function'
    ? AccessibilityInfo.isReduceTransparencyEnabled()
    : false;

/** «Texto en negrita» del sistema. Lo consume `lib/fonts`. */
export function useBoldText(): boolean {
  return useSystemFlag(readBoldText, 'boldTextChanged');
}

/** «Reducir transparencia» del sistema. Lo consume el cristal. */
export function useReduceTransparency(): boolean {
  return useSystemFlag(readReduceTransparency, 'reduceTransparencyChanged');
}
