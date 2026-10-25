# Vesper en Oracle Cloud gratis

Oracle Cloud tiene un plan **Always Free** con un servidor que no se duerme,
con RAM de sobra para la música y una dirección propia
(`tunombre.duckdns.org`). Todo esto cuesta **0 €**.

Lo que necesitas a mano:

- Una tarjeta. Oracle la pide **solo para verificar tu identidad** y no cobra
  nada mientras uses los recursos marcados como *Always Free*.
- Las variables de Render (Render → tu servicio → **Environment**). Son las
  mismas que vas a pegar en el servidor nuevo.
- Unos 40 minutos.

> Los secretos (token del bot, contraseña de MongoDB, claves OAuth…) se
> pegan **solo en el servidor**, nunca en un chat ni en el repositorio.

---

## 1. Crear la cuenta

1. Entra en <https://www.oracle.com/cloud/free/> y pulsa **Start for free**.
2. Elige la **región de origen** con cuidado: no se puede cambiar después.
   La más cercana es **Colombia Central (Bogotá)**; si no aparece para el
   plan gratuito, **Brazil East (São Paulo)**, **Chile Central (Santiago)** o
   **US East (Ashburn)**. Mejor una región grande: tienen más servidores ARM
   libres.
3. Verifica la tarjeta y espera el correo de bienvenida (a veces tarda unos
   minutos).

## 2. Crear el servidor

1. Menú ☰ → **Compute** → **Instances** → **Create instance**.
2. **Name**: `vesper`.
3. **Image and shape** → **Edit**:
   - **Image**: *Canonical Ubuntu 24.04*.
   - **Shape**: *Ampere* → **VM.Standard.A1.Flex** con **2 OCPU** y
     **12 GB** de memoria. Es lo que entra gratis.
   - Si sale *Out of capacity*, cambia el **Availability domain** o baja a
     1 OCPU y 6 GB. La alternativa es *VM.Standard.E2.1.Micro* (AMD, 1 GB):
     funciona, pero va justa.
4. **Networking**: deja *Assign a public IPv4 address* marcado.
5. **Add SSH keys**: **Generate a key pair for me** → **Save private key**.
   Guarda ese archivo `.key`: es la llave para entrar al servidor.
6. **Create**. Cuando diga *Running*, copia la **Public IP address**.

## 3. Abrir los puertos de la web

1. En la página del servidor, pulsa la **Subnet** (en *Primary VNIC*).
2. **Security Lists** → *Default Security List* → **Add Ingress Rules**:
   - Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination port **80**.
   - Otra igual con el puerto **443**.

El instalador abre también el firewall interno de Ubuntu, que en Oracle viene
cerrado.

## 4. Tu dirección propia con DuckDNS

1. Entra en <https://www.duckdns.org> con tu cuenta de Google o GitHub.
2. Escribe un nombre (por ejemplo `vesper-yojan`) y pulsa **add domain**.
3. En **current ip** pon la **Public IP** del servidor y pulsa **update ip**.
4. El **token** de arriba lo pegarás en el paso 6, en el servidor.

Tu panel quedará en `https://vesper-yojan.duckdns.org/panel`.

## 5. Entrar al servidor e instalar

Desde PowerShell (Windows) o la Terminal (Mac/Linux), en la carpeta donde
guardaste la llave:

```bash
ssh -i ssh-key-XXXX.key ubuntu@IP_PUBLICA
```

(En Mac/Linux, si dice *permissions too open*: `chmod 600 ssh-key-XXXX.key`.)

Ya dentro, con tu dominio:

```bash
curl -fsSL https://raw.githubusercontent.com/YojanSaid1050/Vesper/main/deploy/oracle/install.sh -o install.sh
sudo DOMAIN=vesper-yojan.duckdns.org bash install.sh
```

Tarda unos 5–10 minutos. Instala Node 24, Caddy (HTTPS), Chromium (TikTok),
la música para ARM y el servicio `vesper`.

## 6. Pegar los secretos

```bash
sudo nano /etc/vesper/vesper.env
```

Rellena con los mismos valores que tienes en Render. Como mínimo:

| Variable | De dónde sale |
| --- | --- |
| `TOKEN` | Discord Developer Portal → Bot → Token |
| `CLIENT_ID` | El ID de la aplicación |
| `MONGODB_URI` | MongoDB Atlas (la misma de Render) |
| `WEB_SESSION_SECRET` | La misma de Render (o una nueva larga) |
| `DISCORD_OAUTH_CLIENT_ID` y `DISCORD_OAUTH_CLIENT_SECRET` | Discord → OAuth2 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OWNER_EMAILS` | Si entras con Google |
| `MAIN_GUILD_ID`, `THEMED_MAIN_GUILD_IDS`, `BOT_OWNER_IDS`… | Igual que en Render |

`WEB_BASE_URL`, `PORT`, `WEB_TRUST_PROXY` y `WEB_COOKIE_SECURE` ya vienen
puestos. Guarda con `Ctrl+O`, `Enter` y sal con `Ctrl+X`.

Luego el token de DuckDNS:

```bash
sudo nano /etc/vesper/duckdns.env
sudo vesper-duckdns        # debe decir «DuckDNS actualizado»
```

## 7. Ajustes fuera del servidor

- **Discord Developer Portal** → tu aplicación → **OAuth2** → **Redirects**:
  añade `https://vesper-yojan.duckdns.org/auth/discord/callback`.
- **Google Cloud Console** (si usas Google): añade
  `https://vesper-yojan.duckdns.org/auth/google/callback`.
- **MongoDB Atlas** → **Network Access**: si no tienes `0.0.0.0/0`, añade la
  IP pública del servidor.
- **Render** → tu servicio → **Settings** → **Suspend Web Service**. Si no,
  habrá **dos bots encendidos** con el mismo token y responderán dos veces.

## 8. Arrancar

```bash
sudo systemctl restart vesper
vesper-logs
```

Tiene que salir que se conectó a Discord y a MongoDB. Prueba
`https://vesper-yojan.duckdns.org/health` en el navegador y entra al panel.
La primera vez, Caddy tarda unos segundos en sacar el certificado HTTPS.

En Discord, `/musica diagnostico` dice qué fuentes de música funcionan desde
el servidor nuevo.

---

## Día a día

| Para… | Escribe |
| --- | --- |
| Ver los registros en directo | `vesper-logs` |
| Actualizar a la última versión de GitHub | `sudo vesper-update` |
| Reiniciar | `sudo systemctl restart vesper` |
| Ver si está encendido | `systemctl status vesper` |
| Cambiar un secreto | `sudo nano /etc/vesper/vesper.env` y reiniciar |

Render desplegaba solo con cada cambio en GitHub; aquí lo haces tú con
`sudo vesper-update` cuando haya una versión nueva.

## Si algo no va

- **El panel no abre**: revisa las dos reglas del paso 3 y que DuckDNS
  apunte a la IP correcta (`sudo vesper-duckdns`). `sudo systemctl status caddy`
  dice si el certificado falló.
- **El bot no se conecta**: `vesper-logs` dice qué variable falta.
- **«Out of capacity» al crear el servidor**: otra *Availability domain*,
  menos OCPU o vuelve a intentarlo en unas horas.
- **YouTube**: también bloquea las IP de Oracle. La música sale de SoundCloud
  y Audius, igual que en Render.
- **Oracle avisa de que el servidor está inactivo**: en el plan gratuito,
  Oracle puede reclamar servidores casi sin uso. Un bot conectado todo el día
  suele bastar; si llega el aviso, pasar la cuenta a *Pay As You Go* lo evita
  y sigue sin cobrar mientras no salgas de lo gratuito.
