# Coincide

Red social de paseos caninos. Empareja perros por temperamento, cruza los horarios de paseo de sus
tutores y facilita que la salida ocurra de verdad.

El producto se apoya en **tres motores de encuentro**, y el segundo es el que sostiene a los otros
dos:

| Motor | Responde a | Cuándo sirve |
|---|---|---|
| Radar en vivo | ¿Quién está paseando ahora? | Hora punta, cuando ya hay densidad |
| **Coincidencia de horarios** | ¿Con quién coincido siempre? | **A cualquier hora**, incluso con la app vacía |
| Quedadas y espacios | Organicemos algo | Fin de semana, cumpleaños, ocasiones |

Un radar sin usuarios es una pantalla vacía, y ese es el estado normal al empezar en un barrio. La
coincidencia de horarios, en cambio, funciona desde el segundo usuario y **sin que nadie tenga que
estar conectado a la vez**. Es lo que hace que la aplicación sirva a las once de la noche, que es
justo cuando más solo se pasea.

---

## Estructura

```
coincide/
├── apps/
│   ├── web/          Next.js — páginas públicas de quedada, espacio y parques
│   └── mobile/       Expo — el producto: descubrir, radar, quedadas, espacios
├── packages/
│   ├── core/         Algoritmo de compatibilidad, horarios, grupos y geo. Puro
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

**El algoritmo reparte 100 puntos** entre batería (35), estilo de juego (30), tamaño (25) y círculo
de confianza (10), con vetos de seguridad por encima de la puntuación. Un veto no se compensa: da
igual lo bien que encajen en todo lo demás.

**El estilo de juego usa una matriz y toma el máximo, no el promedio.** A dos perros les basta una
forma compartida de jugar para pasarlo bien; promediar penalizaría al perro versátil, que es justo
el que mejor encaja con todo el mundo.

**La afinidad de un grupo es el mínimo par a par, no el promedio.** Un grupo vale lo que vale su
peor pareja: un promedio del 85 % puede esconder un par al 30 % que arruina el paseo.

**Los tres ejes se muestran por separado y nunca se funden en un porcentaje.** Mezclarlos
convertiría a un perro mediocre pero cercano en un "95 % compatible", que es mentirle al usuario
sobre lo único que le importa.

**El chip identifica, no localiza.** Un microchip es un transpondedor RFID pasivo: sin batería, sin
GPS y sin forma de seguirlo. Sirve como insignia de tutor verificado, y el formato válido no
demuestra que el chip exista, porque el número impreso no lleva dígito de control.

---

## Privacidad, implementada en el código

Publicar horarios de paseo es publicar la rutina diaria de una persona. Cinco reglas que viven en el
esquema y no en un documento:

1. **El horario solo se revela como coincidencia.** `schedule_matches` es `security definer`,
   comprueba que quien pregunta es el tutor del perro y devuelve el agregado —"coincidís cinco
   días"— nunca las franjas de nadie.
2. **La presencia caduca por restricción**, con un máximo de cuatro horas. Nadie queda visible en el
   mapa por olvidarse de apagar el check-in.
3. **La ubicación para notificaciones se degrada a ~1 km mediante un disparador**, no solo en el
   cliente: una garantía que depende de que todos los llamadores se acuerden no es una garantía.
4. **Los pings del collar no los lee nadie más que el tutor**, en ninguna consulta, y se purgan a los
   treinta días.
5. **El chip, el teléfono y la dirección de un espacio quedan fuera de las vistas públicas**, porque
   RLS filtra filas y no columnas.

---

## Verificación

```bash
pnpm test          # 213 tests unitarios y de integración
pnpm typecheck     # todos los paquetes y aplicaciones
pnpm --filter @coincide/web e2e   # 42 casos en Chromium, dos viewports
node scripts/screenshots.mjs       # capturas en claro, oscuro y sistema
```

Los 22 tests de RLS están escritos como **intentos de acceso indebido**: leer las políticas y darlas
por buenas no demuestra nada. Los 13 de paridad comparan el cálculo de SQL con el de TypeScript
sobre las mismas entradas, para que servidor y cliente no puedan dar respuestas distintas a la misma
pregunta.

Los 42 casos de navegador incluyen auditoría de accesibilidad con axe en las cuatro páginas,
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
- **Feed social, grupos, chat y verificación de identidad.** Fase 2.
