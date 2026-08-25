/**
 * La escena generada, dibujada con react-native-svg.
 *
 * Recorre las primitivas que produce `lib/artwork` y las pinta. Los dos
 * renderizadores —este y el SVG plano de la vista previa— comparten el
 * generador a propósito: si cada uno construyera su propia escena, lo que se
 * revisa en el navegador dejaría de ser lo que se ve en el teléfono.
 *
 * La ilustración **no sustituye al texto alternativo**. Sigue siendo obligatorio
 * y sigue describiendo lo que el tutor dice que hay en la imagen, que no es lo
 * mismo que lo que este generador ha dibujado.
 */

import React from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import type { Scene } from '@/lib/artwork';

export function SceneView({
  scene,
  width,
  height,
}: {
  scene: Scene;
  /** Tamaño en pantalla. La escena se escala; no se recorta. */
  width: number;
  height: number;
}) {
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      // Sin `accessible={false}`: react-native-svg lo reenvía tal cual al DOM y
      // `accessible="false"` no es un atributo booleano de HTML, así que React
      // avisaba por consola en cada escena. Lo que hace falta —que el dibujo no
      // se anuncie por su cuenta— ya lo consigue el `View` que lo envuelve, que
      // es quien lleva el texto alternativo de la publicación.
      pointerEvents="none"
    >
      {scene.items.map((item, index) => {
        const key = `${scene.uid}-${index}`;

        if (item.kind === 'vignette') {
          /*
           * Los bordes caen y el centro se queda.
           *
           * Un degradado radial de negro transparente en el centro a negro con
           * opacidad en las esquinas. Es la diferencia entre una ilustración de
           * luz plana —que ninguna cámara produce— y algo que se lee como una
           * foto. Va la última de la lista, así que oscurece todo lo de debajo.
           *
           * El radio es 0,72 y no 0,5: con medio ancho el oscurecimiento
           * empieza en el centro mismo y la escena se ensucia entera.
           */
          const id = `v-${key}`;
          return (
            <React.Fragment key={key}>
              <Defs>
                <RadialGradient id={id} cx="50%" cy="46%" r="72%">
                  <Stop offset="0.45" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="1" stopColor="#000000" stopOpacity={item.strength} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={scene.width} height={scene.height} fill={`url(#${id})`} />
            </React.Fragment>
          );
        }

        if (item.kind === 'gradientRect') {
          const id = `g-${key}`;
          return (
            <React.Fragment key={key}>
              <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={item.from} stopOpacity={item.fromOpacity ?? 1} />
                  <Stop offset="1" stopColor={item.to} stopOpacity={item.toOpacity ?? 1} />
                </LinearGradient>
              </Defs>
              <Rect x={item.x} y={item.y} width={item.w} height={item.h} fill={`url(#${id})`} />
            </React.Fragment>
          );
        }

        if (item.kind === 'rect') {
          return (
            <Rect
              key={key}
              x={item.x}
              y={item.y}
              width={item.w}
              height={item.h}
              rx={item.r ?? 0}
              fill={item.fill}
              opacity={item.opacity ?? 1}
            />
          );
        }

        if (item.kind === 'ellipse') {
          return (
            <Ellipse
              key={key}
              cx={item.cx}
              cy={item.cy}
              rx={item.rx}
              ry={item.ry}
              fill={item.fill}
              opacity={item.opacity ?? 1}
            />
          );
        }

        return (
          <Path
            key={key}
            d={item.d}
            fill={item.fill ?? 'none'}
            stroke={item.stroke ?? 'none'}
            strokeWidth={item.width ?? 1}
            strokeLinecap="round"
            opacity={item.opacity ?? 1}
          />
        );
      })}
    </Svg>
  );
}
