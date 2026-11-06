#!/usr/bin/env bash
# /usr/local/bin/vesper-config — pide las claves de Vesper una por una y las
# guarda en /etc/vesper/vesper.env, sin abrir ningún editor.
#   sudo vesper-config
#
# Lo que escribes no se ve en pantalla. Deja una respuesta vacía para
# conservar el valor que ya hubiera. Al terminar, reinicia el bot.
set -euo pipefail
ENV_FILE="${ENV_FILE:-/etc/vesper/vesper.env}"
[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo: sudo vesper-config" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "No existe $ENV_FILE. Ejecuta antes el instalador." >&2; exit 1; }

set_env() {
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  grep -v "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

current() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- || true; }

ask() {
  local key="$1" label="$2" secret="${3:-yes}" value shown
  if [ -n "$(current "$key")" ]; then shown=" (ya tiene valor; Enter para dejarlo)"; else shown=""; fi
  if [ "$secret" = "yes" ]; then
    read -r -s -p "$label$shown: " value; echo
  else
    read -r -p "$label$shown: " value
  fi
  [ -n "$value" ] && set_env "$key" "$value"
  return 0
}

echo "Vesper · configuración. Copia cada valor de Render → Environment."
echo
ask TOKEN "Token del bot (Discord → Bot → Token)"
ask CLIENT_ID "ID de la aplicación de Discord" no
ask MONGODB_URI "Conexión de MongoDB (empieza por mongodb+srv://)"
ask MAIN_GUILD_ID "Número del servidor principal (Embers Void)" no
ask THEMED_MAIN_GUILD_IDS "Número de Ankerie Dimension" no
ask BOT_OWNER_IDS "Tu número de cuenta de Discord" no
ask DISCORD_OAUTH_CLIENT_ID "Discord → OAuth2 → Client ID" no
ask DISCORD_OAUTH_CLIENT_SECRET "Discord → OAuth2 → Client Secret"
if [ -z "$(current WEB_SESSION_SECRET)" ]; then
  set_env WEB_SESSION_SECRET "$(head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  echo "Clave de sesión del panel: generada."
fi
echo
read -r -p "¿Usas también Google, Twitch o YouTube? (s/N): " extra
if [ "${extra,,}" = "s" ]; then
  ask GOOGLE_CLIENT_ID "Google Client ID" no
  ask GOOGLE_CLIENT_SECRET "Google Client Secret"
  ask GOOGLE_OWNER_EMAILS "Correos de Google con acceso de propietario" no
  ask TWITCH_CLIENT_ID "Twitch Client ID" no
  ask TWITCH_CLIENT_SECRET "Twitch Client Secret"
  ask YOUTUBE_API_KEY "Clave de YouTube"
fi
chmod 640 "$ENV_FILE"
echo
echo "Guardado. Reiniciando Vesper…"
if command -v systemctl >/dev/null && systemctl list-unit-files vesper.service >/dev/null 2>&1; then
  systemctl restart vesper && echo "✅ Listo. Mira cómo arranca con: vesper-logs"
fi
