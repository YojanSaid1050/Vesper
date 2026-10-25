#!/usr/bin/env bash
# /usr/local/bin/vesper-duckdns — mantiene tunombre.duckdns.org apuntando a
# la IP pública del servidor. Lo ejecuta cron cada 5 minutos.
set -euo pipefail
FILE="${DUCKDNS_FILE:-/etc/vesper/duckdns.env}"
[ -f "$FILE" ] || exit 0
# shellcheck disable=SC1090
. "$FILE"
if [ -z "${DUCKDNS_DOMAIN:-}" ] || [ -z "${DUCKDNS_TOKEN:-}" ]; then
  echo "Falta DUCKDNS_DOMAIN o DUCKDNS_TOKEN en $FILE" >&2
  exit 0
fi
# Sin «ip=», DuckDNS usa la IP desde la que llega la petición: la del servidor.
result="$(curl -fsS --max-time 15 "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=")"
if [ "$result" = "OK" ]; then
  echo "DuckDNS actualizado: ${DUCKDNS_DOMAIN}.duckdns.org"
else
  echo "DuckDNS respondió «$result»: revisa el dominio y el token" >&2
  exit 1
fi
