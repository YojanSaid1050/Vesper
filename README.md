# Vesper Bot 3.2.0

Bot de Discord para administración de servidores y notificaciones de Twitch,
YouTube y TikTok. La versión 2.8 conserva la presentación visual original con
Componentes V2, separa el servidor Main de los satélites e incorpora control
central, historial, moderación opcional, música autohospedada, funciones de
comunidad y un panel web con permisos verificados en Discord.

## Requisitos

- Node.js 24 LTS.
- Una aplicación de Discord con los intents `Server Members Intent` y
  `Message Content Intent` habilitados.
- MongoDB Atlas o una instancia compatible.
- Credenciales de Twitch o YouTube solamente para las plataformas que se
  quieran activar. TikTok no necesita token ni cuenta de proveedor.

## Instalación

```bash
npm ci
cp .env.example .env
npm run env:check
npm run deploy:local
npm start
```

Variables mínimas:

```dotenv
TOKEN=
CLIENT_ID=
MONGODB_URI=
MAIN_GUILD_ID=
```

Se recomienda además configurar `BOT_OWNER_IDS` con uno o varios IDs separados
por coma. Si queda vacío, nadie puede ejecutar operaciones globales como
`/resetalldb`.

## Main principal, Main temáticos y satélites

Configura `MAIN_GUILD_ID` con el ID de Embers Void y `THEMED_MAIN_GUILD_IDS`
con el de Ankerie Dimension. **Desde 2.8.1 los dos son Main con las mismas
funciones**: el dashboard de Discord, el centro de control, el historial, los
módulos y la configuración de identidad están disponibles en ambos, y los
comandos `scope: 'main'` se registran en los dos servidores. Lo único que no se
comparte es la personalización: cada uno tiene sus propios textos, colores y
embeds.

`APPROVED_GUILD_IDS` acepta IDs secundarios separados por coma. La lista es
cerrada por defecto: cualquier servidor no incluido queda ignorado también por
los monitores. `ALLOW_UNLISTED_GUILDS=true` existe solo para migraciones
temporales. Fuera del Main,
Vesper usa mensajes neutrales y no procesa roles, botones ni referencias
internas de Embers Void. Los módulos de los satélites se administran desde el
Main o desde el panel web.

`THEMED_MAIN_GUILD_IDS` contiene servidores con identidad propia y administración
local, pero sin acceso al control global. Esta distribución incluye
**Ankerie Dimension** (`1124871897688055818`) con el perfil **AnkeBot**. Sus
mensajes, colores, rol automático, apodo y panel pastel no modifican Embers Void.

El centro de control se abre con `/vesper-control`. Sus botones permiten revisar
la configuración, diagnóstico, módulos e historial sin mostrar credenciales.

## Configuración guiada

Ejecuta `/vesper-setup estado` dentro de cualquier servidor aprobado para ver
su progreso. El asistente permite:

- Asignar canales generales y de TikTok, Twitch y YouTube.
- Definir el canal de solicitudes musicales y el rol automático de bots.
- Activar o desactivar módulos.
- Añadir o retirar roles de gestión de redes, moderación y DJ.
- Excluir canales, categorías o roles de la moderación automática.

Solo un administrador del servidor puede modificar esta configuración.

## Panel web nativo

Vesper sirve una interfaz adaptable en `/panel` desde el mismo proceso Node.js.
No necesita WordPress, otro servidor frontend ni una base de datos adicional.
Abrir la raíz del dominio en un navegador redirige directamente al panel.

Está organizado en diez secciones, cada una con su propia pantalla:

| Sección | Qué se hace ahí |
| --- | --- |
| Inicio | Estado del bot, qué falta por configurar y monitores en pausa |
| Identidad | Nombre, avatar, colores y rol automático, con vista previa en vivo |
| Bienvenidas | Canales y editor de los embeds de entrada y salida, con vista previa |
| Avisos de redes | Cuentas vigiladas de TikTok, Twitch y YouTube, canales y rol |
| Moderación | Filtros automáticos, registro de sanciones e historial de casos |
| Comunidad | Tickets, sugerencias, autorroles y mensajes destacados |
| Música | Canales permitidos y límites de la cola |
| Módulos y permisos | Qué funciones están activas y qué roles pueden usarlas |
| Todos los mensajes | Los 38 avisos que publica el bot, editables con vista previa |
| Ofertas de juegos | Juegos gratis de Epic, sorteos y rebajas de Steam |
| Configuración | Todo lo guardado del servidor, con los IDs traducidos a nombres |
| Auditoría | Quién cambió qué desde la web |

El panel toma su color del servidor que estés editando: el acento, el modo claro
u oscuro, el nombre y el avatar de la barra lateral salen de la configuración de
ese servidor y cambian en cuanto la cambias, sin recargar.

Además incluye:

- Estado del bot y preparación de cada servidor.
- Configuración de módulos, canales, roles, música y filtros automáticos.
- Configuración web de tickets, sugerencias, autorroles y starboard.
- Publicación de paneles de tickets/autorroles y revisión de sugerencias desde la web.
- Creación y administración de advertencias y aislamientos.
- Vista privada para que cada usuario consulte únicamente sus propios casos.
- Auditoría de todos los cambios realizados desde la web.
- **Editor de embeds de bienvenida y despedida con vista previa en vivo**,
  variables (`{user}`, `{username}`, `{displayName}`, `{server}`,
  `{memberCount}`, `{userId}`) y botón para restablecer el diseño original.
  En Embers Void se conserva la estructura Components V2 y solo se editan el
  texto, el color del borde y la imagen; en Ankerie Dimension se añaden pie de
  página, imagen y miniatura.
- **Resumen completo de la configuración del servidor**, con los IDs ya
  resueltos a nombres de canal y de rol, y botón para copiarlo como JSON.
- Identidad del bot por servidor: nombre visible, avatar de webhooks, colores y
  rol automático de miembros.
- Selección por nombre de categorías, canales de texto, canales de voz y roles.
- Altas y bajas verificadas de cuentas TikTok, Twitch y YouTube.

Con `WEB_ADMIN_MODE=true`, 40 comandos administrativos y de configuración dejan
de registrarse en Discord. El código se conserva como recuperación: basta volver
a `false` y registrar los comandos. Permanecen los comandos de uso cotidiano,
moderación rápida, música, tickets, sugerencias, diagnóstico TikTok y `/panel`.
El modo reducido solo se activa si el panel y Discord OAuth tienen una
configuración válida; si falta una variable crítica, conserva automáticamente
los comandos de recuperación.

Discord es la identidad principal: Vesper vuelve a consultar la membresía,
permisos y roles del usuario al abrir cada servidor. Google es opcional y sirve
para autorizar al propietario global. Una cuenta iniciada solo con Google puede
configurar si su correo está permitido, pero debe vincular Discord antes de
aplicar sanciones.

Cuando un usuario vincula Google y Discord desde la misma sesión, la asociación
se conserva en MongoDB. En accesos posteriores puede iniciar con cualquiera de
las dos cuentas y Vesper recuperará la identidad vinculada; también puede
separarlas desde su tarjeta de cuenta. Nunca se conservan los access tokens.

Configuración mínima del panel:

```dotenv
WEB_DASHBOARD_ENABLED=true
WEB_BASE_URL=https://tu-servicio.example
WEB_SESSION_SECRET=una_clave_aleatoria_de_al_menos_32_caracteres
DISCORD_OAUTH_CLIENT_SECRET=secreto_oauth_de_la_aplicacion
```

En **Discord Developer Portal → OAuth2**, añade exactamente:

```text
https://tu-servicio.example/auth/discord/callback
```

El panel reutiliza `CLIENT_ID`; `DISCORD_OAUTH_CLIENT_ID` solo es necesario si
se usa una aplicación OAuth diferente. Para generar una clave de sesión:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Google se activa solamente si se configuran todas estas variables:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OWNER_EMAILS=correo1@gmail.com,correo2@dominio.com
```

En Google Cloud añade `https://tu-servicio.example/auth/google/callback` como
URI de redirección autorizada. Vesper solo solicita `openid`, `email` y
`profile`; no guarda el token de Google después del inicio de sesión.

Las sesiones duran 24 horas por defecto y se almacenan en MongoDB como huellas
HMAC. Las mutaciones requieren CSRF y la auditoría web se conserva durante 180
días, ambos periodos configurables.

## Permisos por capacidad

- `BOT_OWNER_IDS`: operaciones globales y acceso total al Main.
- Administrador del Main: centro de control, módulos y configuración avanzada.
- `SOCIAL_MANAGER_ROLE_IDS`: TikTok, Twitch y YouTube como respaldo global.
- `MODERATOR_ROLE_IDS` o permiso **Moderar miembros**: advertencias y timeouts.
- `MUSIC_DJ_ROLE_IDS` o permiso **Gestionar canales**: controles avanzados de música.
- Miembros: solicitudes, cola y votación de salto cuando música está habilitada.

Los roles de gestores sociales, moderadores y DJ también se leen desde la
configuración persistente de cada servidor. Los comandos sociales conservan el
permiso Administrador como valor inicial de Discord. Para que un rol gestor no
administrativo pueda verlos, habilita ese rol
en **Integraciones → Vesper → Comandos**; Vesper volverá a comprobar la capacidad
internamente al ejecutarlos.

## Plataformas opcionales

- Twitch: `TWITCH_CLIENT_ID` y `TWITCH_CLIENT_SECRET`.
- YouTube: `YOUTUBE_API_KEY`.
- TikTok: activo por defecto, sin tokens. Usa `TIKTOK_ENABLED=false` para
  desactivarlo completamente.

Si una plataforma no tiene credenciales, sus monitores se omiten y el resto del
bot continúa funcionando.

## Despliegue

El proyecto incluye un `Dockerfile` reproducible con Chromium, y
expone `/live`, `/ready` y `/health`. La disponibilidad exige Discord, MongoDB
y monitores sanos. La música solo bloquea `/ready` si `MUSIC_REQUIRED=true`.

El alojamiento queda a elección del propietario. Vesper requiere un proceso
persistente y acceso a MongoDB. La música no necesita ningún servicio extra.

## Seguridad

- Los comandos, botones, selectores y modales sensibles vuelven a validar permisos de
  administrador en cada interacción.
- Las operaciones globales requieren un propietario configurado.
- Las URLs de avatar deben usar HTTPS y no pueden apuntar a redes privadas.
- Las menciones enviadas mediante webhooks quedan restringidas a roles
  configurados.
- Los errores repetidos ponen un monitor en cooldown; no lo desactivan de forma
  permanente.
- Cada alerta se reserva mediante una clave única en MongoDB antes de enviarse.
- Los reintentos no vuelven a mencionar roles y respetan fallos temporales.
- El panel nunca expone credenciales de OAuth ni el token del bot al navegador.
- Cada acción web revalida permisos, roles y jerarquía directamente en Discord.
- Google no puede ejecutar moderación hasta que la sesión tenga Discord vinculado.
- Las sesiones rotan al completar OAuth, usan cookies `HttpOnly` y caducan en MongoDB.

## Historial y ciclo de directos

Las alertas de todas las plataformas se registran en MongoDB durante 90 días de
forma predeterminada. El historial solamente se consulta desde el Main usando
el botón correspondiente o `/vesper-historial`.

En el Main, cuando termina un directo, Vesper edita el mensaje original y añade
su duración. Los satélites conservan la alerta inicial sin exponer el historial
ni el control administrativo.

## Moderación opcional

El módulo comienza desactivado. Actívalo desde el Main y configúralo con
`/vesper-mod-config`. Incluye advertencias, timeouts, historial, invitaciones,
dominios permitidos, menciones masivas y mensajes repetidos. Las acciones
automáticas eliminan y registran; el timeout automático es opcional y no existe
autoban.

Los comandos `/advertir`, `/aislar`, `/sanciones` y `/caso` están disponibles
en todos los servidores aprobados. Cada registro recibe un ID y puede ser
consultado, resuelto, revocado, reabierto o documentado con notas internas. Al
revocar un aislamiento activo, Vesper intenta retirar también el timeout real.

Los roles de gestores, moderadores y DJ pueden definirse por servidor; el
`.env` se conserva como respaldo para instalaciones existentes.

## Comunidad

Los cuatro módulos comunitarios comienzan desactivados. Se administran con
`/vesper-comunidad` o desde la configuración web:

- **Tickets:** canales privados, roles de soporte, límite por usuario, cierre
  sin borrado automático y transcripción HTML escapada de hasta 500 mensajes.
- **Sugerencias:** `/sugerir`, votos y revisión administrativa con estado y nota.
- **Autorroles:** selector de hasta 25 roles que Vesper pueda administrar.
- **Starboard:** umbral y emoji configurables, exclusiones por canal y rechazo
  de votos de bots o del propio autor.

Los paneles interactivos de tickets y autorroles se publican explícitamente
desde Discord para evitar envíos accidentales. Consulta `COMMUNITY_SETUP.md`
para la configuración y los permisos necesarios.

## Música gratuita

La música **no necesita ningún servidor aparte**. El reproductor vive dentro
del propio bot:

| Pieza | Qué hace | De dónde sale |
| --- | --- | --- |
| `yt-dlp` | Busca la canción y da la dirección del audio | Se descarga en `bin/` al instalar |
| `ffmpeg` | Convierte ese audio a Opus, que es lo que Discord quiere | Paquete `ffmpeg-static` |
| `@discordjs/voice` | Lo manda al canal de voz | Dependencia de npm |

Esto sustituye a Lavalink, que era un servidor de Java independiente. En un
alojamiento que solo ejecuta el bot —Render, Railway y parecidos— ese servidor
nunca llegaba a existir: Vesper intentaba conectarse a `127.0.0.1:2333` contra
nada y la música no funcionaba jamás. Ahora no hay nada que levantar ni que
configurar.

Acepta búsquedas por texto, enlaces de YouTube y SoundCloud, archivos de audio
sueltos y emisoras de radio. Si una pista falla, se salta y la sesión sigue.

Si la descarga de `yt-dlp` falla durante el despliegue (una red restringida, un
corte), **la instalación no se rompe**: el bot arranca, la música queda
desactivada y lo dice con todas las letras. Se reintenta con:

```bash
npm run music:setup
```


## Pruebas

```bash
npm test          # 81 pruebas
npm run lint      # errores reales, no estilo
npm run verify:visual   # el diseño protegido no cambió
npm run qa        # las tres a la vez
```

La validación continua ejecuta lint, pruebas, verificación visual y comprobación
de sintaxis en Node.js 24.

Entre las pruebas hay una que compara el mensaje de bienvenida y el de despedida
de Embers Void, sin configuración guardada, contra el diseño original carácter a
carácter. Si alguien cambia la estructura del embed sin querer, falla.

## Planes

Los monitores no son gratis de tener encendidos: vigilar tres redes significa
preguntar cada pocos minutos, por cada cuenta, todo el día. Esa es la línea.

| | Gratis | Premium | Principal |
| --- | --- | --- | --- |
| Bienvenidas, despedidas y boosts | ✅ | ✅ | ✅ |
| Los 27 registros con canal y mención propios | ✅ | ✅ | ✅ |
| Los 38 mensajes editables y los paquetes | ✅ | ✅ | ✅ |
| Moderación, tickets, sugerencias, autorroles | ✅ | ✅ | ✅ |
| Panel web completo | ✅ | ✅ | ✅ |
| **TikTok, Twitch y YouTube** | ❌ | ✅ | ✅ |
| **Música** | ❌ | ✅ | ✅ |
| **Ofertas y juegos gratis** | ❌ | ✅ | ✅ |
| Identidad propia del bot | ❌ | ❌ | ✅ |
| Panel dentro de Discord | ❌ | ❌ | ✅ |

«Principal» son Embers Void y Ankerie Dimension, por serlo. El premium se
concede con `PREMIUM_GUILD_IDS` o desde el panel, donde solo lo ve el
propietario del bot.

Un servidor que pierde el plan **deja de consultar solo**: el corte está en los
monitores, no en la interfaz. Aunque su configuración siga diciendo que el
módulo está activo, no se hace ni una petición.

## Qué tiene cada servidor

Vesper no está pensado solo para Embers Void y Ankerie Dimension: cualquiera
puede añadirlo. Lo único que se reserva a los dos servidores de casa es lo que
cambia la cara del bot o le ocupa un canal permanente.

Lo que se reserva a los dos servidores de casa es solo lo que cambia la cara
del bot —apodo, avatar y colores propios— o le ocupa un canal permanente: el
panel dentro de Discord y los comandos de identidad (`/branding`,
`/setbotname`…). Ver la tabla de planes de arriba.

## Paquetes de mensajes

Personalizar 38 avisos a mano es una tarde entera, y dejar la mitad a medias
queda peor que no haber tocado nada. Por eso hay paquetes que los escriben
todos de golpe:

| Paquete | Tono | Paleta |
| --- | --- | --- |
| **Void** | Solemne, con ornamentos. La voz de Vesper en Embers Void | Morado profundo, negro y blanco |
| **Limones** | Cercano y con guiños. La voz de AnkeBot | Amarillo cítrico y cielo pastel |
| **Sin paquete** | Los textos originales del bot | Los colores de Discord |

Se aplican desde «Todos los mensajes» con un clic y se pueden deshacer. Después
puedes retocar los mensajes que quieras uno a uno: el paquete solo es el punto
de partida.

## Comprobar que todo funciona de verdad

```bash
npm run diagnostico
```

Prueba, contra los servicios reales y desde el propio alojamiento: los feeds de
YouTube, el token y los canales de Twitch, el navegador de TikTok, las tres
fuentes de ofertas, MongoDB y el motor de música —incluido abrir el audio y
comprobar que llega Ogg/Opus válido. También imprime las **direcciones de vuelta
que hay que dar de alta** en Discord y en Google, que es lo que causa el
`redirect_uri_mismatch` al entrar con Google.

Se puede acotar: `npm run diagnostico musica`, `npm run diagnostico acceso`.

## Todos los mensajes son editables

Cada aviso que publica Vesper —bienvenida, despedida, los registros del
servidor, los avisos de moderación, los de redes y los de ofertas— se edita
desde «Todos los mensajes» en el panel: título, cuerpo, color, imagen, pie de
página y si se muestra la imagen de perfil, con las variables propias de cada
mensaje y vista previa en vivo.

**Un campo vacío conserva el valor original.** Si no tocas nada, el bot publica
exactamente lo mismo que antes; si escribes un cuerpo, sustituye a los campos
del aviso. Hay pruebas que verifican esa equivalencia.

### Las dos versiones de embed

Cada mensaje se puede publicar de dos formas, y las dos están disponibles en los
dos Main:

| Versión | Cómo se ve | Notas |
| --- | --- | --- |
| Embed clásico | Barra de color a la izquierda, miniatura, campos y pie con la hora | Lo de fábrica en Ankerie Dimension y en todos los registros |
| Contenedor Components V2 | Bloque con borde de color y títulos grandes | Lo de fábrica en la bienvenida y la despedida de Embers Void |

El contenido es el mismo en las dos, así que cambiar de versión no borra nada de
lo escrito. El contenedor V2 no tiene miniatura y publica el pie como texto
pequeño (`-#`). Los avisos que no son embed (automoderación y el aviso por
privado) no ofrecen el selector.

### Cómo se pone la letra más grande

Discord no tiene botones de tamaño: el tamaño se pide con símbolos al principio
de la línea. El panel trae una guía con todos ellos y una barra que los inserta
por ti.

| Escribes | Sale |
| --- | --- |
| `# Texto` | El título más grande |
| `## Texto` | Un escalón por debajo |
| `### Texto` | Mediano, algo mayor que el texto normal |
| `-# Texto` | Diminuto y gris, para notas y pies |
| `**Texto**` · `*Texto*` · `__Texto__` · `~~Texto~~` · `\|\|Texto\|\|` | Negrita, cursiva, subrayado, tachado y spoiler |
| `> Texto` · `>>> Texto` | Cita de una línea y cita hasta el final |
| `- Texto` · `1. Texto` | Listas |
| Acentos graves alrededor del texto | Código en línea (uno) o bloque de código (tres) |
| `[Visítanos](https://…)` | Enlace con texto propio (solo dentro de un embed) |

El botón **«Símbolos y letras…»** de la barra abre una paleta con 126 adornos
(marcos, estrellas, gótico, corazones, separadores, flechas y sellos) y 11
alfabetos decorativos de Unicode. Las letras raras de los diseños del servidor
(𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟, 𝑾𝒆𝒍𝒄𝒐𝒎𝒆) salen de ahí: no son una fuente, son caracteres reales,
así que se ven igual en móvil y en ordenador.

## Ofertas y juegos gratis

Módulo opcional (`features.deals`) que publica en el canal que elijas:

| Fuente | Qué trae | Coste |
| --- | --- | --- |
| Epic Games | El juego gratis de la semana y el anuncio del siguiente | Gratis, sin clave |
| GamerPower | Sorteos y llaves de Steam, GOG, Ubisoft, itch.io y otras | Gratis, sin clave |
| Steam | Rebajas de la portada por encima del descuento que fijes | Gratis, sin clave |

Vesper recuerda lo que ya publicó en cada servidor, limita cuántos avisos manda
por ronda y comprueba cada 30 minutos (`DEALS_INTERVAL_MINUTES`).

## Cuánto cuesta vigilar YouTube

La API de datos de YouTube da 10.000 unidades gratis al día. Vesper usa los
**feeds RSS públicos** para enterarse de que hay contenido nuevo, que no
consumen cuota ni necesitan clave, y reserva la API para los detalles de lo que
acaba de salir.

En la práctica: antes, vigilar un canal gastaba unas 1.150 unidades diarias y la
cuota daba para ocho o nueve canales. Ahora el gasto depende de cuánto publiquen
tus canales, no de cada cuánto los mira el bot. `YOUTUBE_USE_RSS=false` vuelve al
comportamiento anterior.

TikTok ya era gratuito: Vesper lo consulta con un Chromium propio dentro del
mismo contenedor, sin Apify ni ningún servicio de pago.

## Comprobaciones de salud

| Ruta | Qué responde | Para qué sirve |
| --- | --- | --- |
| `/live` | 200 mientras el proceso no se esté apagando | Sonda de vida |
| `/health` | 200 si el bot está conectado y no se está apagando | **La que debe usar el alojamiento** |
| `/ready` | 200 solo si además la base de datos, los monitores y la música están bien | Diagnóstico y validación de despliegue |

`/health` es deliberadamente tolerante: un monitor en pausa por errores de
TikTok o una reconexión de MongoDB son situaciones que Vesper resuelve solo. Si
el alojamiento consultara la comprobación estricta, reiniciaría el contenedor en
bucle por un fallo pasajero. El cuerpo de la respuesta incluye `ready` y el
detalle de cada monitor, así que no se pierde información.

## TikTok autohospedado y gratuito

Twitch se consulta en lotes de hasta 100 streamers. YouTube reutiliza la
playlist de subidas del canal para videos, shorts y directos, evitando búsquedas
costosas en cada ciclo.

TikTok no usa Apify, tokens, créditos ni cuentas secundarias. Los directos se
comprueban primero mediante la página pública de cada creador. Si TikTok entrega
un CAPTCHA o un HTML incompleto, Vesper cambia automáticamente a Chromium. Los
videos también usan el navegador local. El coste de API es US$0.00; solamente
consume recursos de la máquina donde se ejecuta el bot.

```dotenv
TIKTOK_ENABLED=true
TIKTOK_LIVE_INTERVAL_MINUTES=10
TIKTOK_VIDEO_INTERVAL_MINUTES=60
TIKTOK_LIVE_CACHE_MINUTES=5
TIKTOK_VIDEO_CACHE_MINUTES=30
TIKTOK_CONCURRENCY=2
TIKTOK_REQUEST_DELAY_MS=900
TIKTOK_BROWSER_TIMEOUT_MS=60000
# TIKTOK_BROWSER_PATH=/usr/bin/chromium
```

En Docker, Chromium se instala automáticamente. En una instalación local,
Vesper detecta Google Chrome o Microsoft Edge. Si ninguno está instalado,
ejecuta `npx playwright install chromium`. También puedes indicar una ruta
mediante `TIKTOK_BROWSER_PATH`.

Usa `/tiktok-test` para comprobar una cuenta, el acceso público y el estado del
navegador local. El navegador solo arranca cuando se consulta un video y se
cierra junto con Vesper.

El estado de últimos videos y cambios live de TikTok, Twitch y YouTube se
conserva en MongoDB, con respaldo local. Los fallos de red, bloqueo temporal o cambios de TikTok no se interpretan
como cuentas borradas ni como transmisiones finalizadas. La integración usa
rutas web no oficiales, por lo que TikTok puede modificarlas; el monitor entra
en cooldown y el resto del bot continúa funcionando si eso sucede.
