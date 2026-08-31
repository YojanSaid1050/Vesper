# Vesper Bot 2.3

Bot de Discord para administración de servidores y notificaciones de Twitch,
YouTube y TikTok. La versión 2.3 conserva la presentación visual original con
Componentes V2 y sustituye Apify por monitoreo TikTok autohospedado.

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

`render.yaml` usa un web service porque Render no admite workers en su plan
gratuito. Los web services gratuitos pueden suspenderse por inactividad, por lo
que no garantizan una conexión permanente con Discord. Para operación gratuita
continua se recomienda una VM Always Free disponible o un equipo propio.

## Seguridad

- Los botones, selectores y modales del dashboard vuelven a validar permisos de
  administrador en cada interacción.
- Las operaciones globales requieren un propietario configurado.
- Las URLs de avatar deben usar HTTPS y no pueden apuntar a redes privadas.
- Las menciones enviadas mediante webhooks quedan restringidas a roles
  configurados.
- Los errores repetidos ponen un monitor en cooldown; no lo desactivan de forma
  permanente.

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
comprueban mediante la página pública de cada creador. Para obtener el último
video, Vesper inicia un navegador Chromium local y firma las solicitudes desde
el mismo alojamiento. El coste de API es US$0.00; solamente consume recursos de
la máquina donde se ejecuta el bot.

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
