#!/usr/bin/env bash
# /usr/local/bin/vesper-update — trae la última versión de Vesper y lo
# reinicia. Equivale a lo que hacía Render en cada despliegue.
#   sudo vesper-update
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/vesper}"
BRANCH="${BRANCH:-main}"
[ "$(id -u)" -eq 0 ] || { echo "Ejecútalo con sudo: sudo vesper-update" >&2; exit 1; }

before="$(git -C "$APP_DIR" log -1 --format=%h)"
git -C "$APP_DIR" fetch -q origin "$BRANCH"
git -C "$APP_DIR" reset -q --hard "origin/$BRANCH"
after="$(git -C "$APP_DIR" log -1 --format=%h)"
chown -R vesper:vesper "$APP_DIR"

if [ "$before" = "$after" ]; then
  echo "Ya estabas en la última versión ($after)."
else
  echo "Actualizando $before → $after"
  git -C "$APP_DIR" log --format='  · %s' "$before..$after" | head -20
fi
sudo -u vesper -H --preserve-env=HTTPS_PROXY,HTTP_PROXY,https_proxy,http_proxy,NO_PROXY,NODE_EXTRA_CA_CERTS,npm_config_cafile bash -c "cd '$APP_DIR' && npm ci --omit=dev --no-audit --no-fund --loglevel=error && (npm rebuild ffmpeg-static --loglevel=error || true) && node scripts/ensure-ffmpeg.js"
systemctl restart vesper
echo "✅ Vesper reiniciado. Registros: vesper-logs"
