# Activación de AnkeBot en Ankerie Dimension

## Servidor registrado

- Nombre: **Ankerie Dimension**
- ID: `1124871897688055818`
- Tipo: `themed_main`
- Identidad inicial: **AnkeBot**
- Tema inicial: Cinnamoroll, cielo y nubes pastel
- Propietario Discord: `649059737635258389`
- Propietario Google: `xyojansaidx@gmail.com`

El Main temático está aprobado automáticamente mediante
`THEMED_MAIN_GUILD_IDS`. No debe añadirse a `MAIN_GUILD_ID`: ese valor continúa
reservado exclusivamente para Embers Void.

## Primer despliegue

1. Invita la misma aplicación de Discord a Ankerie Dimension con los scopes
   `bot` y `applications.commands`.
2. Activa `Server Members Intent` y `Message Content Intent` en Discord.
3. Configura el panel OAuth siguiendo `PANEL_WEB_SETUP.md`.
   Las redirecciones de esta instalación son:
   - `https://vesper-q5jv.onrender.com/auth/discord/callback`
   - `https://vesper-q5jv.onrender.com/auth/google/callback`
4. En Render conserva:

```dotenv
THEMED_MAIN_GUILD_IDS=1124871897688055818
THEMED_MAIN_DEFAULT_NAME=AnkeBot
WEB_DASHBOARD_ENABLED=true
WEB_ADMIN_MODE=false
WEB_BASE_URL=https://vesper-q5jv.onrender.com
REGISTER_COMMANDS=true
USE_GUILD_COMMANDS=false
BOT_OWNER_IDS=649059737635258389
GOOGLE_OWNER_EMAILS=xyojansaidx@gmail.com
```

5. Reinicia y abre `/panel`.
6. Entra con el Discord incluido en `BOT_OWNER_IDS` o con el Google incluido en
   `GOOGLE_OWNER_EMAILS`.
7. Selecciona **Ankerie Dimension**. El panel cargará sus canales, categorías y
   roles directamente desde Discord.

## Configuración desde la web

En la pestaña **Configuración** puedes elegir, sin copiar IDs:

- Nombre AnkeBot, avatar de webhooks y colores.
- Mensajes de bienvenida y despedida.
- Rol temático automático para miembros.
- Canales de bienvenida, logs, alertas, música, tickets y starboard.
- Categoría de tickets y canal de voz musical.
- Roles de moderación, redes, DJ, soporte, avisos y autorroles.
- Cuentas monitoreadas de TikTok, Twitch y YouTube.
- Módulos, límites musicales y filtros automáticos.
- Publicación de los paneles de tickets y autorroles.
- Revisión de sugerencias sin copiar IDs de mensajes.

El rol de Vesper debe estar por encima de cualquier rol que AnkeBot vaya a
entregar. Para música necesita **Ver canal**, **Conectar** y **Hablar**.

## Activar el catálogo reducido

Después de confirmar que el panel funciona, cambia `WEB_ADMIN_MODE=true` y
reinicia. Vesper retirará del registro los comandos administrativos reemplazados
por la web. Si el panel no tiene una configuración válida, el modo reducido no
se aplica. Para una recuperación de emergencia, vuelve a `false` y reinicia.

El nombre y avatar reales de la aplicación siguen siendo globales. El apodo,
webhooks, colores, paneles y mensajes sí cambian por servidor.
