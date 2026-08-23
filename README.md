# Coincide

Red social de mascotas. Empareja animales **de la misma especie** por temperamento, cruza los
horarios de salida de sus tutores y facilita que el encuentro ocurra de verdad. Y cuando la especie
no socializa —que son muchas— deja de fingir que sí y conecta a su tutor con quien sí puede
ayudarle.

## Es una aplicación para el animal, no para su tutor

Es la diferencia que decide el resto del diseño. Casi todo lo que hay resuelve el problema de la
persona: con quién queda, cómo llena la tarde, dónde encuentra sitio. Coincide hace eso, y además
tiene una capa —`packages/core/src/welfare.ts`— que puede contestar que no.

Cuando contesta que no, **manda**. No se compensa con una afinidad del 100 %, no se entierra en una
advertencia gris y no se convierte en un "continuar de todas formas": la lista de candidatos vuelve
vacía y el botón de check-in no está. Un control desactivado invita a buscar cómo activarlo; un
aviso debajo de doce tarjetas de animales compatibles ya ha dicho lo contrario de lo que dice su
texto.

| Qué mira | Qué hace |
|---|---|
| **Calor** | Cada especie tiene su franja, y de ahí se descuenta lo que se sepa del animal: hocico chato, sénior, sensible al calor. Los descuentos se acumulan. Sobre asfalto el límite baja otra vez |
| **Duración** | Una quedada declara los minutos de **contacto seguidos**, que no son los del evento. Ninguna puede pasarse del máximo de su especie, y lo impide un disparador en Postgres |
| **Estado** | En recuperación, con la pauta sin terminar o con un encuentro hace un rato: motivos para no aparecer hoy en la lista de nadie |
| **El grupo** | El veredicto es el del animal que peor lo lleve, igual que la afinidad es la del peor par |

Dos consecuencias que conviene leer juntas:

- **El tutor puede endurecer los límites de su animal, nunca ablandarlos.** Quien lo conoce puede
  decir "el mío no aguanta ni eso". Un campo que permitiera lo contrario sería una forma elegante
  de que la regla no existiera.
- **El grupo ve el resultado; el motivo se queda en la ficha.** Que un animal aguante veinte
  minutos es información que los demás necesitan para organizarse. Que esté convaleciente, o en
  celo, es un dato de salud, y la vista pública publica el techo ya calculado sin decir por qué es
  ese.

Esto **no es consejo veterinario**, y la aplicación lo repite donde hace falta: son umbrales
prudentes propios, publicados en el catálogo de especies para que se puedan discutir.

## El modelo social es el eje del producto

Coincide no es una aplicación de perros con otras especies añadidas encima. Cada especie tiene su
propia forma de relacionarse, y eso decide qué se le ofrece al tutor:

| Modelo | Qué significa | Qué ofrece la aplicación |
|---|---|---|
| `pack` | Encuentros abiertos en grupo, con desconocidos | Radar, quedadas, espacios. Solo el perro |
| `small_group` | Dos o tres, terreno neutral, supervisados y cortos | Presentaciones y salas neutrales. Hurones, conejos, cobayas, ratas |
| `solitary` | **Sin encuentros**, y no por una limitación de la app | Comunidad de tutores, lugares y servicios. Gatos, hámsteres, aves, reptiles, peces |

Meter a un gato territorial en una quedada para conocer a otro gato es estresarlo. La aplicación no
lo ofrece, y lo dice en lugar de callarlo. Un hurón fue criado para cazar conejos: **los encuentros
son siempre entre animales de la misma especie**, y eso lo impide un disparador en Postgres, no una
condición en el cliente.

El catálogo cubre 15 especies con su estado legal en España, su fuente y su aviso. Coincide no da
asesoramiento legal: repite lo que dice una norma concreta y enlaza a ella. Las especies excluidas
—la cotorra argentina, por ejemplo— aparecen para poder decir que no y por qué, y su registro se
rechaza en la base de datos.

## Tres motores de encuentro

Para las especies que sí quedan, y el segundo es el que sostiene a los otros dos:

| Motor | Responde a | Cuándo sirve |
|---|---|---|
| Radar en vivo | ¿Quién está fuera ahora? | Hora punta, cuando ya hay densidad |
| **Coincidencia de horarios** | ¿Con quién coincido siempre? | **A cualquier hora**, incluso con la app vacía |
| Quedadas y espacios | Organicemos algo | Fin de semana, cumpleaños, ocasiones |

Los tres responden a la pregunta del tutor. La capa de bienestar responde a la del animal, y va por
encima de los tres.

Un radar sin usuarios es una pantalla vacía, y ese es el estado normal al empezar en un barrio. La
coincidencia de horarios, en cambio, funciona desde el segundo usuario y **sin que nadie tenga que
estar conectado a la vez**. Es lo que hace que la aplicación sirva a las once de la noche, que es
justo cuando más solo se pasea.

## Y un cuarto para quien no queda

Comunidad de tutores por especie y zona, y un directorio de servicios que declara **a qué especies
atiende de verdad**. Un veterinario de perros y gatos no sabe tratar a un gecko, y mandarle uno es
peor que no tener directorio. Las urgencias 24 h salen primero y se consultan sin cuenta: buscar un
veterinario de guardia a las tres de la mañana no debería exigir registrarse.

---

## Estructura

```
coincide/
├── apps/
│   ├── web/          Next.js — páginas públicas: quedada, espacio, parques, especies
│   └── mobile/       Expo — descubrir, radar, quedadas, espacios y comunidad
├── packages/
│   ├── core/         Especies, bienestar, compatibilidad, horarios, grupos y geo. Puro
│   ├── tokens/       Sistema de diseño en OKLCH → CSS para web, hex para RN
│   ├── trackers/     Collares, geocercas y validación de chip
│   └── db/           Cliente de Postgres, semilla y tests de integración
├── supabase/
│   ├── migrations/   Esquema, PostGIS, RLS y funciones. Fuente única de verdad
│   ├── local/        Sustituto del esquema `auth` para probar RLS sin Supabase
│   └── functions/    Edge Functions: fan-out del radar, cumpleaños, purga
└── scripts/          Reset de base de datos y capturas
```

**Lo que se comparte entre web y móvil son los valores, no los componentes.** Tailwind y shadcn/ui
no corren en React Native; prometer componentes compartidos entre Next.js y RN sería falso. Lo que
sí viaja es el esquema, los tipos, el algoritmo y los tokens de diseño, que se emiten en OKLCH para
la web y en hexadecimal para React Native desde el mismo origen.

---

## Puesta en marcha

Requiere Node 22, pnpm y un PostgreSQL 16 con PostGIS.

```bash
pnpm install

# Base de datos local: crea el esquema y aplica todas las migraciones
./scripts/db-reset.sh
node packages/db/dist/seed-cli.js

# Web en http://localhost:3000
pnpm --filter @coincide/web build
pnpm --filter @coincide/web start

# Aplicación móvil
pnpm --filter @coincide/mobile start
```

---

## Decisiones que conviene conocer antes de tocar el código

**El algoritmo decide en tres niveles, y el primero es la especie.** Distinta especie o especie
solitaria son bloqueos con su propio motivo, no puntuaciones bajas: la interfaz los explica de forma
distinta a un veto por tamaño. Solo lo que pasa esos dos niveles llega a puntuarse.

**El nivel de puntuación reparte 100 puntos** entre actividad (35), estilo de juego (30), tamaño
(25) y círculo de confianza (10), con vetos de seguridad por encima. Un veto no se compensa: da
igual lo bien que encajen en todo lo demás.

**La talla es relativa dentro de la especie.** Un conejo "gigante" y un perro "gigante" no tienen
nada que ver, y da igual: la comparación nunca cruza ese límite. Inventar categorías absolutas de
peso no significaría lo mismo para un hurón que para un mastín.

**El nivel de actividad se guarda neutro y se traduce en la interfaz.** La base guarda `low`,
`medium`, `high` para que el algoritmo no necesite saber de qué animal habla; "de sofá" y
"velocista" son vocabulario de perro y se aplican solo cuando toca.

**El estilo de juego usa una matriz y toma el máximo, no el promedio.** A dos animales les basta una
forma compartida de jugar para pasarlo bien; promediar penalizaría al versátil, que es justo el que
mejor encaja con todo el mundo.

**La afinidad de un grupo es el mínimo par a par, no el promedio.** Un grupo vale lo que vale su
peor pareja: un promedio del 85 % puede esconder un par al 30 % que arruina el encuentro.

**Los tres ejes se muestran por separado y nunca se funden en un porcentaje.** Mezclarlos
convertiría a un animal mediocre pero cercano en un "95 % compatible", que es mentirle al usuario
sobre lo único que le importa.

**El bienestar no puntúa: decide.** No es un cuarto eje que baje la nota. Devuelve `ok`, `caution`
o `stop`, y un `stop` saca al animal de la lista en lugar de dejarlo abajo del ranking. Una
puntuación se compensa; un límite, no.

**Nadie consulta el tiempo desde `packages/core`.** El módulo de bienestar recibe las condiciones y
devuelve un veredicto, para poder probarlo entero sin red. Hoy la temperatura la declara el tutor
con un control visible, porque no hay proveedor meteorológico conectado y la pantalla lo dice.

**El chip identifica, no localiza.** Un microchip es un transpondedor RFID pasivo: sin batería, sin
GPS y sin forma de seguirlo. Sirve como insignia de tutor verificado, y el formato válido no
demuestra que el chip exista, porque el número impreso no lleva dígito de control.

---

## Privacidad, implementada en el código

Publicar horarios de paseo es publicar la rutina diaria de una persona. Cinco reglas que viven en el
esquema y no en un documento:

1. **El horario solo se revela como coincidencia.** `schedule_matches` es `security definer`,
   comprueba que quien pregunta es el tutor del animal y devuelve el agregado —"coincidís cinco
   días"— nunca las franjas de nadie.
2. **La presencia caduca por restricción**, con un máximo de cuatro horas. Nadie queda visible en el
   mapa por olvidarse de apagar el check-in.
3. **La ubicación para notificaciones se degrada a ~1 km mediante un disparador**, no solo en el
   cliente: una garantía que depende de que todos los llamadores se acuerden no es una garantía.
4. **Los pings del collar no los lee nadie más que el tutor**, en ninguna consulta, y se purgan a los
   treinta días.
5. **El chip, el teléfono y la dirección de un espacio quedan fuera de las vistas públicas**, porque
   RLS filtra filas y no columnas.
6. **Quién está dentro de una comunidad solo lo ven sus miembros.** El contador de integrantes es
   público; la lista no. La comprobación vive en una función `security definer` porque una política
   sobre `community_members` que consulte `community_members` se llama a sí misma.

---

## Verificación

```bash
pnpm test          # 287 tests unitarios y de integración
pnpm typecheck     # todos los paquetes y aplicaciones
pnpm lint          # ESLint en la web, typecheck en el resto
pnpm --filter @coincide/web e2e    # 62 casos en Chromium, dos viewports
node scripts/screenshots.mjs        # capturas de la web en claro, oscuro y sistema
node scripts/mobile-screenshots.mjs # capturas del móvil: con perro, con gato y a 34 °C
```

Los 22 tests de RLS están escritos como **intentos de acceso indebido**: leer las políticas y darlas
por buenas no demuestra nada. Los 13 de paridad comparan el cálculo de SQL con el de TypeScript
sobre las mismas entradas, para que servidor y cliente no puedan dar respuestas distintas a la misma
pregunta.

Los 13 tests de bienestar en la base comprueban que una quedada no puede proponer más contacto
seguido del que aguanta la especie, e incluyen **paridad**: el techo de duración y el térmico que
calcula Postgres tienen que coincidir con los de `packages/core` para todas las mascotas de la
semilla. Si no coincidieran, la aplicación propondría un rato y el servidor aceptaría otro, y quien
lo pagaría no es ninguno de los dos.

Los 18 tests de especie comprueban las reglas **en la base de datos**, no en el cliente: que no se
puede registrar una cotorra argentina, que sí se puede una especie pendiente del listado positivo,
que no se puede crear una quedada de gatos y que un hurón no puede apuntarse a una de perros. Un
cliente móvil se desensambla en cinco minutos; un disparador en Postgres, no.

Los 62 casos de navegador incluyen auditoría de accesibilidad con axe en las cinco páginas,
recorrido de teclado, anillo de foco, conmutador de tema, movimiento reducido y ausencia de
desbordamiento a 320 px.

---

## Qué NO está hecho todavía

- **Cobro dentro de la aplicación.** Los espacios se reservan y el importe se reparte, pero el pago
  se acuerda con el anfitrión. Repartir dinero entre varios exige reembolsos parciales, alta fiscal
  y una postura sobre responsabilidad civil: es la única parte de esto de la que no se sale
  iterando.
- **SOS de mascota perdida y alertas de ruta.** Van primeros en la cola: el radar ya construye el
  motor geoespacial que necesitan.
- **Integración con Fi y Tractive.** Ninguno de los dos publica API para terceros; la capa de
  adaptadores está lista y declara su estado en lugar de fallar en silencio. Hoy funcionan el GPS
  del teléfono y una ingesta genérica por webhook firmado.
- **Proveedor meteorológico.** La capa de bienestar recibe las condiciones y no las consulta; hoy
  las declara el tutor. `api.open-meteo.com` está bloqueada por el proxy de salida de este entorno
  (403, comprobado), así que conectarla queda pendiente de un entorno con salida a internet. Lo que
  cambia entonces es un módulo.
- **Feed social, grupos, chat y verificación de identidad.** Fase 2.
