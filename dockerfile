FROM node:18-slim

WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copiar archivos de configuración
COPY package*.json ./
COPY .env.example ./.env.example

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p data/tiktok data/twitch data/youtube logs

# Exponer puerto para health checks
EXPOSE 3000

# Comando para iniciar el bot
CMD ["node", "src/index.js"]