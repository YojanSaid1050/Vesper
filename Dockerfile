FROM node:24-slim

WORKDIR /app

# Chromium para el monitor gratuito de TikTok. Ya no hace falta Java: el
# reproductor de música vive dentro del propio bot y usa yt-dlp y ffmpeg, que
# llegan como dependencias de npm.
RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    fonts-liberation \
    git \
    tini \
    && rm -rf /var/lib/apt/lists/*

ENV TIKTOK_BROWSER_PATH=/usr/bin/chromium

# Configuración primero, para aprovechar la caché de capas.
COPY --chown=node:node package*.json ./
COPY --chown=node:node .env.example ./.env.example

RUN npm ci --omit=dev --ignore-scripts

COPY --chown=node:node . .

# El postinstall crea las carpetas y descarga yt-dlp. Si la descarga falla no
# se rompe la imagen: el bot arranca y solo la música queda desactivada.
RUN npm run postinstall && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
CMD ["node", "src/index.js"]
