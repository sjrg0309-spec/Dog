/**
 * Cerrar lo que está abierto encima, con el gesto de cada plataforma.
 *
 * Tres capas se abren sobre el mapa —el buscador, el aviso de peligro y la
 * lista de capas—, y hasta ahora **ninguna atendía el botón atrás de Android**.
 * En un teléfono Android eso no es un detalle: atrás es el gesto de «deshaz
 * esto» y lo hace todo el mundo sin pensar. Con el buscador abierto encima de
 * Explorar, atrás no cerraba el buscador: sacaba de la pestaña entera y dejaba
 * al usuario en el feed, con la búsqueda a medias y sin forma de volver a ella
 * salvo repetirla. Es de los fallos que no salen en ninguna captura, porque en
 * una captura la pantalla está bien.
 *
 * Google lo escribe como requisito y no como consejo —la navegación hacia atrás
 * predecible es parte de lo que se comprueba para publicar—, y Apple dice lo
 * mismo con otras palabras para su gesto de volver: **lo último que se abrió es
 * lo primero que se cierra**.
 *
 * Aquí eso se cumple solo, y conviene saber por qué: React Native llama a los
 * manejadores de atrás **del último registrado al primero**, y el primero que
 * devuelve `true` se queda con el evento. Como cada capa registra el suyo al
 * montarse, la que está encima es siempre la última registrada, así que atrás
 * la cierra a ella y no a la de debajo.
 *
 * **En web no hay botón atrás de hardware**, así que el equivalente es la tecla
 * Escape, que es lo que espera cualquiera que use un teclado y lo que pide el
 * patrón de diálogo de WAI-ARIA. Y en iOS no se registra nada: no existe tal
 * botón, y la salida es el gesto de deslizar o el aspa, que ya están.
 */

import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Mientras `active` sea cierto, atrás (Android) o Escape (web) llaman a
 * `onDismiss` en vez de salir de la pantalla.
 *
 * `onDismiss` tiene que ser estable —de un `useCallback` o de un `setState`
 * directo—, o el manejador se registra y se quita en cada render.
 */
export function useBackDismiss(active: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!active) return;

    if (Platform.OS === 'android') {
      /* `true` significa «ya me lo he quedado yo»: sin eso el evento sigue
         bajando y Android acaba cerrando la pestaña además de la capa. */
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        onDismiss();
        return true;
      });
      return () => subscription.remove();
    }

    if (Platform.OS === 'web') {
      /* No se toca `BackHandler` en web a propósito: react-native-web lo tiene
         puesto como un hueco que escribe un error en la consola en cuanto se
         usa, y la auditoría de este repositorio exige consola limpia. Un aviso
         de error por abrir un buscador sería ruido que enseña a ignorar la
         consola, que es lo peor que puede pasarle a una consola. */
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onDismiss();
      };
      /*
       * En captura, y esto no es opcional: **el buscador no se cerraba sin
       * ello**.
       *
       * El `TextInput` de react-native-web llama a `stopPropagation()` en
       * *todas* las pulsaciones —lo dice su propio comentario, «prevent key
       * events bubbling», y no distingue teclas—, y el buscador enfoca su campo
       * solo al abrirse. Así que Escape moría en el campo y no llegaba nunca a
       * `window`. En captura el evento pasa por aquí **antes** de bajar al
       * campo, así que ya no depende de que a nadie se le ocurra pararlo.
       *
       * Se vio en la auditoría del empaquetado, no leyendo esto: el gancho
       * estaba puesto, el estado era el correcto, y el buscador seguía abierto.
       */
      window.addEventListener('keydown', onKey, true);
      return () => window.removeEventListener('keydown', onKey, true);
    }

    return;
  }, [active, onDismiss]);
}
