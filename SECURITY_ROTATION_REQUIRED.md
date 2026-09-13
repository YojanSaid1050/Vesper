# Rotación de credenciales antes del próximo despliegue

Las credenciales usadas anteriormente se compartieron fuera del alojamiento y
deben considerarse expuestas. No están incluidas en este paquete.

Antes de iniciar Vesper nuevamente:

1. Restablece el token del bot en Discord Developer Portal.
2. Cambia la contraseña del usuario de MongoDB Atlas y copia la URI nueva.
3. Regenera el Client Secret de Twitch.
4. Revoca y crea una API key nueva de YouTube; restríngela a YouTube Data API v3
   y, cuando el proveedor lo permita, al entorno donde se ejecuta Vesper.
5. Elige una contraseña nueva y aleatoria para Lavalink.
6. Guarda cada valor nuevo únicamente como variable secreta de Render. No los
   escribas en `.env.example`, `render.yaml`, GitHub, capturas ni mensajes.

Mantén estas variables no secretas:

```dotenv
CLIENT_ID=1507223570860867725
GUILD_ID=1506580021232406540
MAIN_GUILD_ID=1506580021232406540
THEMED_MAIN_GUILD_IDS=1124871897688055818
BOT_OWNER_IDS=649059737635258389
GOOGLE_OWNER_EMAILS=xyojansaidx@gmail.com
USE_GUILD_COMMANDS=false
REGISTER_COMMANDS=true
```

Para activar el panel todavía faltan `WEB_BASE_URL`, una nueva
`WEB_SESSION_SECRET`, `DISCORD_OAUTH_CLIENT_SECRET` y, si se usará Google,
`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
