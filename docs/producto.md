# Petnav — el producto, entero

Este documento es la descripción larga del proyecto: qué decide cada pieza y
por qué. Vivía en la descripción del pull request y se mudó aquí por dos
motivos: esa descripción tiene un tope de 65.536 caracteres y lo tenía
gastado, y esto es material que se consulta mientras se lee el código, no una
vez al revisar.

La descripción del pull request se quedó con el resumen y apunta aquí.

---

Primer MVP de **Petnav**: emparejar perros por temperamento, cruzar los horarios de paseo de sus tutores y hacer que la salida ocurra. Y por encima de todo eso, una capa que puede contestar que no.

El repositorio estaba vacío, así que esto parte de cero. `main` se ha creado como tronco vacío para poder abrir este pull request.

> **Nota sobre el recorrido.** Esta rama pasó por tres formas: perros → todas las mascotas → perros otra vez. La vuelta no es un descarte: al mirar los datos, de las quince especies del catálogo solo una tiene modelo de manada, y es la que sostiene el radar, las quedadas abiertas y los espacios compartidos. El catálogo entero se quedó **debajo**, con sus reglas y sus tests; lo que se cerró fue la puerta de registro. Los commits cuentan ese camino en orden.

## La puerta, y quién entra por ella

Petnav **no tiene modo mirón**: sin animal dado de alta no se dibuja la aplicación, se dibuja el alta en su lugar — y no como ruta, porque una ruta se salta escribiendo otra dirección. Con la cuenta recién hecha se ven los **sitios** (parques, agua, sombra, veterinarios); **quién pasea ahora y a qué hora sale cada uno** piden chip verificado, porque la cara, el sitio y la hora son las tres cosas que le sirven a quien busca animales para llevárselos. Esto no impide que esa persona se registre —cualquiera escribe un nombre—; impide mirar sin dejar nada.

Quien rescata y no tiene animal propio entra por **otra puerta**: enseñando el perfil público del colectivo, con la cuenta pendiente de una revisión humana. Aprobada abre los avisos de rescate a kilómetros, y sigue sin abrir quién pasea ni los horarios de nadie.

Está en `packages/core/src/access.ts` con 38 tests, y comprobado en la pantalla por la auditoría del empaquetado. **El detalle entero, con lo que se puede verificar y lo que no, está en [`docs/acceso.md`](docs/acceso.md).**

## De quién es esta aplicación

Es la decisión que gobierna el resto. Casi todo lo que hay resuelve el problema de la persona: con quién queda, cómo llena la tarde, dónde encuentra sitio. Petnav hace eso, y además tiene una capa —`packages/core/src/welfare.ts`— que responde a la otra pregunta: **¿le conviene salir al perro?**

Cuando contesta que no, **manda**. No se compensa con una afinidad del 100 %, no se entierra en una advertencia gris y no se convierte en un "continuar de todas formas":

- El descubrimiento devuelve **lista vacía**, no la lista de siempre con un aviso encima. Una lista que sigue ahí se acaba usando.
- El botón de check-in del radar **no está**, en vez de estar desactivado. Un control en gris invita a buscar cómo activarlo.
- Las duraciones que hoy no convienen **no se ofrecen**. Enseñar "4 horas" a 30 grados y avisar debajo es proponerlo igual.
- La baraja de citas **no se reparte**. Proponer perfiles que luego habría que cancelar es peor que decirlo.
- El titular de la pantalla cambia con el veredicto. Dejar "con quién puede salir" encima de un "hoy no" es contradecirse en dos líneas, y de las dos el usuario se cree la primera.

| Qué mira | Qué hace |
|---|---|
| **Calor** | El perro aguanta hasta 26 °C, y de ahí se descuenta lo que se sepa del tuyo: hocico chato −4, sensible al calor −2, sénior −2, joven −1. Se acumulan. Para uno que ya tenía el techo rebajado el margen antes de parar es **cero**: pasarse no es estar incómodo. Y el suelo se juzga por su temperatura estimada, no por la del aire: ver más abajo |
| **Duración** | Una quedada declara los minutos de **contacto seguidos**, que no son los del evento. Ninguna puede pasarse del máximo de la especie, y encima cada perro tiene el suyo |
| **Estado** | En recuperación, con la pauta sin terminar, en celo, o con un encuentro hace un rato |
| **El grupo** | El veredicto es el del perro que peor lo lleve, igual que la afinidad es la del peor par |

El caso que lo enseña entero está en la semilla: **dos perros de la misma tutora**. A 26 °C —un día de verano corriente— Nina sale y Kira, que es bulldog francés, no. Mismo día, misma especie, respuesta distinta.

Dos consecuencias que conviene leer juntas:

- **El tutor puede endurecer los límites de su perro, nunca ablandarlos.** Quien lo conoce puede decir "el mío no aguanta ni eso". Un campo que permitiera lo contrario sería una forma elegante de que la regla no existiera.
- **El grupo ve el resultado; el motivo se queda en la ficha.** Que un perro aguante veinte minutos es información que los demás necesitan para organizarse. Que esté convaleciente, o en celo, es un dato de salud, y la vista pública publica el techo ya calculado sin decir por qué es ese.

Y está en la base de datos, no solo en el cliente: `species` guarda los límites, `pets` las circunstancias, `playdates` los minutos de contacto, y un disparador rechaza la quedada que se pase. Hay **paridad comprobada** entre el techo que calcula Postgres y el de TypeScript sobre toda la semilla: si respondieran distinto, la aplicación propondría un rato y el servidor aceptaría otro, y quien lo pagaría no es ninguno de los dos.

## Seguridad: dos radares, no uno relajado

El radar social solo se enciende dentro de una zona pet-friendly. Esa regla es correcta —es lo que lo separa de una baliza personal— y al catalogar los escenarios de emergencia apareció que **deja fuera exactamente los momentos en que hace falta ayuda**: un perro se suelta en una obra, huye de los petardos y cruza tres calles, salta la valla de una finca que no conoce. Los sitios donde el radar está apagado son justo donde importa.

La respuesta no fue relajar la regla. Son **dos objetos con reglas opuestas**:

| | Radar social | Alerta de seguridad |
|---|---|---|
| Dónde | Solo zonas pet-friendly | En cualquier sitio |
| Quién la ve | Compatibles a 2 km | Todo tutor dentro del radio |
| Caducidad | Máximo 4 h | Hasta que se resuelve |
| Precisión | Anclada al lugar | Punto exacto |

La privacidad cede en una emergencia y **solo ahí**, y quien la activa lo hace sobre su propio animal.

Lo que aporta un catálogo de doce escenarios y no una lista de tipos: **cada uno trae su radio y su crecimiento, y no son iguales.**

- Un **cebo envenenado** no se mueve: 500 m que no crecen. Ampliarlo diluiría el aviso hasta que nadie lo mirase.
- Un perro **huido por petardos** —el pico anual de animales perdidos en España— empieza en 3 km y crece 2,5 km por hora hasta 20. Un radio fijo lo dejaría fuera del aviso justo cuando más lejos está.

`alert_audience()` une a quien está presente con quien pasa por allí **a su hora habitual**, así que el aviso llega también a quien va a estar y todavía no está. Y el **último avistamiento manda sobre el punto de origen**: seguir midiendo desde donde se perdió manda a la gente al sitio equivocado.

## Solo perros, y el catálogo sigue debajo

De las quince especies, solo cinco tenían encuentros y **una sola** tiene modelo de manada. Para las otras cuatro el producto era una presentación supervisada de veinte minutos; para las diez restantes, un directorio. Eran tres productos distintos dentro de la misma aplicación.

Lo que **no** se hizo al acotarlo: borrar el catálogo. Las especies, su estado legal, sus límites de cuidado y los disparadores que impiden mezclarlas siguen donde estaban, con sus tests. Lo que cambia es qué puede registrar un tutor, y eso vive en una columna:

```sql
select id from public.available_species();  -- dog
```

Reabrir a hurones o conejos es poner `is_available` a cierto en una fila. Si se hubieran borrado las tablas, sería rehacer el trabajo entero. Mientras tanto la base sigue impidiendo lo que siempre impidió: una quedada de gatos, un animal de otra especie apuntado a una de perros, una sesión más larga de lo que aguanta la especie.

La puerta contesta **dos noes distintos y con mensajes distintos**, porque no son lo mismo:

```
ERROR: La especie Cotorra argentina está excluida: su tenencia no está permitida
ERROR: Petnav todavía no está abierto a Hurón: hoy solo funciona con perros
```

Un dragón barbudo es legal y no está abierto; una cotorra argentina no es legal. Confundirlos haría creer a un tutor que tiene un animal prohibido.

## La idea que hace que la app sirva a cualquier hora

El plan inicial giraba alrededor de un radar en vivo. Eso solo sirve en hora punta, y al empezar en un barrio la pantalla está vacía casi siempre. La pieza que lo cambia todo es el **horario de paseo declarado**: funciona desde el segundo usuario del barrio y **no exige que nadie esté conectado a la vez**.

| Motor | Responde a | Cuándo sirve |
|---|---|---|
| Radar en vivo | ¿Quién está fuera ahora? | Hora punta |
| **Coincidencia de horarios** | ¿Con quién coincido siempre? | **A cualquier hora**, con la app vacía |
| **Puntos de encuentro** | ¿Dónde quedamos, y a qué hora? | **A cualquier hora**, y sin que nadie escriba a nadie |
| Quedadas y espacios | Organicemos algo | Fin de semana, cumpleaños |
| **Feed de vecindario** | Qué pasa en mi barrio | **Los días que no se sale** |
| **Comunidad y servicios** | Quién cuida en agosto, quién coge el teléfono un domingo | También esos días |
| **SOS** | Se ha perdido, o hay algo peligroso ahí | El día que todo lo demás da igual |

Los seis responden a la pregunta del tutor. La capa de bienestar responde a la del perro, y va por encima de los seis.

## Interfaz

### Densidad: cuántas franjas hay antes de la primera foto

Es la corrección más reciente y no era de estilo, era de aritmética. Instagram enseña una foto dentro del primer cuarto de la pantalla. Esta pantalla la enseñaba pasada la mitad, porque encima había **siete franjas**: conmutador de perro, compositor, franja de alerta, dos segmentados apilados, la fila de estados y la bandeja de reels. Las tarjetas ya eran correctas —foto a sangre, cuadrada, barra de acciones debajo—; lo que fallaba era todo lo apilado encima. La cirugía fue de resta.

| Qué había encima del feed | A dónde se ha ido |
|---|---|
| Conmutador de perro, franja entera para dos nombres | A la cabecera, en 26 px con el punto del que está activo |
| Compositor con avatar, píldora y tres atajos | Al «+» de la cabecera, que es donde se busca |
| Dos segmentados apilados, ~160 px de píldoras | A dos palabras con subrayado, y el radio a un «5 km» al lado |
| Bandeja de reels, antes de haber visto nada del barrio | Intercalada después de la segunda publicación |

**El botón flotante se ha ido del todo**, y la segunda razón pesa más que la primera: un botón de 64 px con rótulo es de otra familia de interfaces, y además **tapaba la barra de reacciones de la primera publicación** —justo lo que uno quiere tocar al abrir la aplicación—. Se ve en la captura y no en el tipado.

Y la franja de alerta va a sangre y sin esquinas, en una línea. Una tarjeta redondeada flotando sobre el feed se lee como contenido, y una alerta de cebos abierta a novecientos metros no es contenido: es una barra de sistema, del mismo tipo que la franja de llamada en curso del teléfono. La forma dice de qué categoría es antes de que se lea la primera palabra.

Cinco destinos —Feed, Explorar, SOS, Mensajes, Perfil— y lo que **no** está en la barra dice tanto como lo que está: el radar, las quedadas, los espacios y publicar siguen enteros, pero se entra a ellos desde donde se piensa en ellos. Son momentos, no sitios a los que uno va.

**El feed tiene dos caras.** "Siguiendo" es lo de siempre y está vacío por definición el primer día. "Cerca de mí" enseña lo publicado dentro de un radio, siga uno a quien siga, y es lo que hace que esto sea de barrio y no de internet. El alternador va visible arriba y no en un desplegable: si no se ve la otra pestaña, no se sabe que existe. El radio recorta y **se dice cuántas publicaciones deja fuera**, porque un filtro que recorta en silencio parece un barrio vacío en lugar de un radio corto.

**Reacciones caninas.** Lamer y mover la cola son excluyentes entre sí, como en cualquier feed: sin esa regla una foto acabaría con "5 lamidos y 5 colas" de las mismas cinco personas. Ladrar va aparte porque **no es reaccionar, es compartir**, y aquí compartir carga peso de verdad: una publicación de perro perdido compartida es lo único que la saca del radio de su alerta. No se puede desladrar —retirar algo del feed de otro no está en tu mano y el botón no puede fingir que sí.

**El doble toque** deja caer un rastro de huellas desde donde cayó el dedo y pone la reacción, pero **no es la única forma de ponerla**: un gesto oculto que sea el único camino a una función deja fuera a quien navega con lector de pantalla, que no puede descubrirlo.

**El mapa ya no es un esquema**, y esa frase estuvo aquí hasta hace poco: ahora lleva calles de verdad, de OpenStreetMap y de todos los países. Cómo, y qué pasa cuando no llegan, está más abajo. Las alertas siguen siendo la única capa que no se puede apagar: un aviso de cebos que se esconde sin querer con un filtro no sirve.

**Ficha médica privada y Modo Paseo público**, y la línea entre las dos es la decisión que importa de esa pantalla: el código QR enseña **a quién llamar** y cómo manipularlo con seguridad, no el historial. Que un desconocido del parque sepa qué medicación toma tu perro no le ayuda a devolvértelo. El código lleva una URL y no los datos dentro, para poder revocarlo y para que lo lea un móvil viejo.

**La baraja de citas ya viene filtrada por el algoritmo**: un veto duro no llega a esa pantalla, así que no se puede deslizar hacia un mal encuentro porque el mal encuentro no está en el mazo. La energía va primero y en grande, que es lo que pesa 35 de los 100 puntos.

**Cada conversación dice de dónde sale** —"coincidís 5 días de 7:00 a 7:45", "estáis los cuatro apuntados", "hay una alerta abierta a 900 m"—. No es un adorno: en una aplicación donde quedas en un parque con desconocidos y sueltas a tu perro con los suyos, un chat que se abre contra cualquiera desde cualquier perfil es sobre todo un canal de acoso.

### El mapa es la pantalla

Era un cuadrado de trescientos píxeles flotando en mitad de un documento que se desplazaba: título grande, párrafo, segmentado de dos píldoras —cuatrocientos píxeles antes del primer marcador—, el mapa, los botones del alcance, dos bloques de texto y, al final, las capas. Ningún mapa que la gente use funciona así. Ahora ocupa todo, los controles van encima —capas, acercar, alejar, volver a donde estás— y la lista vive en una **hoja de dos posiciones** que se arrastra con el pulgar y nunca se cierra del todo: en la posición baja siguen viéndose el asa y las dos primeras filas, porque una hoja que desaparece es una función que nadie encuentra dos veces. Las capas se despliegan **sobre el mapa** y no en una sección al final de la página, que es donde se usaban una vez. La lista ordena por lo que hay que andar, con las alertas siempre primero.

El dibujo era la otra mitad. La retícula pasa a estar **en metros** —un cuadro cada 250 m, doblando cuando se juntan— y a un pelo muy tenue: marcada y en fracciones del cuadro no se leía como terreno, se leía como papel milimetrado. Los lugares se dibujan como **manchas con linde** en vez de alfileres, porque un parque de 250 m de radio es una superficie y un punto pierde justo lo que hace que sea un sitio al que ir. Y **la alerta pasa a ser un aro sin relleno**: se probó al 10 % y en la captura el verde del Parque Central salía gris verdoso —cualquier película sobre un disco de medio kilómetro tiñe lo que hay debajo, que es el sitio al que iba esa persona—. Un aro encierra el área igual de bien y no apaga nada.

### Calles de verdad, de todos los países

«La app debe tener datos de todos los países» mató un enfoque a medio construir, y menos mal. Lo que llevaba hecho era hornear las calles de Madrid en el paquete: unos ochenta megas de OSM para **una** ciudad, con una lista de ciudades soportadas que habría crecido de una en una y para siempre. Se tiró entero.

Lo que hay ahora son **teselas XYZ** de OpenStreetMap, que es cómo funcionan Google Maps y Waze por dentro: el mundo en imágenes de 256 píxeles, en proyección Web Mercator, pedidas por nivel y coordenada. No hay lista de ciudades porque no hace falta ninguna: el detalle en Nairobi, en Wellington o en Reikiavik es el que la comunidad haya cartografiado allí, igual que en Madrid. La aritmética vive en `lib/tiles.ts` sin una línea de React, y sus **21 tests** cruzan la proyección contra la identidad clásica `ln(tan(π/4 + φ/2))` y comprueban que salen teselas válidas en siete ciudades de cinco continentes, incluidas las dos que rompen las implementaciones ingenuas: la que está casi en el polo y la que está al otro lado de la línea de fecha.

**Y tiene que poder fallar bien**, porque un mapa que depende de la red se usa justo donde la red falla: dentro de un parque, en un pueblo, con datos agotados a final de mes. Si más de la mitad de las imágenes visibles no llegan, la capa avisa y el mapa vuelve al esquema de posiciones y distancias, que no necesita red y sigue siendo información correcta. Lo que no hace es quedarse en gris fingiendo que carga. Una sola imagen fallida no cuenta: un 404 suelto en el borde del mundo no es quedarse sin red.

Dos fallos de esta parte no se ven en ninguna captura, y son los que más importan:

- **Pedía 1240 imágenes en ocho segundos, y subiendo.** `onLoad` guardaba en estado, el estado provocaba un render, y en React Native Web un render de un `<Image>` **reinicia su carga**, que dispara otro `onLoad`. Un bucle sin fondo para seis imágenes que no cambian. El mapa se veía perfecto todo el rato; contra el servidor comunitario de OpenStreetMap eso es exactamente el abuso que su política prohíbe, y lo paga el usuario en datos. Se arregla contando en una `ref` y tocando el estado sólo cuando **cambia el veredicto**, que ocurre una vez. Ahora son ocho peticiones para ocho teselas y para.
- **Los marcadores superpuestos eran intocables.** Playwright estuvo treinta segundos intentando pulsar el Parque Central y el aviso de cebos se lo comía. El primer arreglo —desplazar 26 px— tampoco valía. El bueno es geometría: los que caen juntos se abren en anillo con radio `24 / sin(π/n)`, que es el radio mínimo para que `n` círculos de 44 px no se toquen.

La auditoría del empaquetado le levanta **un servidor de teselas de mentira** y comprueba tres cosas que ninguna captura enseña: que las direcciones son XYZ y de un nivel con sentido, que no pide más de las que se ven, y que las imágenes acaban colocadas en el DOM —que es lo que separa «las pidió» de «dibujó un mapa»—.

### Que se lea como el mapa de Snapchat

Snap Map se reconoce por cinco cosas. Cuatro se han traído; la quinta choca de frente con una regla de este producto y se ha resuelto en vez de copiarse.

**Las caras.** Los marcadores dejan de ser puntos de color y pasan a ser el retrato del perro, que es lo que hace que ese mapa se lea sin tocar nada: se sabe quién hay en el parque de un vistazo. Los retratos ya existían —los mismos del feed, de los mensajes y del perfil, deterministas por identificador—, así que la cara del mapa es la cara de todas partes. Un mapa donde alguien tiene otro aspecto que en el feed no sirve para reconocer a nadie, que es lo único que hace. Van con su nombre debajo **siempre** y no solo al elegirlas: saber que hay alguien sin saber quién no es medio dato, es ninguno.

**Dónde se colocan, que es la decisión de fondo.** En Snapchat tu Bitmoji está en tu posición exacta, y eso es justo lo que esta aplicación lleva prometiendo desde el primer día que no hace: *el radar ancla al lugar y nunca a la persona*. Copiarlo tal cual habría sido tirar la regla por una pantalla más bonita. Así que la cara se coloca **en el parque**, no en las coordenadas de quien pasea: se pierde saber en qué esquina está y se conserva todo lo demás —quién hay, dónde y con quién coincides—. Varias caras en el mismo sitio se abren en anillo con el corro que ya existía, que además se lee como lo que es: un grupo en un parque. Y el propio tutor no aparece nunca; el círculo del centro dice «estás aquí» y no lleva cara ni nombre.

**El velo sobre las teselas.** Es la mitad de por qué el mapa de Snapchat se lee tan rápido, y lo que menos se nota: su cartografía está apagada a propósito para que lo único con contraste fuerte sean las caras. Sobre el estilo estándar de OpenStreetMap —vivo y lleno de rótulos— un retrato de cuarenta píxeles compite con un parque verde chillón y con el nombre de tres calles. Se hace con una capa nuestra y no cambiando de proveedor de teselas: los cinco que se probaron están bloqueados desde este contenedor, así que un estilo nuevo no se podría comprobar y además hay que atribuirlo distinto. En oscuro el velo es más fuerte, por una limitación que conviene decir: **las teselas de OSM son siempre claras**, y un mapa nocturno de verdad necesita un estilo oscuro, que es otro proveedor y otra decisión.

**El halo de actividad**, que es el mapa de calor con la diferencia que importa: mide **el sitio**, no a las personas. Un halo sobre un parque es información agregada; un punto por persona sería otra cosa.

Y ahí saltó lo interesante. La primera versión lo pintó en el color de «en vivo» —semánticamente correcto— y en la captura salió una papilla de dos verdes sobre el verde del parque. Medirlo **desmintió el diagnóstico fácil**: la distancia entre los dos tokens era 0,230, muy por encima del mínimo del proyecto. Lo que se confundía no eran los colores sino el resultado de **componer dos discos translúcidos apilados**. De ahí dos arreglos y no uno: el halo pasa a un matiz cálido que ningún terreno tiene —token `mapHeat`, con aserciones contra parque, alerta, veterinario y agua en los dos temas— y **sustituye** el relleno del parque en lugar de sumarse a él; la forma del parque la sigue diciendo su linde. El primer paso elegido para el tema oscuro resultó ser exactamente `warning`, y el test lo cazó con una distancia de cero.

**Modo fantasma**, que es lo mejor que tiene Snap Map y lo que menos se copia porque no luce en una captura: un botón en el propio mapa, a un toque, que te saca de él. Aquí **apaga de verdad** — con el modo puesto el radar no ofrece salir, así que no hay presencia que publicar. Un interruptor de privacidad que solo te esconde de tu propia pantalla es peor que no tenerlo, porque enseña a confiar en él. Los demás se siguen viendo: esconderte no debería costarte la función.

**Y un fallo de datos que todo esto sacó a la luz.** Rocky tenía escrito «Parque Berlín» encima de unas coordenadas que están a **5.495 metros** de allí, junto a Parque Central. No rompía nada mientras `placeName` fuera un rótulo suelto: un nombre siempre se pinta bien. Dejó de ser inocuo al decidir dónde se dibuja esa cara —un tutor que cruza el barrio hasta un parque vacío no vuelve a fiarse de la pantalla—. Corregido, con un test que comprueba que el sitio declarado cae dentro del radio del sitio real; ejecutado contra el dato viejo falla dando los 5.495 metros.

### Tres posiciones de hoja, un solo estado de presencia

Lo que faltaba para que Explorar fuera un mapa y no una foto de uno, dicho en tres piezas que se explican juntas.

**El mapa se arrastra y se pellizca.** El centro deja de ser la posición del tutor y pasa a ser estado de la pantalla: la persona sigue dibujada con su anillo de «estás aquí» —sin cara ni nombre, como siempre— y el cuadro se mueve alrededor. El pellizco acerca en continuo mientras dura y **cae al nivel entero más cercano** al soltar, porque una tesela escalada se ve borrosa y las calles ilegibles. Los botones de acercar, alejar y volver a donde estás siguen ahí: un gesto nunca es el único camino, y ahora una regla en `lib/interface-rules.test.ts` lo comprueba leyendo el código —si el mapa tiene un gesto, la pantalla tiene su botón gemelo—.

**La hoja tiene tres posiciones** —baja, media y entera— en vez de dos, y las tres salen de `lib/sheet-detents.ts`, que es aritmética sin React con sus tests. En la baja se ve el asa, la tira de quién está fuera y la primera fila, con el mapa entero delante; en la media cabe la lista o la ficha de lo elegido **sin perder el mapa de vista**, que es lo que Google Maps hace bien y lo que una hoja de dos posiciones no podía; la entera es la lista, con una píldora que se llama «Mapa» porque un asa no dice a dónde va. Se arrastra desde el asa y desde el cuerpo mientras no esté entera; entera, el cuerpo es la lista y se desplaza. Al soltar decide la proyección con la velocidad, como antes, ahora entre tres.

**Lo elegido tiene ficha, no fila.** Tocar un sitio abre su ficha a media altura: quién está ahí ahora en caras con nombre, cuántas alertas lo alcanzan, y **una acción principal: salir aquí**. Se ofrece solo cuando conviene —la puerta abierta, el modo fantasma apagado, el tiempo conocido y el veredicto de bienestar sin decir que no— y cuando no, en su sitio va la frase que lo explica, no un botón en gris. Salir aquí no enciende nada por su cuenta: te pone en el sitio y abre el radar, que es la única puerta para salir y la que pregunta cuánto rato. Tocar una cara abre la ficha del perro con los tres ejes por separado —temperamento, horarios, cercanía— y **sin botón de mensaje**: las conversaciones nacen de coincidir, y la ficha lo dice. Cómo llegar sale de la aplicación al mapa del sistema, con la coordenada del sitio, que ya es pública.

**Las caras se agrupan lejos y se separan cerca.** Por debajo del nivel de barrio, varias caras en el mismo parque son un globo con la cifra; tocarlo acerca y el corro las abre. No es un mapa de calor de personas —eso sigue sin existir—: es la misma regla de anclar al sitio, dibujada a otra escala.

**Y la presencia es una sola cosa.** El check-in vivía en el estado de la pantalla del radar: al salir de ella se perdía, y el feed, la fila de estados y el mapa tenían cada uno su versión. Ahora vive en `lib/presence.ts`, con la caducidad calculada al leer —como los estados—, el modo fantasma **rechazando** el check-in en vez de esconderlo, y una sola pieza visible en todas partes: la píldora «Salir ahora», que con la salida encendida pasa a ser el retrato con su anillo y el rato que queda. Está en la cabecera del feed, en la fila de estados y en la ficha de un sitio, y en los tres lleva al radar.

Lo que **no** cambia con esto: cinco pestañas, ningún botón flotante sobre el feed, las alertas como única capa que no se apaga, y la cara colocada en el parque y nunca en la persona.

### Buscar, y avisar

Faltaba lo primero que tiene cualquier mapa que la gente use: **una barra de búsqueda flotando encima**. Sin ella el mapa sólo enseña lo que caiga dentro del cuadro y no hay forma de preguntar por algo. Busca sin acentos y sin mayúsculas —nadie escribe «Bebedero de la Rosaleda» con la tilde puesta—, enseña categorías antes que el teclado, porque en una aplicación de perros lo que se busca son tres cosas, y recuerda lo último **en memoria y sin salir del dispositivo**: una lista de sitios buscados es una lista de dónde ha estado alguien y por qué.

Un fallo que encontró su propio test: buscar «veterinario» no encontraba nada, porque esa capa viene apagada y la búsqueda sólo miraba lo dibujado. Ahora busca en todo lo que hay en la zona y **enciende la capa al elegir** — sin eso, tocar un resultado cierra el buscador y no pasa nada visible, que es la peor respuesta posible a un toque.

Avisar de un peligro tiene ahora su propia hoja, con los cinco escenarios del catálogo de seguridad y el radio impreso en cada uno. Y **un paso de confirmación que faltaba**: en la primera versión un toque publicaba el aviso. Un aviso de cebos alcanza a un kilómetro de vecinos y no se puede recoger; publicarlo sin enseñar antes qué se va a publicar y hasta dónde llega incumple la regla más básica de este repositorio sobre acciones difíciles de deshacer, y era mía.

### Las reglas de plataforma, como test y no como repaso

Apple, Google y Meta coinciden en dos números —texto nunca por debajo de 11 pt, nada que se toque por debajo de 44— y en una tercera cosa que no es un número: el tamaño se elige de **una escala con nombres**, no se escribe. Las tres están ahora en `lib/interface-rules.test.ts`, que lee el código fuente.

Son reglas que se incumplen de una en una y nunca a propósito: alguien baja un rótulo a diez para que quepa en una línea, y tiene razón —cabe—. El daño no se ve en la captura, se ve en el uso, y para entonces hay cuarenta sitios así. Un repaso a ojo encuentra los de esa semana.

Lo que encontró al escribirla: **veintisiete tamaños escritos a mano**, veintitrés de ellos `11` y cuatro `13`, con una escala que iba `12, 15, 17`. El escalón por debajo de 12 no existía —el que Apple llama Caption 2 y Material `labelSmall`— y **un escalón que no está en la escala no se salta: se improvisa**, veintitrés veces, cada una decidida por su cuenta. El arreglo no fue reescribir veintitrés sitios sino añadir el escalón que faltaba; los cuatro `13` se doblaron al `12` que ya había, porque cuatro usos no justifican un peldaño nuevo.

La regla del mínimo cambió de sitio a la vez: se comprueba **en la escala**, que es el único lugar donde se decide un tamaño, y las pantallas sólo tienen prohibido escribir números. Y la de los 44 pt admite la salida que da la propia guía —`hitSlop`, que amplía el área táctil sin tocar el dibujo—, porque un chip de filtro mide 32 en Material y eso es correcto siempre que se pueda tocar en 44.

**Y el botón atrás de Android, que no lo atendía nadie.** Tres capas se abren sobre el mapa —buscador, aviso, lista de capas— y atrás sacaba de la pestaña entera en vez de cerrar la de encima: en Android ese gesto es «deshaz esto» y lo hace todo el mundo sin pensar. Ahora cada capa registra su manejador mientras está abierta; como React Native atiende al último registrado primero, la de arriba se cierra antes que la de debajo sin que nadie coordine nada.

En web el equivalente es Escape, y ahí saltó un fallo de verdad que sólo encontró la auditoría del empaquetado: el `TextInput` de react-native-web llama a `stopPropagation()` en **todas** las pulsaciones —lo dice su propio comentario— y el buscador enfoca su campo al abrirse, así que Escape moría en el campo y no llegaba nunca. Va en fase de captura. La rama de Android no se puede ejecutar aquí y así queda dicho: lo que se prueba es que el gancho está montado y conectado al estado correcto.

**Y el empaquetador dejó de mentir.** No exporta: coge lo que dejó `expo export`. Tocar el código y empaquetar sin reexportar producía un fichero con el código **anterior**, sin una queja, y todo lo que viniera después auditaba la versión vieja — el fallo aparece disfrazado del arreglo que no funciona, y costó una vuelta entera buscando en el sitio equivocado. Ahora compara fechas y se para.

### El final del bucle: resumen de paseo e historial

Faltaba el final. El check-in del radar se apagaba y no pasaba nada: ni cuánto se estuvo fuera, ni con quién, ni si fue bien. Todo lo que la aplicación promete que aprende —«coincidís los martes, ¿lo hacéis fijo?», el 👎 que baja la afinidad— dependía de un dato que nunca se llegaba a escribir.

**Tres reglas gobiernan el historial, y las tres se romperían solas.**

1. **Un patrón se mide en semanas seguidas, no en paseos.** Tres salidas el mismo sábado no son una costumbre, son un sábado; tres martes de enero, marzo y junio tampoco.
2. **El 👍/👎 va por pareja, no por salida.** La afinidad se calcula par a par, así que una nota del paseo entero ensuciaría a los tres perros de una salida cuando el problema fue con uno, y la aplicación dejaría de proponer a dos que no hicieron nada.
3. **Un solo 👎 cancela la propuesta de paseo fijo**, aunque el patrón esté completo. Contar detecta igual de bien la costumbre buena y la mala; proponer un paseo semanal con un perro marcado como mal encuentro es insistir en lo único que el tutor dijo que no.

Las tres se comprobaron **rompiéndolas a mano**, y la primera pasada destapó un test que pasaba por el motivo equivocado: las tres salidas del «mismo sábado» estaban tan separadas que caían en grupos horarios distintos, así que nunca llegaba a contarse ninguna semana. Se juntaron dentro de la misma ventana para que quien decida sea la regla.

**Y el 👎 llega al algoritmo**, que es lo que separa esto de una pantalla bonita: `pairHistoryFrom` alimenta el `history` del descubrimiento, y son quince puntos de afinidad —suficiente para sacar a un perro de la banda en la que se propone—. Sin esa línea la valoración se guardaría, se dibujaría y no cambiaría nada de lo que la aplicación propone mañana.

**Tres cosas que no hace, y son decisiones.**

- **No hay kilómetros ni recorrido.** Es lo primero que se espera de una pantalla así y aquí sería inventárselo: lo que se registra es un check-in con su hora de entrada y de salida, no una traza de GPS. Y aunque la hubiera, un rastro guardado es exactamente lo que la regla del radar —anclar al lugar y nunca a la persona— existe para no tener. La pantalla lo dice, en vez de dejar al usuario buscando un mapa que no está.
- **No hay rachas ni medallas.** Es lo más fácil de añadir y lo que peor encaja: premiar la constancia empuja a sacar al perro un día que no le conviene para no romper el número, y esta aplicación tiene una capa entera dedicada a decir «hoy no». Un contador de rachas y un veto de calor son dos partes de la misma aplicación diciéndose que no.
- **No hay nota media del paseo**, por lo que cuenta la regla 2.

Lo que sí hay es **el único número que habla del animal**: los minutos que se estuvo fuera frente a los que se propusieron **al salir**, congelados en el registro. Releerlos con la temperatura de hoy cambiaría el pasado, y entonces el historial dejaría de servir para lo único que sirve.

**El gráfico del ritmo semanal** pone a prueba la tesis del producto en vez de repetirla: la barra maciza es lo que se sale de media cada semana y la banda hueca de detrás es lo que su tutor declaró al registrarse. Un día con banda y sin barra es el dato que más importa —lo dijiste y no fuiste—, así que **tenía que verse**, y ahí apareció el conflicto: la primera versión dejaba la banda en 1,3:1 contra el fondo, invisible; al oscurecerla hasta verse se acercó al verde de la barra hasta ΔE 10,8, por debajo del suelo incluso con visión cromática normal. Se resolvió subiendo un paso de la rampa, y el resultado no es un hexadecimal dentro de un componente sino un token nuevo —`chartTrack`— con dos aserciones por tema.

Dos fallos más salieron **solo de mirar la captura**, no del tipado: el rótulo del valor robaba alto a su columna, así que la barra más alta se dibujaba en una caja más corta que las demás y el gráfico se distorsionaba a sí mismo; y el eje ponía **L M M J V S D**, con dos columnas idénticas en mitad de la semana —en un calendario español el miércoles es X—.

Las dos pantallas viven **fuera de las pestañas**, como el chat y el visor de estados, y el historial no está en el perfil a propósito: un historial de paseos dice a qué hora sales de casa, qué días no estás y por dónde andas, y el perfil es la pantalla que más se enseña a otros.

### Estados, reels y el compositor

**Los estados caducan de verdad.** La caducidad se calcula al leer: no hay ningún proceso que borre nada, porque una regla que depende de que alguien se acuerde no es una regla. La semilla trae uno vencido a propósito y un test comprueba que no aparece —una caducidad que nunca se ve disparar en la demostración es una línea de código que nadie ha visto hacer nada—.

El visor toma la mecánica que la gente ya tiene en el dedo: barras arriba, tocar a la derecha para avanzar, mantener para pausar. Se marca visto **al abrir y no al terminar**, porque volver a encontrarte sin ver algo que ya miraste es la forma más rápida de que el anillo deje de significar nada. Y responder abre un mensaje directo, no un comentario público: la pantalla lo dice para que nadie escriba creyendo otra cosa.

**Los reels declaran en qué condiciones se grabaron**, y esa es la decisión que hace que el formato no contradiga al resto del producto.

El vídeo corto premia lo llamativo: el salto más alto, la carrera más larga. En contenido con animales eso tiene una traducción conocida —perros corriendo a mediodía en agosto, «retos» que alguien copia sin saber lo que hace—. Una aplicación con una capa capaz de decir «hoy no salgas» y a la vez un feed que reparte atención por hacer algo espectacular se contradice sola.

Así que un reel declara temperatura y superficie igual que una quedada declara sus minutos de contacto. Lo pone quien publica, con el mismo control que ya usa el resto de la aplicación, y **sale escrito siempre, no solo cuando son malas**: un dato que solo aparece cuando algo va mal se lee como una acusación. Lo grabado en condiciones que la propia app habría desaconsejado lleva etiqueta, con el motivo sacado de `assessWelfare` —el mismo juez que decide todo lo demás, así que si cambia el umbral cambia la etiqueta—. **No se esconde:** quien lo grabó no ha hecho nada ilegal, pero quien lo copia sí necesita saberlo. Y el formulario de denuncia empieza por «esto no es un reto», que es el único daño que este formato puede hacer aquí y que ningún formulario genérico recoge.

El reproductor y el visor viven **fuera de las pestañas**, en un grupo `(tabs)` que deja sitio para presentarlos por encima. Una barra de cinco iconos debajo de un vídeo vertical se come el pie y ofrece salidas donde hace falta una: cerrar. Las rutas no cambian.

**El compositor tiene tres modos** con el selector abajo, junto al pulgar, como la cámara de Instagram: arriba quedaría al otro extremo de la mano que sujeta el teléfono. La descripción del medio es obligatoria en los tres, y en un estado más todavía —dura un día, así que quien no puede verlo no tiene una segunda oportunidad—. Al cambiar de modo se suelta el medio, porque un vídeo no vale para una publicación de foto y arrastrarlo daría el error al publicar en lugar de al elegir.

**Actividad va separada de mensajes** a propósito: una reacción ya ocurrió, un mensaje es alguien esperando respuesta, y aquí lo segundo puede ser «he visto a tu perro cruzando la calle». Lo accionable —un avistamiento, una vacuna vencida— va arriba y separado. La lista no trae ni un motivo inventado para volver: nada de «hace tres días que no publicas». Todo lo que hay lo ha hecho una persona.

**Guardados es la única colección privada** del perfil, y la pantalla lo confirma: guardar no avisa a quien publicó, y no hay contador de cuánta gente ha guardado una foto porque no le corresponde a nadie.

### La ilustración se genera

El feed **se veía muerto**, y el motivo no era el estilo: no había ni una imagen. Cada tarjeta era un rectángulo gris con el texto alternativo dentro, y una aplicación de fotos sin ninguna foto no se ve austera, se ve rota.

La razón para no meter fotos era buena y sigue en pie: las imágenes de archivo de perros que no son de nadie tienen dueño, y un feed lleno de ellas se ve como una maqueta. La salida no era rendirse, era **dibujar**. Lo que hay ahora es obra original generada, y tres reglas la hacen servir de algo en lugar de ser un adorno:

1. **Determinista por animal.** El mismo perro sale siempre igual y dos vecinos salen distintos. Si cambiara entre recargas dejaría de servir para reconocer a nadie, que es lo único que hace.
2. **La hora manda en el color.** Una publicación de las 7:40 tiene cielo de amanecer y una de las 23:10 tiene luna y estrellas. Esta aplicación gira entera alrededor de a qué hora se pasea; el dibujo lo dice sin una palabra.
3. **Con los colores del producto.** Salen de las mismas rampas OKLCH que la interfaz. No es una paleta de ilustración aparte, que es lo que hace que un dibujo se vea pegado encima.

El perro se compone por partes —cuerpo, patas, cabeza, morro, oreja, cola— y no de un trazado congelado: así las proporciones son parámetros y un galgo y un bulldog salen del mismo código con dos números distintos. Lo que la ilustración **no** hace es pasar por una foto: el texto alternativo sigue siendo obligatorio y describe lo que el tutor dice que hay en la imagen, y cada una lleva escrito «ilustración generada».

**Y movimiento**, que era la otra mitad de por qué se veía apagado. Entrada escalonada de las tarjetas, rebote al reaccionar y pulso en quien está fuera ahora. La regla del proyecto sigue intacta: **el pulso es el único movimiento continuo**, y por eso significa «en vivo»; los otros dos ocurren una vez y se acaban. Los tres respetan movimiento reducido y ninguno esconde información.

### Los idiomas de Meta, con la paleta de aquí

Se toman los **patrones de interacción** de Instagram, WhatsApp y Facebook, no su marca ni sus colores: además de ser suyos, el verde de WhatsApp y el azul de Facebook no pasan los tests de contraste de esta paleta, y el degradado rosa y morado de las historias tampoco.

**Instagram**, en el feed y en el perfil. Cabecera con el wordmark a la izquierda y actividad y mensajes a la derecha, en ese orden porque la actividad es lo que te ha pasado a ti y los mensajes lo que alguien te está diciendo. Anillo en degradado para lo que no has visto y aro apagado para lo visto, que es lo único que hace útil una fila de historias. Barra de acciones con **guardar solo a la derecha, separado**: es la única acción de esa fila que no ve nadie más. Debajo, el resumen, la firma y «ver los N comentarios» en ese orden, que es como se lee una publicación pasando el dedo deprisa.

El perfil lleva retrato y tres cifras arriba, destacados, pestañas y cuadrícula. La ficha médica va **detrás de una pestaña** y no a continuación: es privada, y esta es la pantalla que más se enseña a otros.

**WhatsApp**, en los mensajes. Hora arriba a la derecha, globo de no leídos, doble check en la vista previa del propio mensaje. En la conversación: fondo propio, pastilla de fecha flotando, burbujas con pico, hora dentro, y el nombre solo en el primer mensaje seguido de cada persona. El compositor en píldora con el clip dentro y un botón que cambia de micrófono a avión según haya texto, que es lo que evita un botón de enviar apagado ocupando sitio todo el rato. El azul del doble check **solo cuando está leído**: confundir «llegó» con «lo ha visto» vacía de sentido el único icono que la gente mira de verdad en un chat.

Dos cosas de esa pantalla se rehicieron después, y ninguna era de color. **No había ni una cara**: cada fila llevaba un icono de categoría dentro de un círculo gris, así que cuatro conversaciones distintas se veían idénticas y la lista se leía como una bandeja de notificaciones del sistema; ahora cada hilo lleva sus retratos, con el mismo identificador que el feed y el perfil. Y **la barra de pestañas seguía debajo del chat**, robando sesenta y cuatro píxeles al teclado y ofreciendo cuatro salidas donde solo hace falta una, así que la conversación pasó a `app/chat.tsx`, fuera del grupo de pestañas.

Dentro del hilo: la conversación **se pega abajo** —dos mensajes colgando del techo con seiscientos píxeles de hueco era lo primero que cantaba—, **cada persona tiene su color** en un grupo, y el pico va **solo en el último de cada tanda**, porque una columna entera de burbujas con pico parece una lista de mensajes sueltos y no alguien hablando seguido.

En la lista, el título grande y el segmentado de dos píldoras pasan a **buscador y chips**. El buscador busca también dentro de los mensajes: quien busca «cristales» se acuerda de lo que le dijeron, no de quién. El motivo de cada hilo no se ha quitado, se ha movido: un icono junto al último mensaje, y el texto entero en la cabecera de la conversación, que es donde hace falta —justo antes de escribir—.

**Facebook**, en el compositor. Avatar, pregunta en píldora y tres atajos. Funciona porque no pide nada —abre una conversación, no un formulario— y porque la pregunta nombra al perro, que es de quien va a ir la foto. Ese compositor **ya no vive encima del feed**, por lo que cuenta la sección de densidad: se entra a él desde el «+» de la cabecera, con la pregunta y los atajos intactos.

Dos cosas que probé y no funcionaron, corregidas antes de entregar: rellenar el icono de la pestaña activa como hace Instagram convierte el globo de mensajes en un borrón, porque Lucide son trazos y no siluetas —va una pastilla detrás, que además sobrevive a una captura en blanco y negro—; y esa pastilla se pintaba también en SOS al haber una alerta abierta, así que dos pestañas parecían la actual a la vez.

### Sistema visual

**Iconos: Lucide**, y solo Lucide, con un único punto de entrada por aplicación. Es la única librería candidata con puerto oficial a React Native, así que web y móvil comparten trazo y rejilla en lugar de mezclar dos sistemas.

**Componentes: Radix UI en la web.** Este proyecto **no usa Tailwind**, así que shadcn/ui no era instalable tal cual: shadcn *es* Radix más Tailwind. Se tomó la mitad que hace el trabajo. En React Native no corre ninguna de las librerías habituales —todas son DOM—, así que allí hay una capa de primitivas propia sobre los mismos tokens.

**La paleta PAWNET, con dos conflictos resueltos a la vista y no en silencio.**

La especificación pedía "Plus Jakarta Sans o Inter". Inter está en la lista de bloqueantes de este proyecto desde el primer día, así que se tomó la otra. El cuerpo se queda en Atkinson Hyperlegible, que es la que sostiene el texto largo leído de pie, en la calle y a contraluz.

Los hexadecimales funcionan como relleno con carbón encima y **fallan como texto**: blanco sobre terracota da 2.95 y terracota sobre hueso 2.76. Así que se tomaron como **anclas de matiz** dentro de rampas OKLCH y se colocaron donde sí pasan AA. Un test comprueba que las cinco anclas siguen cayendo exactas:

| ancla | hex | paso |
|---|---|---|
| Terracota | `#E07A5F` | `terracotta[500]` |
| Salvia | `#81B29A` | `sage[400]` |
| Hueso | `#FAF7F2` | `bone[50]` |
| Ámbar | `#F2CC8F` | `amber[300]` |
| Carbón | `#2B2D42` | `ink[800]` |

Y traía un fallo dentro: terracota `#E07A5F` está en matiz 36 y el rojo de extraviados `#E76F51` en matiz 35. **Un grado.** El color de marca y el aviso de perro perdido se habrían pintado igual. El rojo baja de matiz y sube de croma hasta separarse, y salvia pasa a ser el primario para que la acción no se parezca a la emergencia.

Eso obligó a añadir **la métrica que faltaba**: el ratio WCAG mide luminancia, así que da por idénticos dos matices opuestos con la misma claridad. `oklabDistance` sí ve el matiz, y hay aserciones de que marca, en vivo y extraviado se distinguen en los dos temas.

## El tiempo, y lo que de verdad quema

Lo que quema no es el aire, es el suelo. La regla que había era «asfalto y 28 °C o más, se para», y usaba la temperatura del aire para hablar de una superficie cuya temperatura depende sobre todo del sol. Acertaba de media y fallaba en los dos casos que importan: paraba de más una noche de agosto, y **de menos un mediodía despejado de abril**, cuando el asfalto ya pasa de cincuenta grados con el aire a 24.

Con la radiación solar sí se puede estimar la superficie, con el coeficiente de las tablas de quemaduras en almohadillas. El umbral se fija **por debajo** del daño documentado a propósito: la estimación tiende a quedarse corta, y en una función que decide si un animal pisa algo que quema, el error caro es el optimista. La comprobación que sí es fiable —la mano en el suelo siete segundos— viaja con el veredicto y no en una pantalla, para que no se pierda la primera vez que alguien reutilice el dato.

**La coordenada sale redondeada a ~1,1 km.** La coartada no es la buena voluntad: el modelo trabaja en una rejilla de kilómetros, así que la precisión de más devuelve el mismo número y solo le cuenta a un tercero dónde está exactamente una persona, cada cuarto de hora, todos los días. Es el mismo redondeo que ya usa `device_tokens.coarse_point`, y mantenerlos iguales es deliberado: dos redondeos distintos para el mismo fin acaban siendo uno que alguien afloja sin darse cuenta.

## Puntos de encuentro

El proyecto ya sabía decir que dos personas coinciden. Eso deja el último paso al usuario —escribirle a alguien, proponer un sitio, negociar la hora— y el último paso es el que no ocurre. `packages/core/src/meetups.ts` lo resuelve entero: cruza las rutinas, agrupa a quienes salen a la vez y **al mismo ritmo**, y elige dónde quedar.

El caso que lo motiva es el de quien sale a correr a las seis de la mañana. A esa hora no hay radar que valga, porque no hay nadie conectado, y tampoco hay parque habitual que compartir, porque quien corre sale a la calle. Lo único común es la rutina.

- **El sitio se elige por la peor caminata, no por la media.** Mismo principio que la afinidad de grupo. Un centro geométrico minimiza la suma y puede dejar a uno andando el triple que el resto; ese es el que deja de venir a la tercera semana, y entonces el grupo se deshace.
- **Se queda en un sitio, no en una coordenada.** El punto medio de cuatro casas cae en mitad de una calle o en un portal ajeno, así que los candidatos son los lugares del catálogo.
- **El ritmo no se mezcla.** Quien corre a las seis y quien pasea a las seis coinciden en el reloj y no en el plan: juntarlos significa que uno de los dos no hace lo que iba a hacer.
- **Y alguien mira al otro extremo de la correa.** Un perro de energía media no entra en una carrera aunque su tutor la haya declarado de buena fe —él sí corre—.

Cuando un grupo no encaja se afloja **soltando a alguien**, nunca bajando el listón: primero a quien rompe la afinidad, y si el problema es la distancia, a quien vive más lejos. Es la diferencia entre proponer un encuentro peor y proponer uno más pequeño.

**Las casas entran para calcular y no salen.** Una propuesta lleva el lugar, la hora y quiénes; la caminata solo se le enseña a quien es suya, porque «Marta está a 300 m del parque» es aproximadamente el portal de Marta.

## Privacidad, escrita en el esquema

- `schedule_matches` es `security definer` y devuelve **solo el agregado** —"coincidís cinco días"—, nunca las franjas de nadie.
- La presencia caduca **por restricción**, máximo cuatro horas.
- La ubicación para notificaciones se degrada a ~1 km **mediante un disparador**: una garantía que depende de que todos los llamadores se acuerden no es una garantía.
- Los pings del collar no los lee nadie más que el tutor, y se purgan a los 30 días.
- Chip, teléfono y dirección de un espacio quedan fuera de las vistas públicas, porque RLS filtra filas y no columnas.
- El contador de una comunidad es público; **la lista de sus miembros no**.
- Las circunstancias de salud de un perro **no salen de su ficha**; lo que se publica es el techo ya calculado, y el Modo Paseo enseña el teléfono, no el historial.
- El punto exacto solo se publica en una alerta de seguridad, sobre el propio animal, y hasta que se resuelve.

## Cuatro cosas que se dicen en vez de aparentarse

**El chip no localiza.** Es un transpondedor RFID pasivo: sin batería, sin GPS y sin forma de seguirlo. Sirve como insignia de tutor verificado. El formato válido tampoco demuestra que el chip exista, porque el número impreso no lleva dígito de control.

**Ni Fi ni Tractive publican API para terceros** — verificado, no recordado. La capa de adaptadores declara ese estado en lugar de fallar en silencio; hoy funcionan el GPS del teléfono y una ingesta genérica por webhook firmado.

**El clima lo consulta la aplicación, y si no puede, no propone nada.** `packages/weather` pregunta a Open-Meteo por la celda donde está el tutor. Se elige ese proveedor por tres motivos concretos: no pide clave —un secreto dentro de una app instalada no es un secreto, y esconderlo obligaría a montar un servidor intermedio solo para consultar la temperatura—, responde con CORS abierto, y da radiación solar. Cuando la consulta falla no hay temperatura por defecto en ningún camino: la pantalla dice que no lo sabe y ofrece ponerla a mano. Un número inventado delante de una función que puede decir «hoy no salgas» convierte una decisión en una casualidad, y encima sin que se note.

**Los umbrales no son criterio veterinario.** Son umbrales prudentes de la propia aplicación, pensados para no proponer de más. El aviso está escrito en la pantalla de SOS: ante un envenenamiento o un atropello, la llamada va antes que la aplicación.

## Verificación

**576 tests unitarios y de integración**, más **62 casos en Chromium** y **58 capturas de teléfono** en claro y oscuro sin errores de consola.

- La simetría del algoritmo se comprueba sobre 1000 pares generados de forma determinista: si A ve a B como buen match y B no ve a A, el usuario percibe un fallo imposible de explicar.
- Los **30 del catálogo de seguridad** no comprueban que las funciones "funcionen": comprueban que el catálogo siga diciendo lo que decidimos que dijera. Un radio mal puesto ahí no rompe ninguna pantalla y sin embargo manda un aviso de perro perdido a media manzana.
- Los **88 de color** incluyen los cinco anclajes de PAWNET exactos, la distancia OKLab entre significados que no pueden confundirse, y que hueso y carbón sigan siendo cálido arriba y frío abajo.
- Los 22 de RLS están escritos como **intentos de acceso indebido**. Leer las políticas y darlas por buenas no demuestra nada.
- Los 13 de bienestar en la base comprueban que una quedada no puede proponer más contacto seguido del que aguanta la especie, e incluyen la paridad SQL/TypeScript de los dos techos.
- Los 20 de especie comprueban las reglas **en la base de datos**; los que cubrían especies solitarias no se borraron al acotar: ahora construyen el animal con el rol de servicio, comprueban la regla y revierten.
- Los del feed comprueban que las dos pestañas son distintas de verdad y no el mismo feed con dos rótulos, que el radio recorta, y que una publicación sin coordenadas no se cuela en el vecindario con distancia cero.
- Los de **estados** comprueban la caducidad desde fuera —el borde son exactamente 24 horas, y el vencido de la semilla no aparece—, y que el carrete abre por el primero sin ver y no siempre por lo mismo.
- Los **21 del mapa** comprueban la proyección Web Mercator contra su identidad matemática y que salen teselas válidas en siete ciudades de cinco continentes, con los dos casos que rompen las implementaciones ingenuas: cerca del polo y al otro lado de la línea de fecha.
- Los **10 del buscador** comprueban que encuentra sin acentos y sin mayúsculas. Uno de ellos me corrigió a mí: había escrito que la ñ debía conservarse, y no —quien busca «Logroño» escribe «logrono», y plegarla es lo correcto en un buscador aunque sea incorrecto en cualquier otro sitio. Queda documentado como decisión y no como descuido.
- Los **34 del historial de paseos** cubren las tres reglas de arriba y el paseo que cruza la medianoche, que aquí sale gratis —los extremos son instantes y no horas de pared, al revés que un horario semanal—. Las tres reglas se validaron rompiéndolas a mano, y esa pasada encontró que uno de ellos pasaba sin llegar a comprobar lo que decía su nombre.
- Los **2 de quién está fuera** comprueban que el sitio que declara cada perro existe y que cae dentro de su radio. Es el que encontró los 5.495 metros de Rocky, y el tipo de fallo que solo aparece cuando un rótulo pasa a decidir dónde se dibuja algo.
- Los **3 de reglas de interfaz** no prueban código: leen el código. Que la escala tipográfica entera llegue al mínimo de las guías, que ninguna pantalla escriba un tamaño a mano, y que nada que se toque baje de 44 pt contando el `hitSlop`.
- Los de **reels** comprueban que un vídeo grabado a 19 °C sobre hierba no lleva etiqueta, que uno a 33 °C sobre asfalto sí y explica por qué, y que el etiquetado **no lo esconde**: sigue en la lista.
- Los de la **ilustración** no comprueban que dibuje bonito: comprueban que el mismo animal salga siempre igual, que dos vecinos salgan distintos, que dos publicaciones del mismo perro no sean la misma imagen, y que la hora mande en el cielo.
- Y que **ninguna publicación esté por delante del reloj**: al anclar las horas de la semilla a horas de paseo reales, abrir la aplicación antes de esa hora ponía la publicación en el futuro y la tarjeta decía «ahora» para algo que no había pasado.
- Los de navegador incluyen auditoría con axe en las cuatro páginas, teclado, foco, temas, movimiento reducido y ausencia de desbordamiento a 320 px.
- Los **47 de clima** son la verificación que sustituye a la que no se pudo hacer: el adaptador no se ha ejecutado contra Open-Meteo desde este contenedor, así que están escritos contra su especificación OpenAPI, y **la mitad son respuestas rotas**. El caso que justifica validar campo a campo: una temperatura ausente colada como `undefined` sale por el otro lado como `NaN`, y `NaN > techo` es **falso**, así que la aplicación diría que hace buen tiempo. Un dato roto tiene que parecerse a no tener dato.
- Los **26 de puntos de encuentro** incluyen el que comprueba que **ninguna coordenada de casa aparece en la salida**, repetido además en la capa de la aplicación: el algoritmo lo cumplía y el envoltorio lo había perdido.

**El hueco que dejaba pasar los fallos: los tests no se typechequeaban.** El `tsconfig.json` de los cinco paquetes excluye los `*.test.ts` —no se empaquetan— y vitest no comprueba tipos, así que **nadie los miraba**. El efecto se vio entero de golpe: la tabla que decide qué animal aguanta cada ritmo estaba escrita con niveles de energía que no existen en este código, de modo que la función devolvía `false` para todos los perros reales y la funcionalidad no habría propuesto nada nunca, en silencio, mientras veintiséis tests decían que sí. Pasaban porque construían los animales con los mismos valores inventados. Ahora hay un `tsconfig.test.json` por paquete y `typecheck` los incluye; `build` los sigue excluyendo.

Ese typecheck nuevo destapó **dos tests de base de datos que llevaban tiempo pasando por el motivo equivocado**. Uno afirmaba que el radar deja fuera a quien está a seis kilómetros comparando contra un identificador inexistente: `not.toContain(undefined)` se cumple siempre. El otro es peor porque es de seguridad —comprobaba que un tutor no puede apuntar a una quedada un animal ajeno— y el `insert` fallaba por una restricción de no nulo en lugar de por la política. Un test de seguridad que pasa por el motivo equivocado afirma que algo está protegido sin haberlo comprobado nunca. Ahora usa identificadores reales y comprueba la garantía —que la fila no existe— en vez de un mensaje concreto, que ataría el test a qué capa rechaza primero.

Y un tercero, de privacidad: la capa de la aplicación devolvía el objeto entero de cada vecino, **con su casa y su horario completo**. El algoritmo del núcleo tiene su propia comprobación de que no filtra coordenadas; esta capa la había perdido al envolverlo, que es exactamente donde se pierden estas cosas.

**Fallos reales que salieron de la validación y están corregidos.** Un test nuevo encontró que cinco escenarios de seguridad tenían un radio máximo mayor que el inicial con crecimiento cero, así que **el tope era inalcanzable**: se leía como "esto puede llegar a un kilómetro" cuando el aviso se quedaba en quinientos metros para siempre.

Y del dibujo salieron dos más que solo se ven **renderizando**, no leyendo el código. Los `id` de un degradado SVG son globales al documento, así que con dieciséis escenas en la misma pantalla —y el feed son justo eso— todas referenciaban el mismo y **heredaban el cielo de la primera**: todas salían con el mismo azul, incluidas las de medianoche. Y el fondo del retrato se derivaba del propio pelaje, así que un perro claro desaparecía dentro de su círculo; ahora cada pelaje lleva su fondo elegido para contrastar. Un tercero, de consola: `accessible={false}` en el SVG se reenvía al DOM y no es un atributo booleano de HTML.

Y una tanda que solo se ve mirando las capturas, no el tipado: el reproductor de reels llevaba su cromo en blanco sobre el fondo del tema, así que en claro no se leía nada; el radio de 7 km de la alerta de petardos teñía de rosa el cuadro entero del mapa; una publicación hecha donde estás decía «a 0 m»; el botón flotante tapaba la barra de reacciones de la primera publicación; y la insignia EN VIVO colgaba por debajo del retrato y tachaba el nombre del perro.

Y uno de la propia suite: el test del selector de tema **contaba pulsaciones de flecha** y daba por hecho dónde caía el foco, así que fallaba una de cada varias ejecuciones y solo con la suite entera en paralelo —la peor forma de fallar que hay—. Ahora baja hasta la opción buscada y comprueba que la tiene enfocada antes de pulsar. Antes de eso se corrigieron el solapamiento de la cabecera a 375 px, el enlace de marca sin nombre accesible, un margen de calor demasiado generoso para un hocico chato, los tipos de `styled-jsx` resolviendo la copia de React equivocada, y un `next lint` que **nunca llegó a ejecutarse** porque sin configuración de ESLint abría un asistente interactivo. La propia suite se arregló dos veces más: los tests de integración compartían base de datos en paralelo, y el reparto del coste tomaba participantes de la semilla.

## Cómo verlo sin el repositorio

Los dos servidores levantan y responden: `next start` sirve las cuatro rutas de la web en `:3000` con 200 contra la base local, y Expo sirve la aplicación en `:8081`. Lo que no hay es **ningún puerto abierto hacia fuera** del contenedor donde se construyó esto, así que esas URL no le sirven a nadie que no esté ahí dentro. Las veinticuatro capturas de `artifacts/screenshots/` de la web —cuatro rutas × dos anchos × tres temas— están tomadas contra ese servidor en marcha, no contra un render de prueba. Y para la aplicación, `scripts/build-tour.mjs` captura veinte pantallas de la aplicación corriendo —en claro y en oscuro— y `scripts/build-tour-page.mjs` las empaqueta en una página autocontenida que se abre en cualquier navegador, con teclado, flechas y deslizar.

`scripts/post-shot.mjs` hace lo mismo para una sola publicación: las capturas de pantalla completa la cortaban, porque una tarjeta con ilustración, barra de acciones, resumen, firma y conversación no cabe en 844 px de alto.

Y `scripts/build-app-artifact.mjs` empaqueta el export web de Expo entero —bundle comprimido y tipografías incrustadas— en **una sola página autocontenida** que se abre en el navegador de un teléfono, con las cinco pestañas navegables. `scripts/check-app-artifact.mjs` la audita antes de publicar: la sirve por HTTP, recorre las pestañas, comprueba que la petición de clima se emite con la coordenada ya redondeada, le sirve un mapa de mentira para contar cuántas teselas pide de verdad, comprueba que Escape cierra el buscador, recorre la cadena entera del historial —mapa → radar → historial → resumen de un paseo— y busca filas de enlace desmontadas en columna —el fallo de `Link asChild` en web, que llevaba puesto en cinco pantallas sin que nadie lo viera—.

Y esa auditoría se corrigió a sí misma al crecer: el recorrido del historial deja la aplicación **fuera de las pestañas**, así que la comprobación de Escape que venía después dejó de encontrar su pestaña de partida y **se saltó en silencio**, mientras el informe seguía diciendo «sin problemas». Ahora esos saltos son fallos: una comprobación que no encuentra su punto de partida no ha comprobado nada.

## Prototipo navegable

`scripts/build-demo-data.mjs` ejecuta el algoritmo real sobre las combinaciones que el prototipo permite elegir y `scripts/build-demo-page.mjs` las monta en una página autocontenida, con los tokens del producto y las tipografías incrustadas. Los porcentajes y los veredictos salieron de `calculateAffinity`, `scheduleOverlap` y `assessWelfare`, no de una tabla escrita a mano. `scripts/check-demo.mjs` lo audita en Chromium —consola, desbordamiento, controles y axe— antes de publicar.

## Lo que no se ha podido comprobar aquí

- **No hay simulador de iOS ni Android** en este entorno. El móvil se valida por typecheck, tests, build y export web, con capturas a tamaño de teléfono. Cómo se ve en un dispositivo real queda sin comprobar, y la háptica no se puede probar en absoluto.
- **No hay fotos ni vídeos reales en la demostración**, y lo que se ve en su lugar es ilustración generada, no una foto. El selector del sistema funciona de verdad —eliges del carrete y aparece—, pero la semilla no trae medios: meter imágenes y vídeos de archivo de perros que no son de nadie hace que todo se vea como una maqueta, y además esos archivos tienen dueño. La subida a almacenamiento tampoco está conectada, y la aplicación lo dice en pantalla en lugar de aparentar que se ha guardado en algún sitio.
- **La llamada real a Open-Meteo no se ha ejecutado desde aquí.** El proxy de salida bloquea su dominio, igual que bloquea a los otros cuatro proveedores que se probaron. El adaptador está escrito contra su especificación OpenAPI y probado contra ella; lo que sí se comprueba de punta a punta es que la petición **se emite y con qué** —el auditor de la app la intercepta y verifica que la coordenada sale redondeada y que se pide la radiación—. En un teléfono la red es la del teléfono y la llamada sale.
- **La rutina y la casa todavía no están en el esquema.** El ritmo de cada franja y dónde vive el tutor viven hoy en los datos de demostración. Llevarlos a la base es `pace` en `dog_availability` y `home_point` en `profiles`, esta última con RLS que la haga ilegible para terceros, como ya lo son los pings del collar.
- **No hay mapa oscuro de verdad.** Las teselas de OpenStreetMap llegan siempre claras, así que en tema oscuro lo que se puede hacer es apagarlas con un velo, no invertirlas. Un mapa nocturno necesita un estilo de teselas oscuro, y eso es elegir proveedor —con su atribución— y poder comprobarlo, que desde aquí no se puede.
- **Las teselas del mapa tampoco llegan desde aquí.** El proxy bloquea los cinco proveedores que se probaron, así que en las capturas de este entorno sale el respaldo. Lo que se verifica de punta a punta es **qué pide** la aplicación, contra un servidor de teselas de mentira. En un teléfono la red es la del teléfono.
- **El botón atrás de Android no se ha ejecutado**, porque no hay emulador. Se ejecuta la rama de web —Escape—, que es el mismo gancho y el mismo estado; eso demuestra que está montado y conectado, no que el botón físico funcione en un teléfono.
- **No hay navegación paso a paso**, y no por falta de ganas: se probaron los cinco motores de rutas candidatos —OSRM, Valhalla, GraphHopper, Mapbox y OpenRouteService— y los cinco devuelven `000` desde aquí. Además de conexión, hace falta decidir motor y si «ruta verde» va a ser una ponderación de verdad o un rótulo.
- **No se han probado push reales.** Está verificado *a quién* se avisa, contra PostGIS, con la API de Expo mockeada.
- **El pegamento HTTP de las tres Edge Functions no se ha ejecutado**: no hay Deno ni proyecto desplegado. La lógica que decide el resultado sí está probada.
- **El repositorio no tiene CI configurado**, así que este PR no trae checks: la verificación de arriba se ejecuta en local y se reporta aquí.
- **La base de datos es local**, no toca ningún proyecto Supabase existente.
- **La información legal es orientativa** y sigue en el catálogo aunque hoy no se muestre en ninguna pantalla.
