# Segundo Main temático — información necesaria

> Estado: implementado en Vesper 2.8.0. Ankerie Dimension ya está registrado
> como `themed_main`; los canales, categorías y roles restantes se eligen desde
> el panel sin copiar identificadores.

## Arquitectura recomendada

El servidor nuevo será un **Main temático**, no un segundo controlador global.
Así, Embers Void conserva en exclusiva sus comandos globales, recursos visuales
y roles internos. El nuevo servidor administra solamente su configuración,
moderación, comunidad, música y apariencia.

Perfiles previstos:

- `primary_main`: Embers Void, control global y estética actual sin cambios.
- `themed_main`: servidor Cinnamoroll, identidad propia y administración local.
- `satellite`: servidores aprobados con estilo neutral.

No se debe ampliar directamente `isMainGuild()` para aceptar dos servidores:
eso expondría controles globales y podría intentar usar en el servidor nuevo los
IDs de roles exclusivos de Embers Void.

## Datos que debe proporcionar el propietario

### Identidad y acceso

- ID del servidor nuevo.
- Nombre exacto del servidor y nombre/apodo que tendrá Vesper allí.
- Confirmación de que Vesper ya fue invitado con los scopes `bot` y
  `applications.commands`.
- Confirmación del alcance recomendado: administración local, sin controlar
  Embers Void ni otros servidores.

Con una sola aplicación de Discord sí pueden cambiar por servidor el apodo,
webhooks, embeds, paneles, colores y textos. El avatar real, nombre de cuenta y
presencia del bot son globales. Si también deben ser distintos, se necesitaría
una segunda aplicación de Discord y un segundo token administrado únicamente
por el propietario.

### Diseño Cinnamoroll

- Icono, banner, emojis y otras imágenes que se quieran reutilizar, o permiso
  para diseñar recursos inspirados en cielo, nubes, estrellas y tonos pastel.
- Paleta deseada; propuesta inicial: azul cielo, blanco, rosa suave y lavanda.
- Tono de los mensajes: tierno, tranquilo, divertido o una mezcla concreta.
- Nombre y función exactos del rol temático mencionado: decorativo, verificación,
  autorrol, acceso a canales o premio.

### Canales

Enviar los IDs existentes o indicar cuáles debe crear Vesper:

- Bienvenida y despedida.
- Reglas/verificación.
- Logs generales y logs privados del bot.
- Solicitudes de música y canal(es) de voz previstos.
- Tickets y transcripciones.
- Sugerencias y starboard.
- Alertas de TikTok, Twitch y YouTube, si se usarán.

### Roles y permisos

- Roles de propietario, administración, moderación, soporte y DJ.
- Rol de verificación y rol automático para bots, si aplican.
- Autorroles deseados: colores, países, intereses, juegos y plataformas.
- Posición del rol de Vesper: debe estar por encima de todos los roles que vaya
  a entregar o moderar.

### Comportamiento

- Módulos que comenzarán activos.
- Textos o ideas para bienvenida, despedida y reglas.
- Ajustes musicales: volumen, duración máxima, límite de cola, canciones por
  usuario e inactividad.
- Ajustes de moderación y comunidad: filtros, tickets, sugerencias y starboard.

## Datos que no se deben enviar

No hace falta compartir el token del bot, contraseñas, secretos OAuth ni la
contraseña de Lavalink. Para preparar el perfil solamente se necesitan IDs,
decisiones de comportamiento y recursos visuales.

## Entrega posterior

Con esos datos se puede implementar la versión 2.8.0 con perfiles por servidor,
tema Cinnamoroll aislado, configuración inicial, pruebas de separación y una
guía de activación sin alterar Embers Void.
