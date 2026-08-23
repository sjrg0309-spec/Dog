import { WELFARE_DISCLAIMER } from '@coincide/core';

import { RadarRing } from '@/components/radar-ring';
import { activeSpots, allSpecies, communitiesNear, servicesNear, upcomingPlaydates } from '@/lib/db';
import {
  ENERGY_LABEL,
  SIZE_LABEL,
  SERVICE_KIND_LABEL,
  formatPrice,
  formatRelative,
  formatWhen,
} from '@/lib/format';

// Los datos cambian con cada check-in, así que no tiene sentido servir una
// versión estática de esta página.
export const dynamic = 'force-dynamic';

const ENGINES = [
  {
    eyebrow: 'Ahora mismo',
    title: 'Radar en vivo',
    body: '“Estoy en el Parque Central hasta las 19:00.” Quien tenga un animal compatible a dos kilómetros lo ve. El check-in caduca solo, así que nadie se queda visible en el mapa por olvidarse de apagarlo.',
  },
  {
    eyebrow: 'A cualquier hora',
    title: 'Coincidencia de horarios',
    body: 'Dices cuándo sales y con quién coincides aparece solo, sin que ninguno de los dos tenga que estar conectado. Es lo que hace que esto sirva a las once de la noche, que es cuando más solo se pasea.',
  },
  {
    eyebrow: 'Para las que no quedan',
    title: 'Comunidad y servicios',
    body: 'Un gato no debe conocer a otro gato, y un gecko tampoco. Pero sus tutores sí se buscan entre ellos, y necesitan saber qué veterinario de exóticos está de guardia el domingo.',
  },
  {
    eyebrow: 'Y por encima de los tres',
    title: 'El interés del animal',
    body: 'Un bulldog a 25 grados no sale, aunque tenga un match del 100 % a dos calles. La aplicación no lo avisa en gris debajo de la lista: quita la lista.',
  },
];

export default async function HomePage() {
  const [playdates, spots, species, communities, services] = await Promise.all([
    upcomingPlaydates(3),
    activeSpots(2),
    allSpecies(),
    communitiesNear(),
    servicesNear(),
  ]);

  const social = species.filter((entry) => entry.social_model !== 'solitary').length;
  const solitary = species.filter((entry) => entry.social_model === 'solitary').length;
  const emergency = services.filter((entry) => entry.is_24h);

  return (
    <div className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Red social de mascotas</p>
          <h1 className="hero__title">
            Que tu mascota salga <em>con alguien</em>.
          </h1>
          <p className="lede">
            Coincide empareja animales de la misma especie por carácter, tamaño y forma de jugar, y
            cruza vuestros horarios de salida. Y cuando a tu animal no le conviene salir —porque
            aprieta el calor, porque le falta pauta, porque su especie no queda con nadie—, lo dice
            y deja de proponerlo.
          </p>

          <div className="row" style={{ marginTop: 'var(--co-space-6)' }}>
            <a className="button button--primary" href="#quedadas">
              Ver quedadas cerca
            </a>
            <a className="button button--outline" href="/especies">
              Qué especies entran
            </a>
          </div>

          <p
            className="card__meta"
            style={{ marginTop: 'var(--co-space-5)', maxWidth: 'var(--co-measure-narrow)' }}
          >
            {species.length} especies en el catálogo: {social} con encuentros y {solitary} sin
            ellos.{' '}
            {playdates.length > 0
              ? `Próxima quedada ${formatRelative(new Date(playdates[0]!.starts_at))}.`
              : 'Aún no hay quedadas programadas.'}
          </p>
        </div>

        <RadarRing label="Anillo de radar: mascotas compatibles cerca ahora mismo" />
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="como-funciona">
        <div className="section__head">
          <p className="eyebrow">Tres motores y un límite</p>
          <h2>Uno para cada momento, uno para quien no queda, y uno que dice que no</h2>
          <p className="lede">
            Un radar sin gente es una pantalla vacía. Por eso el motor central no es quién está
            fuera ahora, sino con quién coincides siempre. Y por encima de los tres hay un límite
            que no negocia: si el plan no le conviene al animal, no se propone.
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
          <h2>Encuentros abiertos cerca de ti</h2>
          <p className="lede">
            Cada quedada es de una sola especie. No es una restricción de la interfaz: un hurón fue
            criado para cazar conejos, y ninguna puntuación de carácter debería poder ponerlos en el
            mismo sitio.
          </p>
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
                  <span className="badge badge--accent">{playdate.species_name}</span>
                  <span className="badge">{formatRelative(new Date(playdate.starts_at))}</span>
                  {playdate.leashed ? <span className="badge">Con correa</span> : null}
                </div>
                <h3 className="card__title">{playdate.title}</h3>
                <p className="card__meta">
                  {formatWhen(new Date(playdate.starts_at), new Date(playdate.ends_at))}
                </p>
                <p className="card__meta">
                  {playdate.place_name ?? 'Punto acordado en el mapa'} ·{' '}
                  {playdate.attendee_count === 1
                    ? '1 animal apuntado'
                    : `${playdate.attendee_count} animales apuntados`}
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
      <section className="section" id="comunidad">
        <div className="section__head">
          <p className="eyebrow">Para las especies que no quedan</p>
          <h2>No todas las mascotas socializan; todos los tutores sí</h2>
          <p className="lede">
            Un tutor de reptiles no necesita una quedada. Necesita saber qué veterinario de exóticos
            está abierto un domingo y con quién hablar cuando su animal deja de comer. Eso es tan
            producto como un paseo en el parque.
          </p>
        </div>

        <div className="grid">
          {communities.map((community) => (
            <article className="card" key={community.id}>
              <div className="row">
                <h3 className="card__title">{community.name}</h3>
                {community.species_name ? (
                  <span className="badge badge--accent">{community.species_name}</span>
                ) : (
                  <span className="badge">Todas las especies</span>
                )}
              </div>
              <p className="card__meta">
                {community.member_count === 1
                  ? '1 tutor'
                  : `${community.member_count} tutores`}
              </p>
            </article>
          ))}
        </div>

        {emergency.length > 0 ? (
          <div className="notice" style={{ marginTop: 'var(--co-space-6)' }}>
            <span aria-hidden="true">!</span>
            <p>
              <strong>Urgencias cerca:</strong> {emergency.map((entry) => entry.name).join(', ')}.
              El directorio se consulta sin cuenta, porque buscar un veterinario de guardia a las
              tres de la mañana no debería exigir registrarse.
            </p>
          </div>
        ) : null}

        <div className="grid" style={{ marginTop: 'var(--co-space-6)' }}>
          {services
            .filter((entry) => !entry.is_24h)
            .slice(0, 3)
            .map((service) => (
              <article className="card" key={service.id}>
                <div className="row">
                  <h3 className="card__title">{service.name}</h3>
                  {service.is_verified ? (
                    <span className="badge badge--verified">✓ Verificado</span>
                  ) : null}
                </div>
                <p className="card__meta">{SERVICE_KIND_LABEL[service.kind] ?? service.kind}</p>
                <p className="card__meta">
                  {service.species_names.length > 0
                    ? `Atiende: ${service.species_names.join(', ')}`
                    : 'No ha declarado a qué especies atiende'}
                </p>
              </article>
            ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="bienestar">
        <div className="section__head">
          <p className="eyebrow">De quién es esta aplicación</p>
          <h2>El plan es del tutor; el cuerpo que lo aguanta, no</h2>
          <p className="lede">
            Casi todas las aplicaciones de mascotas resuelven el problema de la persona: con quién
            queda, cómo llena la tarde, dónde encuentra sitio. Coincide hace eso, y además tiene una
            capa que puede contestar que no.
          </p>
        </div>

        <div className="grid">
          <article className="card card--feature">
            <p className="eyebrow">Calor</p>
            <h3 className="card__title">El techo no es el mismo para todos</h3>
            <p className="card__meta">
              Cada especie tiene su franja, y de ahí se descuenta lo que sepamos del animal: hocico
              chato, sénior, sensible al calor. Los descuentos se acumulan, porque sumar es la forma
              prudente de equivocarse. Y si el suelo es asfalto, el límite baja otra vez: el aire a
              28 grados convive con un suelo bastante más caliente, y quien lo pisa descalzo es él.
            </p>
          </article>

          <article className="card card--feature">
            <p className="eyebrow">Duración</p>
            <h3 className="card__title">Dos horas es un buen plan para ti</h3>
            <p className="card__meta">
              Para un hurón son seis sesiones de veinte minutos con descanso entre medias, y son
              cosas distintas. Una quedada declara los minutos de contacto seguidos, y ninguna puede
              pasarse del máximo de su especie. Lo impide un disparador en Postgres, no una
              comprobación del formulario.
            </p>
          </article>

          <article className="card card--feature">
            <p className="eyebrow">Estado</p>
            <h3 className="card__title">Quien está de baja, está de baja</h3>
            <p className="card__meta">
              En recuperación, con la pauta de vacunación sin terminar, o con un encuentro hace un
              rato: son motivos para no aparecer hoy en la lista de nadie. El grupo ve el
              resultado —«aguanta veinte minutos»— y no el motivo, que es un dato de salud y se
              queda en su ficha.
            </p>
          </article>
        </div>

        <div className="notice" style={{ marginTop: 'var(--co-space-6)' }}>
          <span aria-hidden="true">!</span>
          <p>
            <strong>Esto no es consejo veterinario.</strong> {WELFARE_DISCLAIMER} Los umbrales están
            publicados en el <a href="/especies">catálogo de especies</a> para que se puedan
            discutir, y tu animal puede tener el suyo más estricto. Más laxo, no: un campo que
            pudiera subirlos sería una forma elegante de que la regla no existiera.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section className="section" id="espacios">
        <div className="section__head">
          <p className="eyebrow">Espacios privados</p>
          <h2>Un espacio cerrado sale barato entre varios</h2>
          <p className="lede">
            Alquilar un espacio privado a una persona es caro. Lo interesante es que Coincide ya
            sabe qué animales encajan entre sí, así que puede proponer el grupo y repartir el
            importe. Y para presentar conejos o hurones, un terreno neutral no es un lujo: es la
            única forma de hacerlo bien.
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
              <p className="card__meta">Hasta {spot.max_pets} animales</p>
            </a>
          ))}
        </div>

        <div className="notice" style={{ marginTop: 'var(--co-space-6)' }}>
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
