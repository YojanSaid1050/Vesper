# Rotación de credenciales — PENDIENTE

Las credenciales de esta instalación se compartieron fuera del alojamiento en
más de una ocasión. **Todas las de la lista deben considerarse comprometidas** y
rotarse antes del próximo despliegue. No están incluidas en este paquete.

## Qué rotar y dónde

| Variable | Dónde se cambia | Riesgo si no se rota |
| --- | --- | --- |
| `TOKEN` | Discord Developer Portal → Bot → **Reset Token** | Control total del bot en todos los servidores |
| `DISCORD_OAUTH_CLIENT_SECRET` | Developer Portal → OAuth2 → **Reset Secret** | Suplantación de inicios de sesión del panel |
| `WEB_SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Falsificación de sesiones del panel |
| `MONGODB_URI` | Atlas → Database Access → cambiar contraseña del usuario | Lectura y borrado de toda la configuración |
| `TWITCH_CLIENT_SECRET` | Twitch Developer Console | Uso de la cuota de la aplicación |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credenciales | Suplantación del acceso por Google |
| `YOUTUBE_API_KEY` | Google Cloud → revocar y crear una nueva | Agotamiento de la cuota diaria |
| `LAVALINK_PASSWORD` | Elegir una aleatoria nueva | Acceso al servidor de audio |

Guarda cada valor nuevo **solo** como variable secreta de Render. Nunca en
`.env.example`, `render.yaml`, GitHub, capturas de pantalla ni mensajes de chat.

## Después de rotar

1. Actualiza las variables en Render y espera al redespliegue.
2. Comprueba `https://<tu-dominio>/health` → debe responder `200`.
3. Comprueba `https://<tu-dominio>/ready` → indica si algún monitor está en pausa.
4. Abre `/panel` e inicia sesión con Discord.
5. Rotar `WEB_SESSION_SECRET` cierra todas las sesiones abiertas del panel: es
   lo que se busca, porque invalida cualquier sesión robada.

## Variables que NO son secretas

Estas pueden vivir en el repositorio sin problema:

```dotenv
CLIENT_ID=1507223570860867725
GUILD_ID=1506580021232406540
MAIN_GUILD_ID=1506580021232406540
THEMED_MAIN_GUILD_IDS=1124871897688055818
THEMED_MAIN_DEFAULT_NAME=AnkeBot
BOT_OWNER_IDS=649059737635258389
GOOGLE_OWNER_EMAILS=xyojansaidx@gmail.com
USE_GUILD_COMMANDS=false
REGISTER_COMMANDS=true
```

## Cómo evitar la próxima fuga

- `.env` ya está en `.gitignore` y en `.dockerignore`. No lo saques de ahí.
- Para compartir la configuración con alguien, comparte `.env.example`, que solo
  tiene marcadores de posición.
- Si necesitas diagnosticar un problema, `npm run env:check` dice qué variables
  faltan **sin imprimir sus valores**.
