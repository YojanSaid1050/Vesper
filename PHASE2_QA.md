# Vesper 2.8.0 — Informe de panel web, AnkeBot, administración y comunidad

## Alcance implementado

- Servidor Main separado de satélites mediante `MAIN_GUILD_ID`.
- Lista cerrada de servidores aprobados aplicada también a los monitores.
- Comandos y componentes administrativos exclusivos del Main.
- Personalidad original y embeds actuales únicamente en el Main.
- Mensajes y alertas neutrales en servidores satélite.
- Roles especiales del Main aislados y capacidades administrativas configurables por servidor.
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
- Panel web nativo servido por el mismo proceso de Vesper.
- OAuth Discord y Google opcional con vinculación de identidades.
- Asociación persistente Discord/Google sin almacenar access tokens.
- Sesiones y auditoría web persistentes en MongoDB.
- Configuración, moderación y vista privada de usuario desde navegador.
- Tickets privados con cierre, transcripciones y roles de soporte.
- Sugerencias votables y revisión administrativa.
- Autorroles seguros y starboard configurable.
- Configuración, publicación comunitaria y revisión de sugerencias desde el panel web.

## Validaciones automatizadas

- 68 pruebas unitarias y de contrato.
- Serialización de los 51 comandos fuente y catálogo web reducido a 11 comandos visibles.
- Nombres de comandos únicos.
- Separación Main/Satélite.
- Permisos por capacidad.
- Personalidad neutral y conservación del Main.
- Anti-duplicados y finalización de directos.
- Reglas de moderación.
- Reglas principales del reproductor musical.
- Reanudación, timeout y backoff del cliente Lavalink.
- Enrutamiento seguro de botones efímeros.
- Atribución reciente y por objetivo de audit logs.
- Configuración predeterminada versionada.
- Parsers de TikTok, videos fijados y respaldo Chromium simulado.
- Sintaxis de todos los archivos JavaScript.
- Sintaxis y configuración estática de los archivos de despliegue revisadas.
- Auditoría de dependencias sin vulnerabilidades conocidas.
- Siete archivos visuales protegidos verificados por SHA-256.
- Identidades web, permisos por servidor, jerarquía, CSRF/HMAC y validación de configuración.

Ejecuta en cualquier entorno:

```bash
npm run qa
```

## Pruebas que requieren el alojamiento real

Este entorno no dispone de Docker, Lavalink, credenciales de Discord ni un
navegador Chromium instalado. Por eso las siguientes pruebas deben completarse
después del despliegue:

1. Confirmar en los logs de Render que Lavalink y Vesper se iniciaron.
2. Ejecutar `/musica diagnostico` dentro del canal de voz previsto.
3. Activar música con `/vesper-setup modulos` y reproducir una búsqueda controlada.
4. Ejecutar `/tiktok-test usuario:<cuenta> tipo:live`.
5. Ejecutar `/tiktok-test usuario:<cuenta> tipo:video`.
6. Realizar un live controlado y confirmar que el mensaje se edita al terminar.
7. Publicar un video de prueba y verificar que solo se envíe una notificación.
8. Abrir `/panel`, iniciar con Discord y confirmar los servidores disponibles.
9. Vincular el correo propietario de Google y comprobar que no permite sancionar sin Discord.
10. Guardar una configuración y revisar su entrada en Auditoría.
11. Abrir y cerrar un ticket; descargar la transcripción desde el canal privado.
12. Probar un autorrol situado debajo de Vesper y otro situado por encima.
13. Alcanzar y retirar el umbral del starboard con usuarios distintos al autor.

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
