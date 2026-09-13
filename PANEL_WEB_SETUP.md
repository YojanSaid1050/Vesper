# Activación del panel web de Vesper 2.8.0

## Modo de administración web

Cuando el inicio de sesión y las pruebas del panel estén completos, define:

```dotenv
WEB_ADMIN_MODE=true
REGISTER_COMMANDS=true
USE_GUILD_COMMANDS=false
```

El próximo arranque reemplazará el catálogo global por la versión reducida. El
modo no se activa si faltan la URL, la sesión o Discord OAuth, evitando un
bloqueo accidental. Si el panel presenta una avería, cambia temporalmente
`WEB_ADMIN_MODE=false` y reinicia para recuperar todos los comandos
administrativos.

El panel forma parte del mismo servicio que el bot. No se instala WordPress ni
se despliega un frontend separado.

## 1. Preparar Discord OAuth

1. Abre Discord Developer Portal y entra en la aplicación de Vesper.
2. Ve a **OAuth2**.
3. Añade esta redirección, reemplazando el dominio:

   ```text
   https://vesper-q5jv.onrender.com/auth/discord/callback
   ```

4. Copia el **Client Secret**. No es el token del bot.
5. Conserva `CLIENT_ID` y `TOKEN` como están actualmente.

El login solicita únicamente `identify` y `guilds`. Aunque Discord entrega la
lista autorizada, Vesper vuelve a verificar la membresía, los permisos y los
roles mediante el bot antes de mostrar o modificar cada servidor.

## 2. Preparar Google (opcional)

1. Crea o selecciona un proyecto en Google Cloud Console.
2. Configura la pantalla de consentimiento OAuth.
3. Crea un cliente OAuth de tipo **Aplicación web**.
4. Añade esta URI de redirección autorizada:

   ```text
   https://vesper-q5jv.onrender.com/auth/google/callback
   ```

5. Copia el Client ID y el Client Secret.

Si la aplicación de Google permanece en modo de prueba, añade como usuarios de
prueba las cuentas que iniciarán sesión. Vesper solicita solamente identidad,
correo y perfil.

## 3. Variables del alojamiento

Activa estas variables en Render o en el proveedor utilizado:

```dotenv
WEB_DASHBOARD_ENABLED=true
WEB_BASE_URL=https://vesper-q5jv.onrender.com
WEB_SESSION_SECRET=GENERADA_AUTOMATICAMENTE_POR_RENDER
DISCORD_OAUTH_CLIENT_SECRET=REEMPLAZAR_CON_EL_SECRETO_DE_DISCORD
GOOGLE_CLIENT_ID=OPCIONAL
GOOGLE_CLIENT_SECRET=OPCIONAL
GOOGLE_OWNER_EMAILS=correo_propietario@gmail.com
WEB_SESSION_HOURS=24
WEB_AUDIT_DAYS=180
WEB_TRUST_PROXY=1
```

Genera `WEB_SESSION_SECRET` localmente:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

No reutilices el token del bot, el secreto de Discord ni una contraseña como
clave de sesión. `WEB_BASE_URL` debe coincidir exactamente con el origen público
y no debe terminar en una ruta.

## 4. Primer acceso

1. Reinicia el servicio.
2. Abre `https://tu-servicio.onrender.com/panel`.
3. Inicia con Discord.
4. Si usarás Google, pulsa **Vincular Google** dentro de la tarjeta de cuenta.
5. Comprueba un servidor de prueba antes de cambiar el Main.

La sección **Comunidad** permite configurar canales, roles de soporte, límites
y starboard. También publica los mensajes interactivos de tickets y autorroles,
y muestra las sugerencias recientes para aprobarlas o rechazarlas sin copiar
IDs. La publicación requiere pulsar su botón explícito y nunca ocurre solo por
guardar el formulario.

Un correo incluido en `GOOGLE_OWNER_EMAILS` obtiene acceso de propietario. Para
crear advertencias o aislamientos, la sesión también debe tener una cuenta de
Discord vinculada. Los demás usuarios reciben las capacidades que tengan en el
servidor: administración, moderación o consulta de sus propios casos.

## 5. Comprobaciones recomendadas

- Un usuario común solo puede consultar sus propios casos.
- Un moderador no puede sancionar miembros con un rol igual o superior.
- Un administrador puede cambiar canales y módulos, pero no otros servidores.
- Una sanción creada en web aparece también al consultar `/caso` en Discord.
- Una acción web aparece en la pestaña **Auditoría**.
- Cerrar sesión invalida el registro correspondiente en MongoDB.

## WordPress

WordPress puede utilizarse como página pública y enlazar hacia `/panel`, pero no
debe ejecutar el bot ni recibir los secretos OAuth. Basta con un botón como:

```html
<a href="https://tu-servicio.onrender.com/panel">Abrir panel de Vesper</a>
```

Así WordPress queda completamente separado de la autenticación y del token de
Discord. El coste adicional del panel es cero porque comparte el proceso y la
base de datos de Vesper; la disponibilidad continua sigue dependiendo del plan
de alojamiento usado para el bot.
