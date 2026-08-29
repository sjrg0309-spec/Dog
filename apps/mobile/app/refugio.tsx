/**
 * El panel del refugio: la lista de trabajo de una protectora.
 *
 * El tablero de rescate contesta «qué animal necesita ayuda **fuera**». Esta
 * pantalla contesta la otra mitad, que hasta ahora no estaba en ningún sitio:
 * **qué animales tenéis vosotros y qué le falta a cada uno**. Son dos preguntas
 * distintas y por eso son dos pantallas: una se abre cuando salta un aviso, la
 * otra un martes por la mañana con el café.
 *
 * ## Tres decisiones que gobiernan la pantalla
 *
 *  1. **El resumen antes que la lista.** Arriba van cuatro cifras, y la última
 *     —«sin poder publicar»— es la única que pide trabajo, por eso va en ámbar
 *     y con un pie que dice qué hacer con ella. Un panel que abre directamente
 *     con cuarenta filas obliga a contar a ojo lo que la aplicación ya sabe.
 *  2. **Publicar en adopción tiene condiciones, y las pone el modelo.** Si
 *     falta el chip o la segunda vacuna, `setAnimalStatus` lo rechaza y la
 *     pantalla dice qué falta. La regla no vive en el botón: un botón
 *     deshabilitado se esquiva desde otra pantalla, una función que rechaza no.
 *  3. **Cada animal tiene una situación, no varios interruptores.** En
 *     tratamiento, en acogida, en adopción o adoptado. Cuatro casillas
 *     independientes permitirían «adoptado y disponible», que en una protectora
 *     significa una familia llamando por un perro que ya no está.
 *
 * ## Estados que la pantalla sí tiene
 *
 * Carga —esqueletos con la forma de la fila, no una rueda—, vacío por filtro
 * —cada uno dice algo distinto: no es lo mismo «todavía no hay ninguno» que
 * «ninguno en tratamiento, que es una buena noticia»—, y el rechazo al publicar,
 * que se dice en una píldora y no en un aviso que haya que cerrar.
 */

import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimalRow } from '@/components/animal-row';
import { BackBar } from '@/components/chrome';
import { Drawer } from '@/components/drawer';
import {
  EmptyState,
  FilterChips,
  FootNote,
  LIST_GUTTER,
  ListGroup,
  ListRow,
  PillButton,
  SectionHeader,
} from '@/components/list';
import { Appear } from '@/components/motion';
import { SkeletonBlock } from '@/components/skeleton';
import { StatStrip } from '@/components/stats';
import { Toast } from '@/components/toast';
import { Body, Caption, Screen } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { fonts } from '@/lib/fonts';
import { CircleCheck, Home, HeartPulse, PawPrint, Syringe } from '@/lib/icons';
import {
  ageLabel,
  resolvePending,
  setAnimalStatus,
  sinceLabel,
  STATUS_LABEL,
  tally,
  useShelterAnimals,
  type AnimalStatus,
  type ShelterAnimal,
} from '@/lib/refugio';
import { useTheme } from '@/lib/theme';

/**
 * Los filtros.
 *
 * «Todos» primero porque es como se abre, y «Adoptados» último porque es lo
 * único que ya no pide nada. El orden de las pestañas es el orden en que un
 * animal avanza, que es también el orden en que se piensa en ellos.
 */
const FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'treatment', label: 'Tratamiento' },
  { id: 'foster', label: 'Acogida' },
  { id: 'adoptable', label: 'Adopción' },
  { id: 'adopted', label: 'Adoptados' },
] as const;

type Filter = (typeof FILTERS)[number]['id'];

/** Lo que se dice cuando un filtro no tiene a nadie. Uno por filtro. */
const EMPTY: Record<Filter, { title: string; body: string }> = {
  all: {
    title: 'Todavía no hay ningún animal',
    body: 'Cuando deis de alta al primero aparecerá aquí, con lo que le falte para poder publicarlo.',
  },
  treatment: {
    title: 'Ninguno en tratamiento',
    body: 'Es una buena noticia: nadie está esperando a curarse para poder buscar casa.',
  },
  foster: {
    title: 'Ninguno en casa de acogida',
    body: 'Las casas de acogida se declaran al cambiar la situación de un animal.',
  },
  adoptable: {
    title: 'Ninguno publicado en adopción',
    body: 'Un animal se publica cuando no le falta nada: chip, vacunas y esterilización.',
  },
  adopted: {
    title: 'Ninguno adoptado todavía',
    body: 'Aquí quedan los que ya tienen casa. No se borran: son la cuenta de lo que habéis hecho.',
  },
};

export default function ShelterPanelScreen() {
  const theme = useTheme();
  const account = useAccount();
  const animals = useShelterAnimals();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<ShelterAnimal | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  /*
   * La carga.
   *
   * Los datos son de memoria y llegan al instante, así que esto no simula una
   * espera que no existe: se enseña un turno de esqueletos en el primer
   * fotograma para que el diseño de la lista **exista antes que los datos**, que
   * es lo que evita el salto cuando en producción esa lista venga de la base.
   */
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(timer);
  }, []);

  const counts = useMemo(() => tally(animals), [animals]);
  const shown = useMemo(
    () => (filter === 'all' ? animals : animals.filter((animal) => animal.status === filter)),
    [animals, filter],
  );

  /*
   * Dos columnas cuando hay sitio.
   *
   * En un teléfono es una columna y punto. En una tableta —o en la web, que es
   * donde se revisan cuarenta animales con calma— una sola columna de fichas de
   * setenta puntos deja dos tercios de pantalla en blanco. El umbral es 700 y
   * no un breakpoint de moda: es el ancho a partir del cual caben dos fichas
   * con su retrato, sus dos líneas y su pastilla sin recortar el nombre.
   */
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 2 : 1;

  /* El resumen se reparte por el mismo umbral: en un teléfono cuatro cifras son
     dos y dos, y con sitio de sobra caben en una sola línea en vez de dejar dos
     huecos del ancho de media pantalla entre columna y columna. */
  const statColumns = width >= 700 ? 4 : 2;

  const move = (animal: ShelterAnimal, status: AnimalStatus) => {
    const result = setAnimalStatus(animal.id, status);
    setOpen(null);
    setToast(result.ok ? `${animal.name}: ${STATUS_LABEL[status].toLowerCase()}` : result.reason);
  };

  return (
    <Screen grouped>
      <BackBar title="Vuestros animales" subtitle={account.shelterName ?? 'Protectora'} />

      <Animated.ScrollView contentContainerStyle={{ paddingBottom: theme.space[16] }}>
        {/* El resumen. Cuatro cifras y no cinco: la rejilla es de dos columnas
            —un rótulo como «sin poder publicar» no cabe en tres— y una quinta
            se queda sola en la última fila, donde se lee como si fuera de otra
            cosa. La que cae es «adoptados», que es la única que no pide nada y
            además tiene su propio filtro justo debajo. */}
        <View style={{ paddingTop: theme.space[4] }}>
          <ListGroup leading="none">
            <View style={{ padding: theme.space[4], gap: theme.space[3] }}>
              <StatStrip
                columns={statColumns}
                stats={[
                  { value: String(counts.total), label: 'animales' },
                  { value: String(counts.adoptable), label: 'en adopción' },
                  { value: String(counts.foster), label: 'en acogida' },
                  {
                    value: String(counts.blocked),
                    label: 'sin poder publicar',
                    tone: counts.blocked > 0 ? ('alert' as const) : undefined,
                  },
                ]}
              />
              {counts.blocked > 0 ? (
                <Caption>
                  A {counts.blocked === 1 ? 'uno le falta' : `${counts.blocked} les falta`} algo
                  para poder publicarse. Están marcados en la lista.
                </Caption>
              ) : null}
            </View>
          </ListGroup>
        </View>

        {/* Chips y no un segmentado: cinco rótulos repartidos a partes iguales
            dejan «Tratami…» y «Adopci…», y un filtro que hay que adivinar no es
            un filtro. Aquí cada uno mide lo que mide su palabra y la fila se
            desliza. */}
        <View style={{ paddingTop: theme.space[5] }}>
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        </View>

        <SectionHeader
          title={filter === 'all' ? 'Todos' : FILTERS.find((entry) => entry.id === filter)!.label}
        />

        {loading ? (
          /* El esqueleto tiene la forma de la fila que viene, no la de una
             rueda girando: es lo que hace que al llegar los datos nada salte
             de sitio. */
          <ListGroup leading="avatar">
            {[0, 1, 2].map((row) => (
              <View
                key={row}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.space[3],
                  padding: theme.space[4],
                }}
              >
                <SkeletonBlock width={44} height={44} radius={22} />
                <View style={{ flex: 1, gap: 6 }}>
                  <SkeletonBlock width="55%" height={14} />
                  <SkeletonBlock width="80%" height={12} />
                </View>
              </View>
            ))}
          </ListGroup>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={filter === 'adopted' ? CircleCheck : PawPrint}
            title={EMPTY[filter].title}
            body={EMPTY[filter].body}
            action={
              filter === 'all' ? undefined : { label: 'Ver todos', onPress: () => setFilter('all') }
            }
          />
        ) : columns === 2 ? (
          /* En ancho, dos columnas de tarjetas independientes: agruparlas en un
             solo bloque partido por la mitad dejaría las líneas de separación
             cruzando el hueco entre columnas. */
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: theme.space[3],
              paddingHorizontal: LIST_GUTTER,
            }}
          >
            {shown.map((animal, index) => (
              <Appear
                key={animal.id}
                index={index}
                style={{ width: `${100 / columns}%`, maxWidth: 420, flexGrow: 1 }}
              >
                <ListGroup leading="avatar">
                  <AnimalRow animal={animal} onPress={setOpen} />
                </ListGroup>
              </Appear>
            ))}
          </View>
        ) : (
          <ListGroup leading="avatar">
            {shown.map((animal) => (
              <AnimalRow key={animal.id} animal={animal} onPress={setOpen} />
            ))}
          </ListGroup>
        )}

        <FootNote>
          Esta lista solo la ve vuestro colectivo. Se guarda en memoria mientras la aplicación está
          abierta: al cerrarla se pierde, y decirlo es más honesto que dar por hecho que hay un
          servidor detrás. Lo que no lleva —ni llevará aquí— es historial clínico ni datos de la
          familia adoptante: eso es una ficha veterinaria y un contrato, no una lista de trabajo.
        </FootNote>
      </Animated.ScrollView>

      {/* Las acciones de un animal, en una hoja. Se abre con la fila entera y
          no con un menú de tres puntos: en una lista que se recorre buscando a
          quién le falta algo, el objetivo es el animal, no un icono de doce
          puntos a su derecha. */}
      {open ? (
        <Drawer title={open.name} onClose={() => setOpen(null)} height={0.62}>
          <AnimalActions animal={open} onMove={move} onResolve={resolvePending} />
        </Drawer>
      ) : null}

      {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
    </Screen>
  );
}

/**
 * Lo que se puede hacer con un animal.
 *
 * Solo se ofrecen las situaciones a las que **puede** ir desde donde está: un
 * adoptado no vuelve a tratamiento desde aquí, y uno al que le falta el chip no
 * enseña «publicar en adopción» como si fuera cuestión de tocarlo. Lo que sí
 * enseña, y es lo útil, es la lista de lo que falta, tachable una a una.
 */
function AnimalActions({
  animal,
  onMove,
  onResolve,
}: {
  animal: ShelterAnimal;
  onMove: (animal: ShelterAnimal, status: AnimalStatus) => void;
  onResolve: (id: string, task: string) => void;
}) {
  const theme = useTheme();
  const ready = animal.pending.length === 0;

  const moves: ReadonlyArray<{ status: AnimalStatus; label: string; icon: typeof Home }> = [
    { status: 'treatment', label: 'Pasar a tratamiento', icon: HeartPulse },
    { status: 'foster', label: 'Poner en acogida', icon: Home },
    { status: 'adoptable', label: 'Publicar en adopción', icon: CircleCheck },
    { status: 'adopted', label: 'Marcar como adoptado', icon: CircleCheck },
  ];

  return (
    /* Desplazable y no una columna fija: con dos pendientes y tres destinos la
       hoja ya llega al borde, y a un animal con cuatro vacunas por poner se le
       quedarían los botones de mover fuera de la pantalla. */
    <ScrollView contentContainerStyle={{ gap: theme.space[4], paddingBottom: theme.space[4] }}>
      {/* La cabecera va aquí y no en la hoja: `Drawer` solo dibuja el asa, y
          cada pantalla escribe la suya. El nombre repetido no sobra —la hoja se
          abre desde una lista de ocho y hay que saber a cuál se ha entrado. */}
      <View style={{ gap: theme.space[1], paddingHorizontal: LIST_GUTTER }}>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.foreground,
            fontFamily: fonts.displayBold,
            fontSize: theme.fontSize.xl,
          }}
        >
          {animal.name}
        </Text>
        <Body>
          {animal.breed} · {ageLabel(animal.ageMonths)}
        </Body>
        <Caption>
          {STATUS_LABEL[animal.status]} · {sinceLabel(animal.since).toLowerCase()}
          {animal.fosterName ? ` · en casa de ${animal.fosterName}` : ''}
        </Caption>
      </View>

      {animal.pending.length > 0 ? (
        <View style={{ gap: theme.space[2] }}>
          <View style={{ paddingHorizontal: LIST_GUTTER }}>
            <Caption>Falta para poder publicarlo</Caption>
          </View>
          <ListGroup>
            {animal.pending.map((task) => (
              <ListRow
                key={task}
                leading={<Syringe size={20} color={theme.colors.warning} />}
                title={task}
                trailing={
                  <PillButton
                    label="Hecho"
                    variant="neutral"
                    accessibilityHint={`Tacha ${task.toLowerCase()} de lo que le falta a ${animal.name}`}
                    onPress={() => onResolve(animal.id, task)}
                  />
                }
              />
            ))}
          </ListGroup>
        </View>
      ) : null}

      <View style={{ gap: theme.space[2] }}>
        <View style={{ paddingHorizontal: LIST_GUTTER }}>
          <Caption>Mover a</Caption>
        </View>
        <ListGroup>
          {moves
            .filter((move) => move.status !== animal.status)
            .map((move) => (
              <ListRow
                key={move.status}
                title={move.label}
                subtitle={
                  move.status === 'adoptable' && !ready
                    ? 'Antes hay que tachar lo que falta'
                    : undefined
                }
                trailing={
                  <PillButton
                    label="Mover"
                    variant={move.status === 'adoptable' && ready ? 'primary' : 'neutral'}
                    disabled={move.status === 'adoptable' && !ready}
                    onPress={() => onMove(animal, move.status)}
                  />
                }
              />
            ))}
        </ListGroup>
      </View>
    </ScrollView>
  );
}
