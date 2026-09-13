FROM ghcr.io/lavalink-devs/lavalink:4.2.2 AS lavalink

FROM node:24-slim

WORKDIR /app

# Instalar Chromium para el monitor gratuito de videos TikTok
RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    fonts-liberation \
    git \
    openjdk-17-jre-headless \
    tini \
    && rm -rf /var/lib/apt/lists/*

ENV TIKTOK_BROWSER_PATH=/usr/bin/chromium
ENV LAVALINK_EMBEDDED=true
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx256m -XX:+UseG1GC"

# El mismo contenedor puede ejecutar Lavalink. Esto corrige los despliegues
# donde docker-compose no se ejecuta (por ejemplo, un único servicio Docker).
COPY --from=lavalink /opt/Lavalink/Lavalink.jar /opt/Lavalink/Lavalink.jar

# Copiar archivos de configuración
COPY --chown=node:node package*.json ./
COPY --chown=node:node .env.example ./.env.example

# Instalar dependencias; el postinstall se ejecuta después de copiar scripts.
RUN npm ci --omit=dev --ignore-scripts

# Copiar código fuente
COPY --chown=node:node . .

# Crear directorios necesarios
RUN npm run postinstall \
    && chmod +x /app/scripts/start-production.sh \
    && chown -R node:node /app /opt/Lavalink

USER node

# Exponer puerto para health checks
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]

# Inicia Lavalink local cuando está habilitado y después Vesper.
CMD ["/app/scripts/start-production.sh"]
