# Configuración de comunidad · Vesper 2.8.0

Todos los módulos de esta fase comienzan desactivados. Configura primero los
canales y roles en un servidor de prueba y actívalos al final.

## Permisos del bot

Vesper necesita estos permisos en los canales correspondientes:

- Ver canal, enviar mensajes, insertar enlaces y leer historial.
- Adjuntar archivos para guardar transcripciones.
- Añadir reacciones para las sugerencias.
- Gestionar canales para crear y cerrar tickets.
- Gestionar roles para los permisos privados de tickets y los autorroles.

El rol de Vesper debe estar por encima de todos los autorroles. No concedas
Administrador si puedes asignar los permisos concretos.

## Tickets

Ejecuta `/vesper-comunidad tickets` y selecciona:

- `panel`: canal público donde se ofrecerá el botón.
- `categoria`: categoría donde se crearán los canales privados.
- `transcripciones`: canal privado visible solamente para el equipo.
- `staff` y `accion_staff`: uno o varios roles de soporte.
- `max_abiertos`: entre 1 y 5 tickets simultáneos por miembro.
- `activo`: verdadero.
- `publicar`: verdadero cuando quieras enviar un panel nuevo.

Un ticket cerrado queda bloqueado para el solicitante y se renombra. Vesper no
lo elimina automáticamente: el equipo conserva el control de la retención. La
transcripción contiene hasta 500 mensajes, fechas y enlaces de adjuntos. Si el
canal de transcripciones no está disponible, se adjunta dentro del propio ticket.

Los miembros también pueden usar `/ticket abrir`, `/ticket estado` y
`/ticket cerrar`.

## Sugerencias

Configura `/vesper-comunidad sugerencias` con un canal y activa el módulo. Los
miembros publican con `/sugerir`. Vesper crea los votos 👍 y 👎.
Cada miembro tiene una espera de 60 segundos entre sugerencias.

Para revisar una propuesta, copia el ID del mensaje y usa
`/vesper-comunidad revisar_sugerencia`. El embed mostrará el estado y la nota
del equipo sin mencionar al autor.

## Autorroles

Usa `/vesper-comunidad autoroles accion:Añadir` para cada rol. Se requieren el
rol y la etiqueta; emoji y descripción son opcionales. Hay un máximo de 25.

Después activa el módulo y ejecuta la misma orden con
`accion:Publicar panel`. Seleccionar un rol lo alterna: lo añade si falta y lo
retira si el miembro ya lo tiene. Vesper vuelve a comprobar su jerarquía en
cada interacción.

## Starboard

En `/vesper-comunidad starboard` configura canal, umbral de 2 a 50 y emoji.
Puedes excluir canales. El bot y el autor del mensaje no cuentan como votos.
Al caer por debajo del umbral se retira el reflejo del starboard, nunca el
mensaje original.

Para emojis personalizados puedes usar el emoji completo, por ejemplo
`<:vesper_star:123456789012345678>`.

## Panel web

La pestaña Configuración permite activar módulos y guardar canales, roles de
soporte, límites y exclusiones. La publicación de paneles de Discord se mantiene
como una acción explícita en `/vesper-comunidad`.

Las cuentas de Google autorizadas pueden configurar como propietario global;
los usuarios comunes siguen necesitando su identidad Discord y los permisos
vigentes del servidor.
