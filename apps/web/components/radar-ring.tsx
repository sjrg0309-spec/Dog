/**
 * El anillo del radar: el elemento distintivo de DoggyMeet.
 *
 * Es a la vez la mecánica central del producto —quién está paseando cerca
 * ahora— y la marca. Es el único elemento con movimiento continuo de toda la
 * interfaz, y por eso el movimiento significa algo: si algo late, está pasando
 * ahora.
 *
 * Con `prefers-reduced-motion` el pulso no se elimina sin más: lo sustituye un
 * anillo doble estático que comunica lo mismo. Quitar el movimiento no debe
 * quitar el significado.
 */
export function RadarRing({ label }: { label: string }) {
  return (
    <svg className="radar" viewBox="0 0 200 200" role="img" aria-label={label}>
      <g transform="translate(100 100)">
        {/* Pulsos concéntricos, desfasados para que el anillo parezca continuo. */}
        <circle
          className="radar__pulse"
          r="88"
          fill="none"
          stroke="var(--dm-live-ring)"
          strokeWidth="2"
        />
        <circle
          className="radar__pulse radar__pulse--delayed"
          r="88"
          fill="none"
          stroke="var(--dm-live-ring)"
          strokeWidth="2"
        />
        <circle
          className="radar__pulse radar__pulse--more-delayed"
          r="88"
          fill="none"
          stroke="var(--dm-live-ring)"
          strokeWidth="2"
        />

        {/* Sustituto sin movimiento. */}
        <g className="radar__static">
          <circle r="88" fill="none" stroke="var(--dm-live-ring)" strokeWidth="2" opacity="0.35" />
          <circle r="60" fill="none" stroke="var(--dm-live-ring)" strokeWidth="4" opacity="0.6" />
        </g>

        {/* Núcleo: el parque donde estás. */}
        <circle r="34" fill="var(--dm-accent)" />
        <circle r="34" fill="none" stroke="var(--dm-primary)" strokeWidth="2.5" />

        {/* Otros perros dentro del radio. Su posición es fija y decorativa: no
            representa a nadie real, así que no se anuncia como dato. */}
        <circle cx="-62" cy="-28" r="7" fill="var(--dm-primary)" />
        <circle cx="58" cy="-46" r="7" fill="var(--dm-primary)" />
        <circle cx="46" cy="58" r="7" fill="var(--dm-primary)" />
        <circle cx="-40" cy="66" r="7" fill="var(--dm-live-ring)" />
      </g>
    </svg>
  );
}
