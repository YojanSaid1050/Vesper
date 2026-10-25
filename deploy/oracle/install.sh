#!/usr/bin/env bash
# deploy/oracle/install.sh
#
# Instala Vesper en un servidor Ubuntu 24.04 de Oracle Cloud (Always Free),
# en ARM (Ampere) o en x86. Se puede volver a ejecutar sin miedo: lo que ya
# está hecho se salta y la configuración guardada no se toca.
#
#   curl -fsSL https://raw.githubusercontent.com/YojanSaid1050/Vesper/main/deploy/oracle/install.sh -o install.sh
#   sudo DOMAIN=tunombre.duckdns.org bash install.sh
#
# Qué deja hecho:
#   · Node 24, Caddy (HTTPS automático) y Chromium (monitor de TikTok).
#   · El usuario «vesper», el código en /opt/vesper y la música (yt-dlp y
#     ffmpeg) en la versión de este procesador.
#   · /etc/vesper/vesper.env para los secretos, con permisos solo para el bot.
#   · El servicio «vesper», que arranca solo y se reinicia si se cae.
#   · Los puertos 80 y 443 abiertos en el firewall de Ubuntu.
#   · La actualización de DuckDNS cada 5 minutos.
#
# Los secretos NUNCA se escriben aquí: se pegan después en
# /etc/vesper/vesper.env y /etc/vesper/duckdns.env, en el propio servidor.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/YojanSaid1050/Vesper.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/vesper}"
CONFIG_DIR="${CONFIG_DIR:-/etc/vesper}"
ENV_FILE="$CONFIG_DIR/vesper.env"
DUCKDNS_FILE="$CONFIG_DIR/duckdns.env"
APP_USER="vesper"
DOMAIN="${DOMAIN:-}"

# Para probar el instalador dentro de un contenedor, sin systemd ni firewall.
SKIP_SYSTEMD="${SKIP_SYSTEMD:-false}"
SKIP_FIREWALL="${SKIP_FIREWALL:-false}"
SKIP_CHROMIUM="${SKIP_CHROMIUM:-false}"
SKIP_CADDY="${SKIP_CADDY:-false}"

paso() { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✔\033[0m %s\n' "$*"; }
aviso() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fallo() { printf '\n\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fallo "Ejecútalo con sudo: sudo DOMAIN=tunombre.duckdns.org bash install.sh"
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || aviso "Este instalador está probado en Ubuntu 24.04; este sistema es ${PRETTY_NAME:-desconocido}."
ARCH="$(dpkg --print-architecture)"
case "$ARCH" in
  arm64|amd64) ok "Procesador: $ARCH" ;;
  *) fallo "Procesador no soportado: $ARCH" ;;
esac
if [ -n "$DOMAIN" ] && ! printf '%s' "$DOMAIN" | grep -Eq '^[a-z0-9.-]+\.[a-z]{2,}$'; then
  fallo "DOMAIN no parece un dominio: «$DOMAIN». Ejemplo: DOMAIN=vesper-yojan.duckdns.org"
fi

export DEBIAN_FRONTEND=noninteractive

paso "Paquetes del sistema"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git gnupg xz-utils unzip cron debian-keyring debian-archive-keyring apt-transport-https >/dev/null
ok "Listo"

# Las máquinas pequeñas (AMD de 1 GB) se quedan sin memoria al instalar y al
# convertir audio; un archivo de intercambio lo evita.
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 2048 ] && [ ! -f /swapfile ] && [ "$SKIP_SYSTEMD" != "true" ]; then
  paso "Memoria de intercambio (el servidor tiene ${MEM_MB} MB)"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "2 GB de intercambio activados"
fi

paso "Node.js 24"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
ok "Node $(node -v), npm $(npm -v)"

if [ "$SKIP_CADDY" != "true" ]; then
  paso "Caddy (HTTPS automático)"
  if ! command -v caddy >/dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq && apt-get install -y -qq caddy >/dev/null
  fi
  ok "$(caddy version | cut -d' ' -f1)"
fi

BROWSER_PATH=""
if [ "$SKIP_CHROMIUM" != "true" ]; then
  paso "Chromium (para el monitor de TikTok)"
  if command -v snap >/dev/null; then
    snap list chromium >/dev/null 2>&1 || snap install chromium >/dev/null
    BROWSER_PATH="/snap/bin/chromium"
    ok "Chromium en $BROWSER_PATH"
  else
    aviso "No hay snap; TikTok usará su modo sin navegador."
  fi
fi

paso "Usuario y código de Vesper"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir "/home/$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch -q origin "$BRANCH"
  git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
  ok "Código actualizado ($(git -C "$APP_DIR" log -1 --format=%h))"
else
  git clone -q --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  ok "Código descargado en $APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

paso "Dependencias y música (yt-dlp y ffmpeg para $ARCH)"
# npm 11 ya no ejecuta los scripts de instalación de las dependencias, así que
# ffmpeg-static se recompila a mano; si aun así falla, ensure-ffmpeg descarga
# la compilación de BtbN para este procesador.
sudo -u "$APP_USER" -H --preserve-env=HTTPS_PROXY,HTTP_PROXY,https_proxy,http_proxy,NO_PROXY,NODE_EXTRA_CA_CERTS,npm_config_cafile bash -c "cd '$APP_DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error && (npm rebuild ffmpeg-static --loglevel=error || true) && node scripts/ensure-ffmpeg.js"
ok "Dependencias instaladas"

paso "Configuración en $CONFIG_DIR"
mkdir -p "$CONFIG_DIR"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/.env.example" "$ENV_FILE"
  set_env() {
    if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi
  }
  set_env PORT 3000
  set_env WEB_TRUST_PROXY 1
  set_env WEB_COOKIE_SECURE true
  [ -n "$DOMAIN" ] && set_env WEB_BASE_URL "https://$DOMAIN"
  [ -n "$BROWSER_PATH" ] && set_env TIKTOK_BROWSER_PATH "$BROWSER_PATH"
  ok "Creado $ENV_FILE a partir de .env.example (faltan tus secretos)"
else
  ok "$ENV_FILE ya existía: no se toca"
fi
if [ ! -f "$DUCKDNS_FILE" ]; then
  printf '# Pega aquí tu token de DuckDNS (duckdns.org, arriba a la derecha).\n# DUCKDNS_DOMAIN es solo la parte antes de .duckdns.org\nDUCKDNS_DOMAIN=%s\nDUCKDNS_TOKEN=\n' "${DOMAIN%%.duckdns.org}" > "$DUCKDNS_FILE"
fi
chown root:"$APP_USER" "$ENV_FILE" "$DUCKDNS_FILE"
chmod 640 "$ENV_FILE" "$DUCKDNS_FILE"

paso "Comandos de ayuda"
install -m 755 "$APP_DIR/deploy/oracle/vesper-update.sh" /usr/local/bin/vesper-update
install -m 755 "$APP_DIR/deploy/oracle/duckdns.sh" /usr/local/bin/vesper-duckdns
printf '#!/bin/sh\nexec journalctl -u vesper -f -n 100 --output cat\n' > /usr/local/bin/vesper-logs && chmod 755 /usr/local/bin/vesper-logs
echo '*/5 * * * * root /usr/local/bin/vesper-duckdns >/dev/null 2>&1' > /etc/cron.d/vesper-duckdns
ok "vesper-update, vesper-logs y vesper-duckdns"

if [ "$SKIP_CADDY" != "true" ] && [ -n "$DOMAIN" ]; then
  paso "HTTPS para $DOMAIN"
  sed "s|{DOMAIN}|$DOMAIN|g" "$APP_DIR/deploy/oracle/Caddyfile" > /etc/caddy/Caddyfile
  [ "$SKIP_SYSTEMD" = "true" ] || systemctl reload-or-restart caddy
  ok "Caddy servirá https://$DOMAIN (el certificado se pide solo al primer acceso)"
fi

if [ "$SKIP_FIREWALL" != "true" ]; then
  paso "Firewall de Ubuntu (puertos 80 y 443)"
  # Las imágenes de Oracle traen iptables cerrado salvo el 22: sin esto la web
  # no responde aunque la regla de la consola de Oracle esté puesta.
  for port in 80 443; do
    iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null \
      || iptables -I INPUT 5 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  done
  if command -v netfilter-persistent >/dev/null; then netfilter-persistent save >/dev/null 2>&1 || true; fi
  ok "Puertos abiertos"
fi

if [ "$SKIP_SYSTEMD" != "true" ]; then
  paso "Servicio «vesper»"
  install -m 644 "$APP_DIR/deploy/oracle/vesper.service" /etc/systemd/system/vesper.service
  systemctl daemon-reload
  systemctl enable vesper >/dev/null 2>&1
  if grep -Eq '^TOKEN=.+' "$ENV_FILE" && grep -Eq '^MONGODB_URI=.+' "$ENV_FILE"; then
    systemctl restart vesper
    ok "Vesper arrancado. Mira cómo va con: vesper-logs"
  else
    aviso "Vesper queda instalado pero sin arrancar: faltan TOKEN o MONGODB_URI."
  fi
fi

cat <<FIN

$(printf '\033[1;32m✅ Instalación terminada.\033[0m')

Falta lo que solo puedes hacer tú:

  1. Pega tus secretos (los mismos de Render → Environment):
       sudo nano $ENV_FILE
  2. Pega el token de DuckDNS:
       sudo nano $DUCKDNS_FILE
  3. En Discord Developer Portal → OAuth2, añade la redirección:
       https://${DOMAIN:-TU-DOMINIO}/auth/discord/callback
  4. Suspende el servicio de Render (si no, responderán dos bots a la vez).
  5. Arranca y mira los registros:
       sudo systemctl restart vesper && vesper-logs

Para actualizar más adelante:  sudo vesper-update
FIN
