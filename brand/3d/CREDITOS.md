# Créditos de los modelos 3D — obligatorio, no cortesía

Los esqueletos y las animaciones de perro que usa InkAR **no son nuestros**.
Vienen de dos modelos de Sketchfab publicados bajo **CC-BY-4.0**, y esa licencia
permite el uso comercial y las obras derivadas **a cambio de crédito visible**.
Sin el crédito, el uso es una infracción — no un descuido de estilo.

La licencia viaja dentro de cada `.glb`, en `asset.extras`. Es fácil no verla:
nadie la vio hasta hoy, y los modelos llevan en el repo desde el 16 de septiembre.

| Modelo | Autor | Licencia | Origen |
|---|---|---|---|
| `public/models/shiba_negro.glb` | [quander](https://sketchfab.com/quander) | CC-BY-4.0 | [Animated Dog, Shiba Inu](https://sketchfab.com/3d-models/animated-dog-shiba-inu-9abfce885a834399b2c3ccaed51cd474) |
| `public/models/alaskan_malamute_dog.glb` | [striderrotk](https://sketchfab.com/striderrotk) | CC-BY-4.0 | [Alaskan malamute dog](https://sketchfab.com/3d-models/alaskan-malamute-dog-93ace661ef72455d9bcd0f8c9d4880f3) |

## Qué arrastra esto

`public/models/zero-animado.glb` es **obra derivada** del modelo de quander: le
copiamos el esqueleto, los pesos y la animación. La malla es de Zero (generada
con Meshy a partir de fotos), pero todo lo que se mueve viene de ahí. La
licencia lo permite, y **pide dos cosas**: crédito al autor e indicar que se
hicieron cambios.

CC-BY **no** es ShareAlike: el proyecto no queda obligado a abrir su código.

## Lo que falta hacer

- [ ] **Crédito visible en la app.** Un archivo en el repo no cumple la
      licencia: el crédito tiene que estar donde lo vea quien usa la obra.
      Basta una línea en ajustes o en el pie de la landing con los dos nombres
      y los enlaces de arriba.
- [ ] **Decidir si el producto puede depender de esto.** Hoy la biblioteca de
      movimiento de InkAR es, en la práctica, un modelo de Sketchfab. Si el 3D
      pasa de prueba a producto, conviene comprar o encargar un rig de
      cuadrúpedo propio: elimina la obligación de crédito, quita la dependencia
      de un archivo ajeno y permite animaciones que hoy no existen.

## Lo que hoy no hay, y hace falta

Ninguno de los dos trae un ciclo de **caminar o correr**. El shiba tiene
sentarse, sacudirse, echarse, rodar y estar de pie; el malamute tiene un galope
que no sirve como donante de pesos (su malla, de 2 080 vértices, es demasiado
tosca para copiar pesos a una de 22 000).

Importa porque la promesa de la landing es literal: *"si llevas al perro que se
murió, vuelve a correr"*. **Correr es justo lo que ninguna animación hace.**
