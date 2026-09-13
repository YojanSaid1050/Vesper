#!/bin/sh
set -eu

embedded="$(printf '%s' "${LAVALINK_EMBEDDED:-true}" | tr '[:upper:]' '[:lower:]')"

if [ "$embedded" = "true" ] && [ -n "${LAVALINK_PASSWORD:-}" ]; then
  export LAVALINK_URL="http://127.0.0.1:2333"
  echo "🎵 Iniciando Lavalink integrado en ${LAVALINK_URL}"
  java -jar /opt/Lavalink/Lavalink.jar \
    --spring.config.location=file:/app/lavalink/application.yml &
elif [ "$embedded" = "true" ]; then
  echo "ℹ️ Lavalink integrado omitido: LAVALINK_PASSWORD no está configurada"
else
  echo "ℹ️ Lavalink externo seleccionado: Vesper usará LAVALINK_URL"
fi

exec node src/index.js
