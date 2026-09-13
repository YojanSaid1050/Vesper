# Historial de cambios

## 2.8.0

- Ankerie Dimension (`1124871897688055818`) registrado como Main temático autoaprobado.
- Perfil inicial Cinnamoroll para AnkeBot con azul cielo, blanco, rosa suave y mensajes entre nubes.
- Embers Void permanece como único Main principal y conserva todos sus recursos visuales y controles globales.
- Nueva arquitectura `primary_main`, `themed_main`, `satellite` y `external`.
- Panel web adaptable al perfil del servidor, con apariencia pastel en Ankerie Dimension.
- Configuración web de apodo, avatar de webhooks, colores, bienvenida, despedida y rol temático automático.
- Selectores web de categorías, canales de texto, canales de voz, roles de avisos, permisos y autorroles.
- Canal de voz musical preferido configurable y validado con permisos de conexión y habla.
- Gestión web verificada de cuentas TikTok, Twitch y YouTube.
- Publicación web de paneles de tickets/autorroles y revisión visual de sugerencias.
- Nuevo `/panel` para abrir la consola web desde cualquier servidor aprobado.
- Modo `WEB_ADMIN_MODE` que oculta 40 comandos administrativos redundantes y deja 11 comandos cotidianos.
- Los comandos ocultos permanecen en el código para recuperación segura.
- Esquema de configuración actualizado a versión 4 con migración automática.
- Pruebas ampliadas a 68 casos.
- Valores públicos de propietario, aplicación y Main preparados para el despliegue de Yojan; secretos excluidos del paquete.

## 2.7.1

- Lavalink 4.2.2 integrado en la imagen Docker para que Render inicie el motor musical junto con Vesper.
- Arranque coordinado mediante `tini`, Java y un script de producción con cierre por señales.
- Compatibilidad conservada con un Lavalink externo mediante `LAVALINK_EMBEDDED=false`.
- Nuevo `/musica diagnostico` para revisar módulo, conexión, canal y permisos de voz.
- Espera acotada mientras Lavalink termina de iniciar, en lugar de fallar inmediatamente.
- Mensajes precisos para permisos **Ver canal**, **Conectar** y **Hablar**, canal lleno y errores HTTP.
- Lavalink deja de degradar la disponibilidad de todo Vesper salvo que `MUSIC_REQUIRED=true`.
- URL de Lavalink normalizada para aceptar entradas HTTP(S) o WS(S).
- Pruebas ampliadas a 63 casos sin modificar los recursos visuales originales de Embers Void.

## 2.7.0

- Cuatro módulos opt-in: tickets, sugerencias, autorroles y starboard.
- Tickets privados con límite por usuario, roles de soporte y cierre sin borrado automático.
- Transcripciones HTML escapadas y enviadas a un canal privado configurable.
- Sugerencias con votos, estado pendiente/aprobado/rechazado y nota del equipo.
- Panel de hasta 25 autorroles con validación de permisos y jerarquía del bot.
- Starboard configurable con exclusiones, actualización de conteos y retirada bajo el umbral.
- Los votos de bots y del autor del mensaje no cuentan para el starboard.
- Configuración comunitaria disponible en el panel web con validación del lado servidor.
- Esquema de configuración actualizado a versión 3 con migración automática.
- Nuevos modelos persistentes para tickets, sugerencias y entradas destacadas.
- Catálogo ampliado a 50 comandos y pruebas ampliadas a 59 casos.

## 2.6.0

- Añadido panel web nativo y adaptable en `/panel`, sin compilador ni servicio frontend adicional.
- Inicio de sesión OAuth2 con Discord y vinculación opcional de Google OpenID Connect.
- Vinculación persistente: después de unir ambas cuentas, cualquiera de ellas recupera la identidad web asociada.
- Sesiones opacas almacenadas mediante HMAC en MongoDB, rotación tras OAuth y caducidad automática.
- Protección CSRF, cookies `HttpOnly`/`SameSite`, CSP, límites de solicitudes y cabeceras defensivas.
- Acceso web por servidor calculado de nuevo con permisos y roles actuales de Discord.
- Google puede autorizar al propietario global, pero las sanciones requieren una identidad Discord vinculada.
- Vista de usuario para consultar únicamente sus propios casos.
- Configuración web de módulos, canales, roles de capacidad, música y moderación automática.
- Creación web de advertencias y aislamientos con comprobación de la jerarquía humana y del bot.
- Resolución, revocación, reapertura y notas de casos desde la web.
- Auditoría separada de acciones web con actor, objetivo, campos modificados y retención configurable.
- Tokens OAuth descartados al terminar el inicio de sesión; el token del bot nunca se envía al navegador.
- Ocho pruebas nuevas para identidad, permisos, jerarquía, privacidad, validación, sesiones y recursos del panel.

## 2.5.0

- Añadido `/vesper-setup` para revisar y configurar cada servidor desde Discord.
- Configuración guiada de canales generales, sociales, música y rol automático de bots.
- Administración por servidor de roles para redes, moderación y DJ.
- Activación conjunta de módulos con resumen de estado y progreso.
- Exclusiones de moderación por canal, categoría y rol.
- Casos de moderación con identificador visible, estado y notas internas.
- Las acciones configuradas como advertencia notifican también por mensaje directo cuando es posible.
- Añadido `/caso` para consultar, resolver, revocar, reabrir y documentar casos.
- Revocar un caso de aislamiento retira también el timeout cuando es posible.
- Advertencias, aislamientos, historial y gestión de casos disponibles en satélites aprobados.
- Dominios permitidos normalizados y validados antes de guardarse.
- Diagnóstico ampliado para canales de música, roles eliminados, jerarquía y exclusiones obsoletas.
- Esquema de configuración actualizado a la versión 2 con migración automática.

## 2.4.1

- Corregida la desactivación del módulo de logs para todos los eventos.
- Aplicada la lista cerrada de servidores a comandos, eventos, dashboards y monitores.
- Activados los roles de capacidades almacenados por servidor.
- Añadida autorización interna central para comandos administrativos y moderación.
- Eliminada la carrera entre botones efímeros y el router del dashboard en satélites.
- Convertidas las altas y bajas sociales a operaciones atómicas de MongoDB.
- Añadida versión de esquema y migración inicial de configuraciones.
- Persistencia MongoDB con respaldo local para Twitch y YouTube.
- Corregida la atribución de auditoría por objetivo y ventana temporal.
- Añadida limpieza automática del estado de mensajes repetidos.
- Diferenciadas advertencias automáticas de simples eliminaciones en el historial.
- Reanudación de sesión Lavalink, timeout HTTP y reconexión exponencial.
- Captura de errores asíncronos en eventos y limpiezas programadas.
- Separados los endpoints de vida y disponibilidad del proceso.
- Corregido el despliegue Docker de Render y la ejecución sin privilegios de root.

## 2.4.0

- Separación estricta entre servidor Main y servidores satélite.
- Catálogo de comandos exclusivo del Main con doble validación en ejecución.
- Personalidad original conservada en el Main y perfil neutral en satélites.
- Roles de colores, países, juegos, plataformas y verificación aislados al Main.
- Centro de control Main con auditoría, diagnóstico, módulos e historial.
- Activación persistente por servidor de TikTok, Twitch, YouTube, bienvenida,
  despedida, logs, música y moderación.
- Historial de notificaciones en MongoDB con retención automática configurable.
- Protección anti-duplicados mediante clave única y recuperación de envíos fallidos.
- Reintentos progresivos únicamente ante errores temporales.
- Ciclo completo de directos en el Main, editando el mensaje al finalizar.
- Moderación opcional con advertencias, timeouts, sanciones y filtros.
- Reproductor musical autohospedado con Lavalink, colas y límites por servidor.
- Respaldo Chromium para perfiles y lives TikTok cuando la consulta pública devuelve CAPTCHA.
- Configuración central de música y moderación para servidores aprobados.
- Embeds originales de plataformas y dashboard conservados sin cambios.

## 2.3.0

- Eliminada por completo la dependencia de Apify y todas sus credenciales.
- Directos TikTok detectados desde páginas públicas sin tokens ni créditos.
- Videos TikTok consultados mediante un navegador Chromium autohospedado.
- Navegador local iniciado bajo demanda y detenido con el apagado del bot.
- Selección del video más reciente por ID, evitando que un video fijado genere alertas falsas.
- Cachés independientes de lives y videos con consultas limitadas y en cola.
- Diagnóstico `/tiktok-test` actualizado con estado del proveedor gratuito.
- Fallos de Chromium no interrumpen Discord, Twitch, YouTube ni los lives TikTok.
- Docker actualizado para instalar Chromium sin configuración manual.
- Conservados sin cambios los embeds originales de TikTok.

## 2.2.0

- Consultas globales por cuentas únicas, sin duplicar cobros entre servidores.
- Compatibilidad con formatos actuales y antiguos de resultados TikTok Live.
- Actor de live configurable; se reemplaza el actor anterior en mantenimiento.
- Videos reducidos a un único resultado reciente por perfil.
- Límite mensual local configurable para mantener Apify dentro del plan gratis.
- Persistencia de estado TikTok en MongoDB con respaldo local.
- Errores de red, cuota y proveedor ya no se convierten en resultados vacíos.
- Tokens identificados mediante huella segura y sin reactivación automática.
- Nuevo comando `/tiktok-test` para diagnóstico real.
- Se elimina la limpieza automática que podía retirar cuentas válidas.

## 2.1.0

- Conservado el diseño original de embeds y Componentes V2.
- Corregido el inicio duplicado de monitores y dashboards.
- Añadidas comprobaciones administrativas a botones, selectores y modales.
- Restringido el borrado global a propietarios configurados.
- Corregidas las actualizaciones defectuosas del dashboard.
- Añadido el intent de moderación y soporte para estructuras parciales.
- Añadido health check real para Discord, MongoDB y monitores.
- Implementado cooldown recuperable ante errores repetidos.
- Corregida la ruta duplicada `data/data` y compartido el estado de caché.
- Evitada la eliminación automática de cuentas por fallos temporales de API.
- Agrupadas las consultas de Twitch en lotes de hasta 100 streamers.
- Reducido el consumo de YouTube usando la playlist de subidas y consultas
  agrupadas de detalles.
- Protegida la validación de avatares frente a URLs internas y esperas infinitas.
- Actualizado el entorno a Node.js 24 LTS.
- Convertido el Blueprint de Render a web service.
- Convertidas las credenciales sociales en módulos opcionales.
- Ocultados los secretos en la salida del verificador de entorno.
- Añadidas pruebas automatizadas y flujo de integración continua.
