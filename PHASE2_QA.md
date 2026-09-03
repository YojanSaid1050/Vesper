# Vesper 2.4.0 — Informe de fase 2

## Alcance implementado

- Servidor Main separado de satélites mediante `MAIN_GUILD_ID`.
- Lista opcional de servidores aprobados.
- Comandos y componentes administrativos exclusivos del Main.
- Personalidad original y embeds actuales únicamente en el Main.
- Mensajes y alertas neutrales en servidores satélite.
- Roles especiales aislados al Main sin convertirlos en configuración por servidor.
- Permisos por capacidades: propietario, administrador, redes, moderación y DJ.
- Centro de control con auditoría, diagnóstico, módulos e historial.
- Módulos persistentes por servidor.
- Historial de notificaciones con retención automática.
- Prevención de duplicados y cola de envíos por canal.
- Reintentos progresivos para fallos temporales.
- Edición de directos finalizados exclusivamente en el Main.
- Moderación opcional con filtros, advertencias, timeouts e historial.
- Música gratuita autohospedada con Lavalink y límites por servidor.
- TikTok sin Apify, con respaldo Chromium para CAPTCHA y HTML incompleto.

## Validaciones automatizadas

- 32 pruebas unitarias y de contrato.
- Serialización de los 45 comandos de Discord.
- Nombres de comandos únicos.
- Separación Main/Satélite.
- Permisos por capacidad.
- Personalidad neutral y conservación del Main.
- Anti-duplicados y finalización de directos.
- Reglas de moderación.
- Reglas principales del reproductor musical.
- Parsers de TikTok, videos fijados y respaldo Chromium simulado.
- Sintaxis de todos los archivos JavaScript.
- Archivos YAML de Lavalink y Docker analizados correctamente.
- Siete archivos visuales protegidos verificados por SHA-256.

Ejecuta en cualquier entorno:

```bash
npm run qa
```

## Pruebas que requieren el alojamiento real

Este entorno no dispone de Docker, Lavalink, credenciales de Discord ni un
navegador Chromium instalado. Por eso las siguientes pruebas deben completarse
después del despliegue:

1. Iniciar Lavalink con `docker compose -f docker-compose.music.yml up -d`.
2. Abrir `/vesper-control` en el Main y comprobar el diagnóstico.
3. Activar música con `/vesper-modulo` y reproducir una búsqueda controlada.
4. Ejecutar `/tiktok-test usuario:<cuenta> tipo:live`.
5. Ejecutar `/tiktok-test usuario:<cuenta> tipo:video`.
6. Realizar un live controlado y confirmar que el mensaje se edita al terminar.
7. Publicar un video de prueba y verificar que solo se envíe una notificación.

## Estado de la prueba pública TikTok

El 31 de agosto de 2026, TikTok respondió HTTP 200 a la consulta pública, pero
entregó un CAPTCHA en lugar de los datos del perfil. Vesper detectó el bloqueo y
activó correctamente el nuevo camino de respaldo. El sandbox no tenía Chromium,
por lo que no fue posible completar aquí la navegación real. El flujo Chromium
se probó mediante un navegador simulado y el Dockerfile instala Chromium en el
entorno de despliegue.

La integración continúa siendo gratuita y no usa Apify, pero TikTok no ofrece
una API oficial gratuita para vigilar cualquier perfil público. Por esa razón no
se puede garantizar disponibilidad absoluta si TikTok bloquea también el
navegador del alojamiento.
