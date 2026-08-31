# Historial de cambios

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
