import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Aviso en línea.
 *
 * Los avisos de esta web eran un `<span aria-hidden>!</span>` metido a mano en
 * siete sitios. Funcionaba y era frágil por tres motivos: el signo se
 * desalineaba con la primera línea de texto, no había forma de distinguir un
 * aviso informativo de uno serio, y cada sitio lo escribía a su manera.
 *
 * El tono cambia el icono **y** el color del filo. Nunca solo el color: quien no
 * distinga el ámbar del azul tiene que poder ver que uno lleva un triángulo y el
 * otro una «i».
 */
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'critical';
}) {
  const Glyph = tone === 'critical' ? CircleAlert : tone === 'warning' ? TriangleAlert : Info;

  return (
    <div className="notice" data-tone={tone}>
      <Glyph className="notice__icon" size={18} strokeWidth={2} aria-hidden="true" />
      <div className="notice__body">{children}</div>
    </div>
  );
}
