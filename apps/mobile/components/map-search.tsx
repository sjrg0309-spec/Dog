/**
 * Buscar en el mapa.
 *
 * Faltaba entera: el mapa enseñaba lo que hubiera dentro del cuadro y no había
 * forma de preguntar por algo. En cualquier mapa que la gente use —Google Maps,
 * Waze— lo primero de la pantalla es una barra de búsqueda flotando encima, y
 * no es decoración: es la diferencia entre «mira a ver si lo encuentras» y
 * «dime qué buscas».
 *
 * Tres cosas que hace y que un buscador de adorno no haría:
 *
 *  1. **Busca de verdad**, sobre el catálogo que ya tiene delante: nombre y
 *     tipo, sin acentos y sin distinguir mayúsculas, porque nadie escribe
 *     «Bebedero de la Rosaleda» con la tilde puesta y en el orden correcto.
 *  2. **Categorías antes de escribir.** Lo que más se busca en una aplicación de
 *     perros son tres cosas —agua, veterinario, parque—, y las tres caben en
 *     una fila de píldoras. Escribir es el camino largo.
 *  3. **Recuerda lo último**, que es lo que convierte «buscar el veterinario de
 *     guardia» de una tarea en un toque. Vive en memoria y no sale del
 *     dispositivo: una lista de sitios buscados es una lista de dónde ha estado
 *     alguien y por qué.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icon } from './icon';
import { fonts } from '@/lib/fonts';
import { haptics } from '@/lib/haptics';
import { Clock, Droplets, Search, Stethoscope, Trees, X, type LucideIcon } from '@/lib/icons';
import { searchPlaces, type Searchable } from '@/lib/map-search';
import { useTheme } from '@/lib/theme';

export const SEARCH_CATEGORIES: ReadonlyArray<{ id: string; label: string; icon: LucideIcon }> = [
  { id: 'parque', label: 'Parques', icon: Trees },
  { id: 'fuente', label: 'Agua', icon: Droplets },
  { id: 'veterinario', label: 'Veterinarios', icon: Stethoscope },
];

/** La barra flotante, cerrada. Es lo único que se ve hasta que se toca. */
export function SearchBar({ onOpen, topInset }: { onOpen: () => void; topInset: number }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel="Buscar un sitio en el mapa"
      accessibilityHint="Parques, fuentes y veterinarios de tu zona"
      onPress={() => {
        haptics.tap();
        onOpen();
      }}
      style={({ pressed }) => ({
        position: 'absolute',
        top: topInset + theme.space[3],
        left: theme.space[3],
        // Hasta donde empieza la columna de botones del mapa.
        right: 60,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        height: 44,
        paddingHorizontal: theme.space[3],
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.background,
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon icon={Search} size="base" color={theme.colors.mutedForeground} decorative />
      <Text
        style={{
          flex: 1,
          color: theme.colors.mutedForeground,
          fontFamily: fonts.body,
          fontSize: theme.fontSize.sm,
        }}
      >
        Buscar parques, agua, veterinarios
      </Text>
    </Pressable>
  );
}

/** El buscador abierto: campo, categorías, recientes y resultados. */
export function SearchPanel<T extends Searchable>({
  items,
  recents,
  onPick,
  onClose,
  topInset,
}: {
  items: readonly T[];
  /** Identificadores de lo último elegido, lo más reciente primero. */
  recents: readonly string[];
  onPick: (item: T) => void;
  onClose: () => void;
  topInset: number;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchPlaces(items, query), [items, query]);
  const recentItems = useMemo(
    () => recents.map((id) => items.find((item) => item.id === id)).filter((item) => item !== undefined),
    [recents, items],
  );

  const searching = query.trim().length > 0;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: topInset,
        backgroundColor: theme.colors.background,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space[2],
          height: 56,
          paddingHorizontal: theme.space[3],
        }}
      >
        <Icon icon={Search} size="base" color={theme.colors.mutedForeground} decorative />
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus
          placeholder="Buscar parques, agua, veterinarios"
          placeholderTextColor={theme.colors.inputPlaceholder}
          accessibilityLabel="Buscar un sitio en el mapa"
          returnKeyType="search"
          style={{
            flex: 1,
            color: theme.colors.inputForeground,
            fontFamily: fonts.body,
            fontSize: theme.fontSize.base,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar la búsqueda"
          onPress={() => {
            haptics.tap();
            onClose();
          }}
          style={({ pressed }) => ({
            width: theme.touchTarget.min,
            height: theme.touchTarget.min,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon icon={X} size="lg" decorative />
        </Pressable>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {!searching ? (
          <>
            {/* Las categorías van antes que el teclado a propósito: en una
                aplicación de perros lo que se busca son tres cosas, y tocarlas
                es más rápido que escribirlas. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: theme.space[4],
                paddingBottom: theme.space[4],
                gap: theme.space[2],
              }}
            >
              {SEARCH_CATEGORIES.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityLabel={category.label}
                  onPress={() => {
                    haptics.tap();
                    setQuery(category.id);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.space[2],
                    height: 36,
                    paddingHorizontal: theme.space[3],
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.colors.surfaceSunken,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon
                    icon={category.icon}
                    size="sm"
                    color={theme.colors.mutedForeground}
                    decorative
                  />
                  <Text
                    style={{
                      color: theme.colors.foreground,
                      fontFamily: fonts.bodyBold,
                      fontSize: 13,
                    }}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {recentItems.length > 0 ? (
              <>
                <SectionLabel icon={Clock}>Lo último que buscaste</SectionLabel>
                {recentItems.map((item) => (
                  <ResultRow key={item.id} item={item} onPress={() => onPick(item)} />
                ))}
              </>
            ) : (
              <View style={{ paddingHorizontal: theme.space[4] }}>
                <Text
                  style={{
                    color: theme.colors.mutedForeground,
                    fontFamily: fonts.body,
                    fontSize: theme.fontSize.sm,
                  }}
                >
                  Toca una categoría o escribe un nombre. Lo que busques se queda en el teléfono:
                  una lista de sitios buscados dice dónde ha estado alguien y por qué.
                </Text>
              </View>
            )}
          </>
        ) : results.length === 0 ? (
          <View style={{ paddingHorizontal: theme.space[4] }}>
            <Text
              style={{
                color: theme.colors.foreground,
                fontFamily: fonts.bodyBold,
                fontSize: theme.fontSize.base,
              }}
            >
              Nada que se llame «{query.trim()}».
            </Text>
            <Text
              style={{
                color: theme.colors.mutedForeground,
                fontFamily: fonts.body,
                fontSize: theme.fontSize.sm,
              }}
            >
              Se busca en todo lo que hay en tu zona, esté o no dibujado en el mapa: si el
              resultado viene de una capa apagada, se enciende al elegirlo.
            </Text>
          </View>
        ) : (
          results.map((item) => <ResultRow key={item.id} item={item} onPress={() => onPick(item)} />)
        )}
      </ScrollView>
    </View>
  );
}

function SectionLabel({ icon, children }: { icon: LucideIcon; children: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space[2],
        paddingHorizontal: theme.space[4],
        paddingBottom: theme.space[2],
      }}
    >
      <Icon icon={icon} size="sm" color={theme.colors.mutedForeground} decorative />
      <Text
        style={{ color: theme.colors.mutedForeground, fontFamily: fonts.bodyBold, fontSize: 12 }}
      >
        {children}
      </Text>
    </View>
  );
}

function ResultRow<T extends Searchable>({ item, onPress }: { item: T; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${item.kind}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        gap: 1,
        minHeight: 56,
        justifyContent: 'center',
        paddingHorizontal: theme.space[4],
        backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
      })}
    >
      <Text
        numberOfLines={1}
        style={{
          color: theme.colors.foreground,
          fontFamily: fonts.displayBold,
          fontSize: theme.fontSize.sm,
        }}
      >
        {item.label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: theme.colors.mutedForeground, fontFamily: fonts.body, fontSize: 12 }}
      >
        {item.kind}
      </Text>
    </Pressable>
  );
}
