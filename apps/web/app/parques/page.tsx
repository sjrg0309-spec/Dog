import type { Metadata } from 'next';

import { allPlaces } from '@/lib/db';
import { triState, triStateLabel } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Parques y espacios pet-friendly',
  description:
    'Directorio de parques caninos con lo que de verdad importa antes de soltar a un perro: valla, doble puerta, agua, sombra y zona separada.',
};

export default async function PlacesPage() {
  const places = await allPlaces();

  return (
    <div className="shell section">
      <div className="section__head">
        <p className="eyebrow">Directorio</p>
        <h1>Parques y espacios</h1>
        <p className="lede">
          Solo los datos que cambian una decisión: si hay valla, si la puerta es doble, si hay agua
          y si hay sombra. Cuando un dato no está confirmado se dice, en lugar de darlo por
          negativo: creer que un parque no está vallado cuando nadie lo ha comprobado es peor que
          admitir que falta el dato.
        </p>
      </div>

      <div className="grid">
        {places.map((place) => (
          <article className="card" key={place.id}>
            <div className="row">
              <h2 className="card__title">{place.name}</h2>
              {place.upcoming_playdates > 0 ? (
                <span className="badge badge--accent">
                  {place.upcoming_playdates === 1
                    ? '1 quedada'
                    : `${place.upcoming_playdates} quedadas`}
                </span>
              ) : null}
            </div>

            <p className="card__meta">
              {place.upcoming_playdates === 1
                ? '1 quedada próxima aquí'
                : `${place.upcoming_playdates} quedadas próximas aquí`}
            </p>

            <ul className="checklist">
              <li data-state={triState(place.is_fenced)}>
                {triStateLabel(place.is_fenced, 'Vallado')}
              </li>
              <li data-state={triState(place.has_double_gate)}>
                {triStateLabel(place.has_double_gate, 'Doble puerta')}
              </li>
              <li data-state={triState(place.has_water)}>
                {triStateLabel(place.has_water, 'Fuente de agua')}
              </li>
              <li data-state={triState(place.has_shade)}>
                {triStateLabel(place.has_shade, 'Sombra')}
              </li>
              <li data-state={triState(place.has_small_pet_area)}>
                {triStateLabel(place.has_small_pet_area, 'Zona para perros pequeños')}
              </li>
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
