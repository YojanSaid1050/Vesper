# Comandos de Vesper: quién los ve y cuáles ya sobran

Referencia de los 52 comandos registrados, con quién puede verlos en Discord y
cuáles quedan cubiertos por el panel web.

## Cómo decide Discord quién ve cada comando

Hay dos filtros encadenados, y conviene no confundirlos:

1. **`setDefaultMemberPermissions`** — lo aplica **Discord**. Un comando marcado
   con `Administrator` sencillamente *no aparece* en el menú de quien no es
   administrador. Es el filtro visual.
2. **`capability`** — lo aplica **Vesper** al ejecutarse. Aunque alguien
   consiga invocar el comando, se comprueba el permiso otra vez contra los roles
   configurados. Es el filtro real.

Un comando sin `setDefaultMemberPermissions` lo ve todo el mundo, aunque luego
la ejecución falle por falta de permisos. `advertir`, `aislar` y `sanciones`
estaban así: aparecían en el menú de cualquier miembro y solo fallaban al
usarlos. **Corregido**: ahora declaran `ModerateMembers`, así que Discord los
oculta a quien no modera, y el permiso real se sigue comprobando al ejecutar.

## Lo que ve un usuario normal

Solo estos cinco. Todo lo demás está oculto por permisos de Discord:

| Comando | Para qué sirve |
| --- | --- |
| `/panel` | Abre el panel de control (el enlace al panel web). |
| `/musica` | Reproductor: poner, saltar, cola, volumen. |
| `/ticket` | Abre un ticket de soporte. |
| `/sugerir` | Envía una sugerencia al buzón. |
| `/id` | Consulta un caso de moderación por su identificador. |

Antes también veía `/advertir`, `/aislar` y `/sanciones`; ya no.

## Lo que ve un moderador

Los cinco anteriores más `/clear` (requiere Gestionar mensajes) y los tres de
moderación, que en su caso sí funcionan gracias a `capability: MODERATE` o al
rol configurado en `permissions.moderatorRoles` desde el panel.

## Lo que ve un administrador

Todo lo anterior más los 40 comandos de configuración. Aquí está el punto
importante: **esos 40 ya están cubiertos por el panel web.**

## Los 40 comandos que el panel ya reemplaza

Vesper trae un interruptor para ocultarlos: `WEB_ADMIN_MODE=true`. Con eso
puesto, en el siguiente despliegue de comandos desaparecen del menú de Discord
y la administración pasa a hacerse solo desde el panel.

| Grupo | Comandos | Dónde se hace ahora |
| --- | --- | --- |
| Canales y registros | `setwelcome`, `setgoodbye`, `setlog`, `setbotlog`, `setbotrole` | Configuración → Portales y notificaciones |
| Identidad del bot | `setbotname`, `setbotavatar`, `branding`, `resetbranding`, `testbranding` | Configuración → Identidad del bot |
| TikTok | `tiktok-add`, `tiktok-remove`, `tiktok-list`, `tiktok-clear`, `tiktok-setchannel`, `tiktok-setpingrole` | Configuración → Cuentas monitoreadas |
| Twitch | `twitch-add`, `twitch-remove`, `twitch-list`, `twitch-clear`, `twitch-setchannel`, `twitch-setpingrole` | Configuración → Cuentas monitoreadas |
| YouTube | `youtube-add`, `youtube-remove`, `youtube-list`, `youtube-clear`, `youtube-setchannel`, `youtube-setpingrole` | Configuración → Cuentas monitoreadas |
| Configuración general | `vesper-setup`, `serverconfig`, `resetconfig`, `config-dashboard`, `vesper-modulo` | Configuración → Módulos y resumen |
| Moderación y música | `vesper-mod-config`, `vesper-musica-config` | Configuración → Automod / Música |
| Comunidad | `vesper-comunidad` | Configuración → Tickets, sugerencias y destacados |
| Mantenimiento | `cache`, `forcecheck`, `resetalldb`, `vesper-historial` | Panel → Resumen y Auditoría |

**Antes de activar `WEB_ADMIN_MODE=true`**, comprueba que el panel abre y que
inicias sesión con Discord. Vesper tiene una protección para esto: si falta
`WEB_BASE_URL`, `WEB_SESSION_SECRET` o `DISCORD_OAUTH_CLIENT_SECRET`, ignora el
interruptor y deja los comandos visibles, para que un error de variables no te
deje sin forma de administrar el bot.

## Comandos que no se ocultan nunca

`panel`, `musica`, `ticket`, `sugerir`, `id`, `clear`, `advertir`, `aislar`,
`sanciones` y `vesper-control`. Los ocho primeros son de uso diario y no tienen
equivalente en el panel; `vesper-control` es el centro de control dentro de
Discord y sirve de respaldo si el panel se cae.

## Dónde se registra cada comando

- **Globales**: se publican en todos los servidores donde esté Vesper.
- **De Main** (`scope: 'main'`): se publican en Embers Void **y** en Ankerie
  Dimension. Antes solo llegaban a Embers Void, lo que dejaba a Ankerie sin
  `/vesper-control`, `/vesper-modulo`, `/vesper-historial`, `/vesper-mod-config`
  ni `/vesper-musica-config`.
- **De Main principal** (`scope: 'primary_main'`): reservado para lo que solo
  tiene sentido en Embers Void. Ahora mismo no lo usa ningún comando.

## Resumen de lo que puedes retirar

Si el panel ya te funciona, pon `WEB_ADMIN_MODE=true` y vuelve a desplegar
comandos (`npm run deploy`). Pasas de 52 comandos a 12, que es un menú que un
miembro puede leer de un vistazo. Y de esos 12, un miembro sin permisos solo
ve cinco: `/panel`, `/musica`, `/ticket`, `/sugerir` e `/id`.
