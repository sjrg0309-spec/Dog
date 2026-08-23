-- Coincide se acota a perros.
--
-- Mirando los datos: de las quince especies del catálogo, solo cinco tienen
-- encuentros y **una sola** —el perro— tiene modelo de manada, que es el que
-- sostiene el radar, las quedadas abiertas y los espacios compartidos. Para las
-- otras cuatro el producto era una presentación supervisada de veinte minutos, y
-- para las diez restantes un directorio. Eran tres productos distintos dentro de
-- la misma aplicación, y el que funciona es el del perro.
--
-- Lo que **no** se hace aquí, y es deliberado: borrar el catálogo. Las especies,
-- su estado legal, sus límites de cuidado y los disparadores que impiden mezclar
-- especies siguen exactamente donde estaban, con sus tests. Lo que cambia es qué
-- puede registrar un tutor.
--
-- La diferencia importa. Volver a abrir la aplicación a hurones o conejos es
-- poner `is_available` a cierto en una fila; si hubiéramos borrado las tablas,
-- sería rehacer el trabajo entero. Y mientras tanto la base sigue impidiendo lo
-- que siempre impidió: una quedada de gatos, un hurón apuntado a una de perros,
-- una sesión más larga de lo que aguanta la especie.

alter table public.species
  /**
   * ¿Puede un tutor registrar hoy un animal de esta especie?
   *
   * Es una decisión de producto, no del catálogo: separada de `legal_status` a
   * propósito. Un dragón barbudo es legal y no está disponible; una cotorra
   * argentina no es legal y tampoco lo está. Son dos noes distintos y el tutor
   * merece leer el que corresponde.
   */
  add column is_available boolean not null default false;

update public.species set is_available = true where id = 'dog';

comment on column public.species.is_available is
  'Superficie de producto: qué especies puede registrar un tutor hoy. '
  'Independiente de la legalidad, que vive en species_legal_status.';

/**
 * La puerta.
 *
 * Sustituye al disparador que solo comprobaba la exclusión legal. Ahora contesta
 * los dos noes, y con mensajes distintos: uno dice que la especie no está
 * permitida, el otro que todavía no la hemos abierto. Confundirlos haría que un
 * tutor de dragón barbudo creyera que tiene un animal ilegal.
 */
create or replace function public.enforce_registrable_species()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  common text;
begin
  select s.common_name into common from public.species s where s.id = new.species_id;

  if common is null then
    raise exception 'La especie % no existe en el catálogo', new.species_id;
  end if;

  if not public.species_is_registrable(new.species_id) then
    raise exception
      'La especie % está excluida: su tenencia no está permitida', common;
  end if;

  if not exists (
    select 1 from public.species s where s.id = new.species_id and s.is_available
  ) then
    raise exception
      'Coincide todavía no está abierto a %: hoy solo funciona con perros', common;
  end if;

  return new;
end;
$$;

/**
 * Las especies que un tutor puede elegir al registrar su animal.
 *
 * La aplicación lee de aquí en lugar de tener «perro» escrito en el cliente: el
 * día que se abra a otra especie, las pantallas se enteran solas.
 */
create or replace function public.available_species()
returns table (id text, common_name text, social_model public.social_model)
language sql
stable
set search_path = ''
as $$
  select s.id, s.common_name, s.social_model
  from public.species s
  where s.is_available
  order by s.common_name;
$$;

grant execute on function public.available_species() to anon, authenticated;
