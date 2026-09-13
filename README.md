# Vesper Bot 2.8.2

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

El proyecto incluye un `Dockerfile` reproducible con Chromium y Lavalink, y
expone `/live`, `/ready` y `/health`. La disponibilidad exige Discord, MongoDB
y monitores sanos. Lavalink solo bloquea `/ready` si `MUSIC_REQUIRED=true`.

El alojamiento queda a elección del propietario. Vesper requiere un proceso
persistente y acceso a MongoDB. En Docker y Render, el proceso Lavalink puede
iniciarse dentro del mismo contenedor con `LAVALINK_EMBEDDED=true`.

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

La música usa Lavalink 4.2.2 y el complemento de YouTube 1.18.2. No requiere
una API de pago, pero consume CPU y memoria del alojamiento propio.

### Docker o Render: modo integrado

El `Dockerfile` de Vesper inicia Node.js y Lavalink juntos. Define una contraseña
larga en `LAVALINK_PASSWORD`, conserva `LAVALINK_EMBEDDED=true` y deja
`MUSIC_REQUIRED=false` para que una avería musical no detenga las demás funciones.
No es necesario desplegar `docker-compose.music.yml` en este modo.

### Desarrollo local o Lavalink externo

```bash
docker compose -f docker-compose.music.yml up -d
```

Usa la misma contraseña en Vesper y Lavalink. Para un servidor externo define
`LAVALINK_EMBEDDED=false` y su URL HTTP(S) en `LAVALINK_URL`.

Activa el módulo con `/vesper-setup modulos` o desde el panel web. El canal se
asigna con `/vesper-setup canales`; los límites avanzados se ajustan desde el
panel o con `/vesper-musica-config` en el Main. El rol de Vesper necesita los
permisos **Ver canal**, **Conectar** y **Hablar** en el canal de voz.

Reglas incorporadas:

- Una conexión y una cola por servidor.
- Un solo canal de voz simultáneo por servidor.
- El solicitante debe estar en ese canal.
- Tres canciones pendientes por usuario y 100 en total por defecto.
- Canciones repetidas y transmisiones en directo bloqueadas.
- Duración máxima de 15 minutos por defecto.
- Salto por voto del 50 % o inmediato para DJ.
- Desconexión automática después de 180 segundos sin audiencia o sin canciones.

Comandos: `/musica diagnostico`, `reproducir`, `pausar`, `continuar`, `saltar`,
`cola`, `actual`, `bucle`, `volumen` y `detener`.

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
