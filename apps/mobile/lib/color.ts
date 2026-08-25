/**
 * Colores, en un solo sitio.
 *
 * Vive aquí y no dentro de un componente porque hace falta en dos que no se
 * conocen: el cristal de la barra de pestañas y el velo de la portada. Estaba
 * escondido dentro del primero, y el segundo lo necesitaba idéntico —un velo
 * calculado de otra manera y un cristal calculado de esta se separan en cuanto
 * alguien toque uno de los dos—.
 */

/**
 * El mismo color, con transparencia.
 *
 * React Native no entiende `#rrggbbaa` en todas las plataformas, así que se
 * devuelve `rgba()`, que sí entienden todas. Acepta tanto `#abc` como
 * `#aabbcc`, que es lo que llega de los tokens según de dónde salga.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
