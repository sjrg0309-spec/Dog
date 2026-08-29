# Las fotos del feed

Aquí van las fotos de las publicaciones de la semilla. **La carpeta puede estar
vacía**: lo que falte se dibuja con la escena generada de `lib/artwork`, que es
el respaldo honesto de siempre. Lo que cambia al poner un fichero es que esa
publicación pasa a enseñar una foto de verdad.

Para enchufar una: deja el `.jpg` aquí con el nombre exacto de la tabla y
descomenta su línea en `lib/photos.ts`. Metro resuelve los `require` al
empaquetar, así que hay que nombrarlos uno a uno; a cambio, un fichero que falta
se ve al compilar y no en la pantalla de alguien.

## Qué tiene que salir en cada una

El guion no es libre: cada foto tiene ya escrito su texto alternativo en
`lib/posts.ts`, y ese texto **es** el encargo. Si la foto no enseña lo que dice
el alternativo, quien la escuche con un lector de pantalla recibe una mentira.

La raza y el pelaje tampoco son libres: son los del animal en `lib/data.ts`, y
el retrato ilustrado del avatar sale de ahí. Una Nina border collie en el avatar
y un labrador en la foto es la misma publicación contándose dos cosas.

| Fichero             | Animal                             | Qué pasa                                                        | Cuándo                            |
| ------------------- | ---------------------------------- | --------------------------------------------------------------- | --------------------------------- |
| `nina-pelota.jpg`   | Nina, border collie blanca y negra | De pie en la hierba, con la pelota en la boca, mirando a cámara | 7:40, luz rasante de primera hora |
| `nina-carrera.jpg`  | Nina                               | Volviendo corriendo con la pelota, orejas hacia atrás           | La misma mañana, mismo parque     |
| `nina-sentada.jpg`  | Nina                               | Sentada delante de la pelota, esperando a que se la tiren       | La misma mañana, mismo parque     |
| `toby-charco.jpg`   | Toby, mestizo marrón               | Empapado, saliendo de un charco de un camino de tierra          | Día nublado, luz plana            |
| `toby-sacudida.jpg` | Toby                               | Sacudiéndose el agua, gotas saliendo disparadas                 | El mismo rato, mismo parque       |
| `rocky-sombra.jpg`  | Rocky, galgo español               | Tumbado y estirado a la sombra de un plátano, parque vacío      | 11:00                             |
| `kira-sombra.jpg`   | Kira, bulldog francés              | Sentada jadeando en una sombra, con el sol duro justo al lado   | Mediodía de calor                 |
| `bruno-noche.jpg`   | Bruno, pastor alemán cachorro      | Sentado bajo el cono de luz de una farola, calle vacía          | 23:00                             |

**Las tres de Nina y las dos de Toby son carruseles**, así que tiene que ser el
mismo perro y el mismo sitio en todas. Generándolas, la forma de conseguirlo es
hacer la primera y pasarla como imagen de referencia para las siguientes; a
pelo, salen cinco perros distintos.

## Formato

Vertical **4:5** —es la proporción que usa `PostCard`, y recortar un 3:4 o un
cuadrado descoloca al sujeto—, y foto de móvil de alguien paseando a su perro:
luz natural, encuadre imperfecto, sin estudio ni pose. El feed es de vecinos,
no un catálogo.
