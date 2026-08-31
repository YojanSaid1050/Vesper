FROM node:24-slim

WORKDIR /app

# Instalar Chromium para el monitor gratuito de videos TikTok
RUN apt-get update && apt-get install -y \
    ca-certificates \
    chromium \
    fonts-liberation \
    git \
    && rm -rf /var/lib/apt/lists/*

ENV TIKTOK_BROWSER_PATH=/usr/bin/chromium

# Copiar archivos de configuración
COPY package*.json ./
COPY .env.example ./.env.example

# Instalar dependencias; el postinstall se ejecuta después de copiar scripts.
RUN npm ci --omit=dev --ignore-scripts

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN npm run postinstall

# Exponer puerto para health checks
EXPOSE 3000

# Comando para iniciar el bot
CMD ["node", "src/index.js"]
