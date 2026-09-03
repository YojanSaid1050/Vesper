# Vesper Bot 2.4

Bot de Discord para administración de servidores y notificaciones de Twitch,
YouTube y TikTok. La versión 2.4 conserva la presentación visual original con
Componentes V2, separa el servidor Main de los satélites e incorpora control
central, historial, moderación opcional y música autohospedada.

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
```

Se recomienda además configurar `BOT_OWNER_IDS` con uno o varios IDs separados
por coma. Si queda vacío, nadie puede ejecutar operaciones globales como
`/resetalldb`.

## Servidor Main y satélites

Configura `MAIN_GUILD_ID` con el ID de Embers Void. El dashboard, diagnóstico,
auditoría, historial, roles especiales, personalidad original y comandos de
administración avanzada solo funcionan y se registran en ese servidor.

`APPROVED_GUILD_IDS` acepta IDs secundarios separados por coma. Fuera del Main,
Vesper usa mensajes neutrales y no procesa roles, botones ni referencias
internas de Embers Void. Los módulos de los satélites se administran desde el
Main mediante `/vesper-modulo`.

El centro de control se abre con `/vesper-control`. Sus botones permiten revisar
la configuración, diagnóstico, módulos e historial sin mostrar credenciales.

## Permisos por capacidad

- `BOT_OWNER_IDS`: operaciones globales y acceso total al Main.
- Administrador del Main: centro de control, módulos y configuración avanzada.
- `SOCIAL_MANAGER_ROLE_IDS`: TikTok, Twitch y YouTube dentro del Main.
- `MODERATOR_ROLE_IDS` o permiso **Moderar miembros**: advertencias y timeouts.
- `MUSIC_DJ_ROLE_IDS` o permiso **Gestionar canales**: controles avanzados de música.
- Miembros: solicitudes, cola y votación de salto cuando música está habilitada.

Los comandos sociales conservan el permiso Administrador como valor inicial de
Discord. Para que un rol gestor no administrativo pueda verlos, habilita ese rol
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

El proyecto expone `/health`. Este endpoint responde `200` únicamente cuando
Discord y MongoDB están conectados; durante una caída responde `503` y muestra
el estado de cada monitor.

El alojamiento queda a elección del propietario. Vesper requiere un proceso
Node.js persistente, acceso a MongoDB y, si se activa música, un proceso Lavalink.

## Seguridad

- Los botones, selectores y modales del dashboard vuelven a validar permisos de
  administrador en cada interacción.
- Las operaciones globales requieren un propietario configurado.
- Las URLs de avatar deben usar HTTPS y no pueden apuntar a redes privadas.
- Las menciones enviadas mediante webhooks quedan restringidas a roles
  configurados.
- Los errores repetidos ponen un monitor en cooldown; no lo desactivan de forma
  permanente.
- Cada alerta se reserva mediante una clave única en MongoDB antes de enviarse.
- Los reintentos no vuelven a mencionar roles y respetan fallos temporales.

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

Los comandos `/advertir`, `/aislar` y `/sanciones` se registran únicamente en el
Main. Los roles de gestores, moderadores y DJ pueden definirse en el `.env`.

## Música gratuita

La música usa Lavalink 4.2.2 y el complemento oficial de YouTube 1.18.2. No
requiere una API de pago, pero consume CPU y memoria del alojamiento propio.

```bash
docker compose -f docker-compose.music.yml up -d
```

Configura la misma contraseña en `LAVALINK_PASSWORD` y activa el módulo desde
el Main. `/vesper-musica-config` permite fijar canal de solicitudes, volumen,
cola, límite por usuario, duración e inactividad.

Reglas incorporadas:

- Una conexión y una cola por servidor.
- Un solo canal de voz simultáneo por servidor.
- El solicitante debe estar en ese canal.
- Tres canciones pendientes por usuario y 100 en total por defecto.
- Canciones repetidas y transmisiones en directo bloqueadas.
- Duración máxima de 15 minutos por defecto.
- Salto por voto del 50 % o inmediato para DJ.
- Desconexión automática después de 180 segundos sin audiencia o sin canciones.

Comandos: `/musica reproducir`, `pausar`, `continuar`, `saltar`, `cola`,
`actual`, `bucle`, `volumen` y `detener`.

## Pruebas

```bash
npm test
```

La validación continua comprueba pruebas y sintaxis en Node.js 24.

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

El estado de últimos videos y cambios live se conserva en MongoDB, con respaldo
local. Los fallos de red, bloqueo temporal o cambios de TikTok no se interpretan
como cuentas borradas ni como transmisiones finalizadas. La integración usa
rutas web no oficiales, por lo que TikTok puede modificarlas; el monitor entra
en cooldown y el resto del bot continúa funcionando si eso sucede.
