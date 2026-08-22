import { RadarRing } from '@/components/radar-ring';
import { activeSpots, allPlaces, upcomingPlaydates } from '@/lib/db';
import { ENERGY_LABEL, SIZE_LABEL, formatPrice, formatRelative, formatWhen } from '@/lib/format';

// Los datos cambian con cada check-in, así que no tiene sentido servir una
// versión estática de esta página.
export const dynamic = 'force-dynamic';

const ENGINES = [
  {
    eyebrow: 'Ahora mismo',
    title: 'Radar en vivo',
    body: '“Estoy en el Parque Central hasta las 19:00.” Quien tenga un perro compatible a dos kilómetros lo ve. El check-in caduca solo, así que nadie se queda visible en el mapa por olvidarse de apagarlo.',
  },
  {
    eyebrow: 'A cualquier hora',
    title: 'Coincidencia de horarios',
    body: 'Dices cuándo sacas al perro y con quién coincides aparece solo, sin que ninguno de los dos tenga que estar conectado. Es lo que hace que esto sirva a las once de la noche, que es cuando más solo se pasea.',
  },
  {
    eyebrow: 'Cuando toca organizar',
    title: 'Quedadas y espacios',
    body: 'Paseos en manada con parámetros de admisión, y patios privados que se alquilan entre varios. Antes de unirte ves la afinidad del grupo por su pareja más débil, no por el promedio.',
  },
];

export default async function HomePage() {
  const [playdates, spots, places] = await Promise.all([
    upcomingPlaydates(3),
    activeSpots(2),
    allPlaces(),
  ]);

  const fencedParks = places.filter((place) => place.is_fenced).length;

  return (
    <div className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Red social de paseos caninos</p>
          <h1 className="hero__title">
            Que tu perro salga <em>con alguien</em>.
          </h1>
          <p className="lede">
            DoggyMeet empareja perros por energía, tamaño y forma de jugar, y cruza vuestros
            horarios de paseo. No hace falta que nadie esté conectado a la vez: basta con que
            salgáis a la misma hora.
          </p>

          <div className="row" style={{ marginTop: 'var(--dm-space-6)' }}>
            <a className="button button--primary" href="#quedadas">
              Ver quedadas cerca
            </a>
            <a className="button button--outline" href="#como-funciona">
              Cómo funciona
            </a>
          </div>

          <p
            className="card__meta"
            style={{ marginTop: 'var(--dm-space-5)', maxWidth: 'var(--dm-measure-narrow)' }}
          >
            {places.length} parques en el directorio, {fencedParks} de ellos vallados.{' '}
            {playdates.length > 0
              ? `Próxima quedada ${formatRelative(new Date(playdates[0]!.starts_at))}.`
              : 'Aún no hay quedadas programadas.'}
          </p>
        </div>

        <RadarRing label="Anillo de radar: perros compatibles paseando cerca ahora mismo" />
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="como-funciona">
        <div className="section__head">
          <p className="eyebrow">Tres motores de encuentro</p>
          <h2>Uno para cada momento del día</h2>
          <p className="lede">
            Un radar sin gente es una pantalla vacía. Por eso el motor central no es quién está
            fuera ahora, sino con quién coincides siempre.
          </p>
        </div>

        <div className="grid">
          {ENGINES.map((engine) => (
            <article className="card card--feature" key={engine.title}>
              <p className="eyebrow">{engine.eyebrow}</p>
              <h3 className="card__title">{engine.title}</h3>
              <p className="card__meta">{engine.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="quedadas">
        <div className="section__head">
          <p className="eyebrow">Próximas quedadas</p>
          <h2>Paseos abiertos cerca de ti</h2>
        </div>

        {playdates.length === 0 ? (
          <div className="notice">
            <span aria-hidden="true">○</span>
            <p>
              <strong>Todavía no hay ninguna quedada.</strong> Es el estado normal al empezar en un
              barrio: la primera la organiza alguien, y a partir de ahí el horario hace el resto.
            </p>
          </div>
        ) : (
          <div className="grid">
            {playdates.map((playdate) => (
              <a className="card" key={playdate.id} href={`/quedada/${playdate.public_slug}`}>
                <div className="row">
                  <span className="badge badge--accent">
                    {formatRelative(new Date(playdate.starts_at))}
                  </span>
                  {playdate.leashed ? <span className="badge">Con correa</span> : null}
                </div>
                <h3 className="card__title">{playdate.title}</h3>
                <p className="card__meta">
                  {formatWhen(new Date(playdate.starts_at), new Date(playdate.ends_at))}
                </p>
                <p className="card__meta">
                  {playdate.place_name ?? 'Punto en el mapa'} ·{' '}
                  {playdate.attendee_count === 1
                    ? '1 perro apuntado'
                    : `${playdate.attendee_count} perros apuntados`}
                </p>
                <div className="row">
                  {playdate.admits_sizes.map((size) => (
                    <span className="badge" key={size}>
                      {SIZE_LABEL[size] ?? size}
                    </span>
                  ))}
                  {playdate.admits_energy.map((energy) => (
                    <span className="badge" key={energy}>
                      {ENERGY_LABEL[energy] ?? energy}
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="espacios">
        <div className="section__head">
          <p className="eyebrow">Espacios privados</p>
          <h2>Un patio cerrado sale barato entre cinco</h2>
          <p className="lede">
            Alquilar un espacio privado a una persona es caro. Lo interesante es que DoggyMeet ya
            sabe qué perros encajan entre sí, así que puede proponer el grupo y repartir el importe.
          </p>
        </div>

        <div className="grid">
          {spots.map((spot) => (
            <a className="card" key={spot.id} href={`/spot/${spot.public_slug}`}>
              <div className="row">
                <span className="badge badge--accent">
                  {formatPrice(spot.price_per_slot_cents, spot.slot_minutes)}
                </span>
                {spot.is_fenced ? <span className="badge">Vallado</span> : null}
              </div>
              <h3 className="card__title">{spot.title}</h3>
              <p className="card__meta">{spot.description}</p>
              <p className="card__meta">
                Hasta {spot.max_dogs} perros ·{' '}
                {spot.max_dogs > 1
                  ? `${Math.round(spot.price_per_slot_cents / spot.max_dogs / 100)} € por perro al completo`
                  : 'Un solo perro'}
              </p>
            </a>
          ))}
        </div>

        <div className="notice" style={{ marginTop: 'var(--dm-space-6)' }}>
          <span aria-hidden="true">!</span>
          <p>
            <strong>El cobro todavía no ocurre dentro de la aplicación.</strong> En esta fase el
            pago se acuerda con quien alquila el espacio. Repartir dinero entre varias personas
            exige reembolsos parciales, alta fiscal y una postura sobre responsabilidad civil, y es
            la única parte de esto de la que no se sale iterando.
          </p>
        </div>
      </section>
    </div>
  );
}
