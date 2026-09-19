# Changelog

## 3.3.0 — La vista previa deja de mentir

El panel enseñaba «(campos originales del aviso)» en la vista previa de casi
todos los registros. Quien entraba a cambiar un mensaje no podía saber qué
publicaba el bot, así que no lo tocaba.

- **La vista previa enseña siempre el mensaje entero.** El catálogo ahora lleva
  los recuadros que publica cada aviso —👤 Usuario, 🆔 ID, 📍 Canal, 📌 Antes,
  📌 Después…— y la vista previa los pinta con datos de ejemplo. Una prueba
  comprueba que ningún mensaje se queda sin con qué pintarse.
- **«Partir del original»**: un botón escribe en el editor el texto con el que
  sale el mensaje hoy, para tener una base que retocar en vez de una caja
  vacía.
- **Ya no quedan `{variables}` en crudo en pantalla.** Faltaban los valores de
  ejemplo de `{boostCount}`, `{boostLevel}`, `{previousLevel}`, `{price}`,
  `{discount}`, `{count}`, `{roleId}` y ocho más.
- **La vista previa respeta lo que hace Discord de verdad**: en un embed
  clásico el título sale sin formato y sin menciones, así que ahí tampoco se
  pintan. Un aviso lo dice y explica que para agrandar la letra hay que pasar
  al contenedor V2. La barra de formato del título pierde citas, listas y
  bloques de código, que en una sola línea no hacen nada.
- **Los mensajes de Ankerie Dimension, rehechos según su concepto**: cortos,
  cercanos y con el limón en el pie en vez de en el título. La paleta pasa a
  cielo para entradas y salidas, magenta para los boosts y limón para lo que
  pide atención.
- **El botón «?» se veía como HTML en crudo** en diez tarjetas del panel, en
  mitad de la descripción. `card()` recibe ahora el texto de ayuda por su
  cuenta.
- **Dos títulos de registro seguían en inglés** («Roles Added», «Roles
  Removed») cuando se añadía o quitaba más de un rol a la vez. Y el singular y
  el plural estaban cambiados.
- Textos del panel repasados uno a uno: fuera «embed», «Components V2» y
  «servidores satélite» de lo que lee un usuario.
- Comprobado en un navegador real: las 13 pantallas de los tres servidores de
  prueba, sin HTML en crudo, sin variables sin sustituir, sin vistas previas
  vacías, sin desbordes de 390 a 1400 px y sin errores de consola.

## 3.2.1 — El panel y la portada, un solo producto

En la 3.2.0 rehice la portada con el lenguaje visual nuevo, pero el interior
del panel se quedó con el anterior: botones cuadrados frente a botones tipo
píldora, esquinas distintas, fondos distintos. Parecían dos webs.

- **Misma forma**: botones redondeados por igual en los dos sitios, y los
  mismos radios de tarjeta, sombras y trazos.
- **Mismo fondo**: el degradado de acento de la portada también tiñe el panel,
  así que entrar deja de ser un corte seco.
- **Navegación redondeada**, y el apartado en el que estás se marca con el
  degradado de acento en vez de un bloque plano.
- **La marca del panel lleva a la portada.** Antes, una vez dentro, no había
  forma de volver a la web pública.
- Comprobado en un navegador real: los dos comparten radio de botón, radio de
  tarjeta y color de fondo, y no hay desbordes de 360 a 1400 px.


## 3.2.0 — Planes, portada y acceso con Google explicado

### Añadido · Planes: gratis, premium y principal
Los monitores no son gratis de tener encendidos. Vigilar TikTok, Twitch y
YouTube significa preguntar cada pocos minutos, por cada cuenta, todo el día;
las ofertas consultan tres tiendas cada media hora; y la música arranca un
ffmpeg y un yt-dlp por cada servidor que suena. Con unos cuantos servidores
así, una máquina modesta se queda sin procesador y sin cuota.

| | Gratis | Premium | Principal |
| --- | --- | --- | --- |
| Bienvenidas, despedidas y boosts | ✅ | ✅ | ✅ |
| Los 27 registros con canal y mención | ✅ | ✅ | ✅ |
| Los 38 mensajes y los paquetes | ✅ | ✅ | ✅ |
| Moderación, tickets, sugerencias, autorroles | ✅ | ✅ | ✅ |
| **TikTok, Twitch y YouTube** | ❌ | ✅ | ✅ |
| **Música** | ❌ | ✅ | ✅ |
| **Ofertas y juegos gratis** | ❌ | ✅ | ✅ |
| Identidad propia del bot | ❌ | ❌ | ✅ |
| Panel dentro de Discord | ❌ | ❌ | ✅ |

- El premium se concede por `PREMIUM_GUILD_IDS` o desde el panel: solo el
  propietario del bot ve el botón, porque es una decisión sobre la máquina.
- **Un servidor que pierde el plan deja de consultar solo.** El corte está en
  los monitores, no en la interfaz: aunque la configuración siga diciendo que
  el módulo está activo, no se hace ni una petición.
- Las funciones de plan **no se esconden**: salen en el menú con un candado y,
  al entrar, una pantalla explica por qué y qué sí está incluido. Esconderlas
  dejaría al administrador preguntándose por qué a él le falta algo.
- Embers Void y Ankerie Dimension son «principal» por serlo: no necesitan plan.

### Añadido · Portada
- La raíz del sitio ya no redirige al panel. Ahora hay una portada de verdad:
  héroe con un ejemplo de lo que la gente verá en su servidor, las funciones
  divididas entre gratis y premium, la comparativa de planes, tres pasos para
  empezar y pie.
- Comparte el claro/oscuro con el panel, así que pasar de una a otro no cambia
  de fondo a mitad de camino.
- Es lo único indexable del sitio; el panel y la API siguen con `noindex`.

### Corregido
- **Guardar un registro fallaba.** `alerts` no estaba en la lista de secciones
  que la base de datos acepta, así que tocar cualquier interruptor de la
  pantalla de registros lanzaba «Sección de configuración no permitida» y no
  se guardaba nada. Es un fallo que introduje yo en la 3.0.0.
- El plan se guarda con su propia función: `updateGuildSection` prefija con el
  nombre de la sección y `plan` es un campo suelto.

### Documentado · El acceso con Google
El error era `redirect_uri_mismatch`. Vesper construía bien la dirección, pero
no decía cuál era. Hay que dar de alta **exactamente** esto en Google Cloud
Console → Credenciales → URIs de redireccionamiento autorizados:

```
https://TU-DOMINIO/auth/google/callback
```

`npm run diagnostico acceso` imprime las dos direcciones (Discord y Google)
listas para copiar, y los errores de OAuth ahora las nombran en el propio
mensaje.


## 3.1.0 — Paquetes de mensajes, tema propio y diagnóstico real

### Añadido · Paquetes de mensajes
- Dos paquetes que escriben **los 38 avisos de golpe**, en un mismo tono y con
  una misma paleta:
  - **Void** — morado profundo, negro y blanco, con los ornamentos de Embers
    Void. La bienvenida es, carácter a carácter, el diseño original.
  - **Limones** — amarillo cítrico y cielo pastel, con la voz de AnkeBot y sus
    guiños («Reclama tu limón», «Devuelve los limones», 🍋 por todas partes).
- Se aplican desde «Todos los mensajes» con un clic, y hay un tercero,
  **«Sin paquete»**, que devuelve los 38 a su texto original.
- Están disponibles en **cualquier servidor**, no solo en los dos Main: un
  servidor nuevo puede partir de uno y retocarlo.
- Aplicar un paquete solo escribe en `embeds`, así que se puede deshacer
  eligiendo otro o volviendo a lo de fábrica, y luego afinar mensaje a mensaje.

### Cambiado · El claro y el oscuro son tuyos, no del servidor
- Antes el panel decidía el fondo a partir del color del servidor: Embers Void
  salía oscuro y Ankerie Dimension blanco, y saltar entre uno y otro te cambiaba
  la pantalla entera. Con más servidores eso sería insoportable.
- Ahora eliges **claro, oscuro o el del sistema** en la esquina inferior
  izquierda, se recuerda en tu navegador y se respeta en todos los servidores.
  Si lo dejas en «el del sistema» y tu equipo cambia solo al anochecer, el panel
  cambia con él.
- El color del servidor **sigue tiñendo el panel**: es lo que hace reconocer de
  un vistazo dónde estás. Lo que ya no decide es si el fondo es blanco o negro.

### Añadido · Diagnóstico contra los servicios reales
- `npm run diagnostico` prueba de verdad, desde el alojamiento, lo que el bot
  necesita: feeds de YouTube, token y canales de Twitch, el navegador de TikTok,
  las tres fuentes de ofertas, MongoDB y el motor de música —incluido abrir el
  audio y comprobar que llegan Ogg/Opus válidos.
- Se puede acotar a un grupo: `npm run diagnostico musica`, `… twitch`, `… acceso`.
- Los canales y cuentas de prueba se cambian con `DIAGNOSTICO_YOUTUBE`,
  `DIAGNOSTICO_TWITCH`, `DIAGNOSTICO_TIKTOK` y `DIAGNOSTICO_MUSICA`.

### Corregido · El acceso con Google
- El error de Google era `redirect_uri_mismatch`: la dirección de vuelta de
  Vesper no estaba dada de alta en Google Cloud Console. El código la construía
  bien, pero el mensaje no decía cuál era ni dónde pegarla.
- Ahora los errores de OAuth se traducen y **dicen la dirección exacta**:
  «añade esta URI de redireccionamiento autorizado: …/auth/google/callback».
- `npm run diagnostico acceso` imprime las dos direcciones (Discord y Google)
  listas para copiar.

### Añadido · Primeros pasos
- Un servidor recién añadido no necesita trece pantallas: la de inicio le
  pregunta qué quiere que haga Vesper —saludar, registrar, avisar de directos,
  darle voz propia, moderar— y lleva a cada sitio. Desaparece sola cuando ya
  está montado.

### Documentado · Qué es exclusivo de los dos Main
Se deja escrito en el código, y se comprueba con pruebas:

| Función | Embers Void y Ankerie Dimension | Cualquier otro servidor |
| --- | --- | --- |
| 38 mensajes editables, dos formatos de embed | ✅ | ✅ |
| 27 registros con canal y mención propios | ✅ | ✅ |
| Paquetes de mensajes | ✅ | ✅ |
| TikTok, Twitch, YouTube, ofertas, moderación, comunidad, música | ✅ | ✅ |
| **Identidad propia del bot** (apodo, avatar y colores por servidor) | ✅ | ❌ |
| **Panel de control dentro de Discord** | ✅ | ❌ |
| **Comandos de identidad** (`/branding`, `/setbotname`…) | ✅ | ❌ |

La lista de exclusivas es corta a propósito: solo lo que cambia la cara del bot
o ocupa un canal permanente.


## 3.0.0 — Música que funciona, registros configurables y panel nuevo

### La música ya funciona
- **Fuera Lavalink.** Era un servidor de Java aparte del bot. En un alojamiento
  que solo ejecuta el bot —Render, Railway y parecidos— ese servidor no existe:
  Vesper intentaba conectarse a `127.0.0.1:2333` contra nada, una y otra vez, y
  la música no funcionó nunca.
- **Reproductor nuevo dentro del propio proceso**: `yt-dlp` busca y extrae,
  `ffmpeg` convierte a Opus y `@discordjs/voice` lo manda al canal de voz. Las
  tres piezas llegan con `npm install`. No hay nada que levantar ni que pagar.
- Acepta búsquedas por texto, enlaces de YouTube y SoundCloud, archivos de audio
  sueltos y emisoras de radio. Si una pista falla —enlace caducado, vídeo
  borrado— se salta, se avisa en el canal y la sesión sigue viva.
- El volumen se aplica dentro de ffmpeg y al cambiarlo se retoma la canción en
  el segundo exacto en el que iba.
- Los errores de `yt-dlp` se traducen: «ese vídeo es privado», «pide iniciar
  sesión», «el alojamiento no pudo conectarse a internet».
- La música **ya no bloquea el arranque**. Antes se esperaban 15 segundos a un
  servidor inexistente y el fallo se escribía como si algo se hubiera roto.
- El `Dockerfile` ya no instala Java ni copia el `.jar`; desaparecen
  `docker-compose.music.yml`, `lavalink/` y `scripts/start-production.sh`.
- **La instalación nunca se cae por la música.** La librería que descargaba
  yt-dlp lo hacía dentro de su propio `postinstall`: si GitHub no respondía,
  `npm install` terminaba con error y **el despliegue entero se caía por no
  poder poner música**. Ahora lo descarga `scripts/ensure-ytdlp.js`, que avisa
  y sigue; se reintenta con `npm run music:setup`.

### Corregido · 20 fallos reales encontrados auditando el bot entero
- **`monitorError` lanzaba en cada fallo de monitor.** Su parámetro se llamaba
  `error` y tapaba a la función `error()` del mismo módulo, así que la última
  línea lanzaba «error is not a function», la excepción salía del `catch` de
  quien llamaba y **el fallo original se perdía**. Por eso, cuando el bot no
  podía crear un webhook, el envío de respaldo nunca se ejecutaba y el aviso no
  se publicaba en ningún sitio.
- **El agradecimiento por el boost se repetía.** Se comparaba `premiumSince`,
  un getter que fabrica un `Date` nuevo en cada acceso: dos fechas iguales nunca
  son `===`, así que cada cambio de rol o de apodo de un booster disparaba otra
  vez «💜 ¡Gracias por el boost!». Ahora se comparan las marcas de tiempo.
- **Ediciones de mensaje inventadas.** `messageUpdate` comparaba contra mensajes
  parciales, cuyo contenido es `null`: al adjuntar Discord la vista previa de un
  enlace se registraba una edición que nunca ocurrió, incluso de bots.
- **Los registros de voz reventaban** cuando `newState.member` era null (alguien
  desconectado al salir del servidor, o caché limpia).
- **La mención en el título de un embed salía como número.** Discord solo
  convierte `<@123…>` en la descripción; en títulos, pies y nombres de autor lo
  deja crudo. Era el «Hasta pronto \<@292953664492929025\>» de la despedida de
  Ankerie Dimension. Ahora en esos huecos sale el nombre, y en el contenedor V2
  —donde sí funcionan— se mantiene la mención.
- **Errores 50035 por pasarse de los límites de Discord**: la lista de autorroles
  como `content`, la de canales de YouTube en un campo, y tres listas de
  menciones de 1000 caracteres dentro de un campo de 1024. Nuevo módulo
  `discordLimits` con recorte por palabras, y una red de seguridad en
  `sendBrandedMessage` que recorta cualquier mensaje antes de publicarlo.
- **El refresco del panel era código muerto** en `tiktok-setchannel` y
  `youtube-setchannel`: estaba escrito después de los `return`.
- **Los botones de confirmación caducados** daban «La interacción falló» sin
  explicar nada; ahora el mensaje se edita al caducar.
- **`!testwelcome` y `!testgoodbye` ignoraban la configuración** y enseñaban
  siempre el diseño de fábrica.
- **`/testbranding` tenía una copia a mano del diseño**, en inglés y sin leer la
  configuración; ahora usa las mismas funciones que publican de verdad. Y decía
  «enviada correctamente» sin comprobar que se hubiera enviado.
- **Los botones de rol fallaban en silencio**: tras el `deferUpdate` el catch
  general ya no podía responder, así que a quien le faltaba el permiso le
  pasaba, simplemente, nada.
- **`members.me` sin comprobar** en `/vesper-setup`, que además confundía «no
  tengo permiso» con «no pude comprobarlo» y rechazaba canales válidos.
- **`/cleandb` se quedaba colgado** en «⏳ Eliminando…» si MongoDB fallaba a
  mitad; ahora dice cuántos se borraron.
- **`editBrandedMessage` sin respaldo**: al terminar un directo, si el aviso se
  había enviado sin webhook, lanzaba «Unknown Message» y nunca se marcaba.
- **El pie de `/caso` mostraba el ID del moderador**; pasa a un campo, donde la
  mención sí se convierte en nombre.
- **21 títulos de registro estaban en inglés** («Member Joined», «Role Added»,
  «User Banned»…) en un bot en castellano. Los diseños decorativos de Embers
  Void no se han tocado: las pruebas de paridad lo comprueban.

### Añadido · Cada registro se enciende, se apaga y se redirige por separado
- Nueva pantalla **«Registros»** con los 27 avisos que Vesper puede anotar.
  Cada uno tiene **su interruptor, su canal y su mención**, independientes.
- Antes solo se podía encender o apagar el módulo entero y todo caía en el
  mismo canal. Ahora puedes mandar los baneos a #moderación, las entradas a
  #general y apagar los registros de voz sin tocar nada más.
- Un aviso sin canal propio usa el de su grupo, y si no, el general: nunca se
  pierde por no haber elegido uno.
- Si el módulo está apagado, el interruptor propio no puede encenderlo, y el
  panel **lo dice** en vez de aparentar que está activo.
- Botones para encender todo, apagar todo o volver a lo de fábrica.
- «Bot añadido» y «Miembro entró/salió» construían su embed a mano, saltándose
  el catálogo: eran los únicos que no se podían editar. Ya no.

### Cambiado · Panel rehecho
- **Navegación por lo que quieres hacer**, no por cómo está hecho el bot:
  «Tu servidor», «Cuando pasa algo», «Lo que dice», «Comunidad», «Ajustes».
- **El inicio ya no es una vitrina de cifras**: es una lista de cosas que
  arreglar, ordenada por gravedad, y cada una lleva de un clic a su pantalla.
  Detecta módulos encendidos sin canal, avisos que no se publican en ninguna
  parte, cuentas vigiladas sin destino, monitores en pausa y casos abiertos.
- **Buscador con Ctrl+K** (o `/`): busca entre pantallas, mensajes y registros,
  sin tildes y por palabras sueltas, y al llegar resalta el ajuste.
- **Barra de guardado** abajo, que no se puede pasar por alto, en lugar de las
  etiquetas diminutas de «cambios sin guardar» dentro de cada tarjeta.
- Paleta nueva: neutros fríos en vez del morado teñido, radios más contenidos y
  más contraste. El color del servidor destaca mucho más.
- Los interruptores de registro guardan solos y repintan solo su fila, sin
  mandarte el scroll al principio de la lista.


## 2.9.0 — Todos los mensajes editables, boosts y ofertas de juegos

### Corregido
- **El falso «Role Added» al eliminar un bot.** Vesper usa `Partials.GuildMember`,
  así que el miembro anterior puede llegar sin su caché de roles. La comparación
  tomaba esa caché vacía como punto de partida y concluía que TODOS los roles
  acababan de asignarse. Ahora, si no se puede saber qué había antes, no se
  registra nada. El mismo fallo afectaba al registro de cambios de apodo.
- **El registro de roles solo informaba del primero.** Si alguien recibía tres
  roles a la vez, los otros dos no aparecían.
- **Tres registros se saltaban la identidad del bot.** «Rol creado» y los tres
  de voz usaban `channel.send` directamente en vez del webhook, así que salían
  con el nombre y el avatar de la cuenta en lugar de los configurados.

### Añadido · Todos los mensajes se editan desde la web
- Nueva sección **«Todos los mensajes»** con los **38 avisos** que publica
  Vesper, agrupados por tema y con vista previa en vivo: bienvenida, despedida,
  los 22 registros del servidor, los avisos de moderación, los de redes y los
  de ofertas.
- De cada uno se puede cambiar título, cuerpo, color, imagen, pie de página y
  si se muestra la imagen de perfil, con variables propias de cada mensaje.
- **Nada cambia si no lo tocas.** Un campo vacío usa el valor original; escribir
  un cuerpo sustituye los campos del aviso. Cada mensaje indica si está
  «Original» o «Personalizado», y se puede restablecer.

### Añadido · Las dos versiones de embed, en los dos servidores
- Cada mensaje se puede publicar como **embed clásico** (barra de color al lado,
  miniatura, campos y pie con la hora) o como **contenedor Components V2** (el
  bloque con borde de color y títulos grandes que estrenó Embers Void). La
  elección es por mensaje y está disponible en **los dos Main**: Ankerie
  Dimension puede usar el contenedor V2 y Embers Void puede usar el clásico.
- El mismo contenido se pinta de las dos formas, así que cambiar de versión no
  borra nada de lo escrito. El contenedor V2 no tiene miniatura y publica el pie
  como texto pequeño (`-#`), que es su equivalente en Discord.
- Mientras no se toque el selector, cada mensaje sale con la versión de siempre:
  las pruebas de paridad comprueban que la bienvenida de Embers Void sigue
  saliendo carácter a carácter igual.
- Los avisos que no son embed (automoderación y el aviso por privado) no ofrecen
  el selector, y la API lo rechaza si se intenta forzar.

### Añadido · Guía de formato y paleta de símbolos
- **Guía de formato** en las dos pantallas de edición: una tabla con todos los
  símbolos de Discord y lo que hace cada uno, con un ejemplo lado a lado de lo
  que se escribe y lo que se ve. Explica cómo se pone **la letra más grande**
  (`#`, `##`, `###`) y cómo se pone diminuta (`-#`), que es lo que no tiene
  botón en Discord.
- **Barra de formato** encima de cada caja de texto: tamaño, negrita, cursiva,
  subrayado, tachado, spoiler, citas, listas, código y enlaces. Respeta la
  selección y se puede quitar volviendo a pulsar.
- **Paleta de adornos y letras**: 126 símbolos ornamentales agrupados por estilo
  (marcos, estrellas, gótico, corazones, separadores, flechas, sellos) y 11
  alfabetos decorativos de Unicode — los mismos de los diseños del servidor
  (𝐴 𝑛𝑒𝑤 𝑤𝑎𝑛𝑑𝑒𝑟𝑒𝑟, 𝑾𝒆𝒍𝒄𝒐𝒎𝒆, ℬ𝒾ℯ𝓃𝓋ℯ𝓃𝒾𝒹ℴ, 𝔅𝔦𝔢𝔫𝔳𝔢𝔫𝔦𝔡𝔬…). Se escribe el texto una vez
  y se inserta convertido donde esté el cursor.
- La vista previa entiende ahora texto pequeño, citas, listas, subrayado,
  spoilers, bloques de código y enlaces con texto propio.

### Añadido · Boosts de Nitro
- **Agradecimiento por boost**, mensaje al retirarlo y aviso de **nuevo nivel de
  mejora** del servidor, con su propio canal configurable (si no se elige, usa el
  de bienvenida) y su propio módulo.

### Añadido · Ofertas y juegos gratis
- Nuevo módulo que publica en el canal que elijas, con tres fuentes **gratuitas
  y sin clave**: juegos gratis de **Epic Games**, sorteos y llaves de **Steam,
  GOG, Ubisoft e itch.io** (vía GamerPower) y **rebajas de Steam** por encima del
  descuento que configures.
- Recuerda lo ya publicado para no repetirse, limita cuántos avisos manda por
  ronda y permite elegir tiendas y rol al que mencionar.

### Añadido · Más eventos de Discord
- Registro de **mensajes purgados** (borrados en bloque) y de **hilos creados**.

### Cambiado · YouTube deja de depender de la cuota
- El descubrimiento de contenido pasa a hacerse por los **feeds RSS públicos**
  de YouTube, que no consumen cuota ni necesitan clave. La API solo se usa para
  los detalles de lo que es nuevo.
- Antes, vigilar un canal costaba unas **1.150 unidades al día**, y la cuota
  gratuita (10.000) daba para ocho o nueve canales. Ahora el gasto depende de
  que haya contenido nuevo, no de cada cuánto se mira.
- Se puede volver al comportamiento anterior con `YOUTUBE_USE_RSS=false`.

### Cambiado · El panel ya no usa los diálogos del navegador
- `confirm()` y `prompt()` mostraban una caja del navegador con el dominio del
  alojamiento. Se sustituyen por un diálogo propio, accesible y con el estilo del
  panel. El lint impide que vuelvan a colarse.


## 2.8.2 — Panel reconstruido y verificación completa del bot

### Panel web: rehecho de cero
- **Nueva estética y nueva navegación.** Se sustituyen las cuatro pestañas (una
  de ellas con veinte formularios dentro) por diez secciones con su propia
  pantalla: Inicio, Identidad, Bienvenidas, Avisos de redes, Moderación,
  Comunidad, Música, Módulos y permisos, Configuración y Auditoría.
- **Todo el panel es dinámico.** El color de acento, el modo claro u oscuro, el
  nombre y el avatar de la barra lateral salen de la configuración del servidor
  que estés editando. Si cambias el color principal, el panel entero se repinta
  mientras mueves el selector, y el color del texto sobre el acento se calcula
  por contraste para que nunca quede ilegible.
- **Vista previa de la identidad.** Una tarjeta muestra cómo verá un miembro los
  mensajes del bot: avatar, nombre y etiqueta. Se actualiza mientras escribes y
  dice de dónde sale cada valor (identidad, branding o cuenta del bot).
- **Vista previa de los embeds** con el aspecto real de Discord, incluida la
  estructura Components V2 de Embers Void.
- **Branding editable.** `branding.name` y `branding.avatar` no se podían tocar
  desde el panel pese a que este declaraba reemplazar `/setbotname`,
  `/setbotavatar` y `/branding`. Ahora sí.
- **La caché de webhooks se vacía al guardar** identidad o branding: antes el
  cambio tardaba hasta cinco minutos en verse en Discord.
- Aviso de cambios sin guardar al salir de una pantalla o cerrar la pestaña.
- Estados de carga, de error y vacíos en todas las secciones.
- Menú lateral plegable en móvil, con foco y tecla Escape.

### Corregido
- **`/` ya no devuelve un JSON.** Un navegador que abra la raíz es redirigido a
  `/panel`; un monitor que pida `Accept: application/json` sigue recibiendo el
  estado de siempre.
- **`[hidden]` no ocultaba nada.** Las clases con `display` explícito ganaban al
  atributo, así que la pantalla de inicio de sesión se pintaba encima del panel.
- **`/forcecheck` se rompía** al resumir un monitor que fallaba sin mensaje:
  `errors.push({ error: undefined })` y luego `undefined.substring(...)`.
- **El manejador de botones se rompía** si la interacción no traía `customId`.
- **Los monitores se caían** si un canal configurado no pertenecía a un servidor
  (`channel.guild.members.me` sin comprobar).
- **`/cache` se rompía** si las estadísticas del proveedor de TikTok llegaban
  incompletas.

### Añadido
- **Banco de pruebas de superficie del bot** (`test/botSurface.test.js`): ejecuta
  los 52 comandos (y cada subcomando) con Discord y MongoDB simulados, y verifica
  que ninguno lanza un error de programación y que todos responden a la
  interacción. También prueba los manejadores de botones, menús y modales con
  identificadores inexistentes y con nombres del prototipo de `Object`, y la
  política de eventos en los tres tipos de servidor. Los cinco fallos de arriba
  los encontró esta prueba.
- Comprobación de que la raíz redirige y de que el panel no depende de recursos
  externos ni usa atributos `style` en línea, que su propia CSP bloquearía.


## 2.8.1 — Auditoría, editor de embeds y paridad entre Main

### Corregido (crítico)
- **`/health` ya no tumba el servicio.** Devolvía 503 si un monitor entraba en
  pausa o si MongoDB se reconectaba, y Render reiniciaba el contenedor en bucle.
  Ahora `/health` solo mira si el proceso debe seguir vivo y `/ready` es la
  comprobación estricta.
- **La migración de esquema ya no borra el perfil del servidor.** Cada subida de
  `schemaVersion` reemplazaba `profile` entero y se perdían nombre, colores y
  mensajes personalizados. Ahora solo rellena lo que falta.
- **Token de Twitch**: sin margen de expiración, sin reintento ante un 401, sin
  tiempo de espera y sin deduplicación. Un token revocado dejaba los avisos
  caídos hasta 60 días sin error visible. Corregidos los cuatro problemas.
- **Arranque**: `guild.members.me` podía ser `null` y lanzaba un TypeError al
  aplicar el apodo del perfil.
- **Errores de comando**: si un comando ya había respondido, el manejador de
  errores lanzaba `InteractionAlreadyReplied` y ocultaba el error real.
- **Reintento de arranque**: cada reintento por MongoDB creaba un `BotClient`
  nuevo sin destruir el anterior, acumulando sockets y listeners.

### Corregido (rendimiento y estabilidad)
- **Caché de configuración por servidor** (`GUILD_CONFIG_CACHE_MS`, 30 s por
  defecto). Antes había una consulta a Atlas por cada mensaje del servidor.
- **Twitch en lotes de 100.** Con más cuentas la API devolvía 400 y el monitor
  entero fallaba.
- El panel hacía `members.fetch({ force: true })` por servidor y por petición.
- Cachés sin límite en el monitor de Twitch.
- Las trazas `[DEBUG]` del dashboard se emitían siempre en producción.
- `ephemeral: true` (obsoleto en discord.js 14.27) sustituido por `flags`.
- Los mapas de roles se consultaban sin `Object.hasOwn`, así que un `customId`
  como `constructor` se tragaba interacciones de otros manejadores.

### Añadido
- **Editor de embeds de bienvenida y despedida en el panel**, con vista previa
  en vivo, variables (`{user}`, `{username}`, `{displayName}`, `{server}`,
  `{memberCount}`, `{userId}`) y botón de restablecer.
  - En **Embers Void** se conserva la estructura Components V2 original
    (contenedor, separador, tipografía): solo salen a configuración el texto, el
    color del borde y la imagen. Sin nada guardado, el mensaje publicado es
    idéntico carácter a carácter al de antes, y hay pruebas que lo verifican.
  - En **Ankerie Dimension** el editor incluye además pie de página, imagen y
    miniatura. Los textos guardados antes en `profile` se siguen respetando.
- **Paridad entre Main.** Los comandos `scope: 'main'` ahora se registran en
  Embers Void y en Ankerie Dimension, el dashboard de Discord funciona en ambos
  y la identidad del bot se edita en los dos.
- **Resumen completo de configuración** en el panel, con los IDs ya resueltos a
  nombres de canal y de rol, y botón para copiarlo como JSON.
- `COMANDOS.md`: quién ve cada comando y cuáles ya cubre el panel.

### Corregido (panel web)
- El panel desbordaba en horizontal en pantallas estrechas, en todas las
  pestañas. Verificado a 360, 420, 768, 1024 y 1400 px.
- La vista previa usaba un atributo `style` en línea, que la CSP del propio
  panel bloquea; el color se aplica ahora por CSSOM.
- Los módulos se listaban por su clave interna (`selfroles`, `starboard`); ahora
  llevan nombre y descripción en español.
- Un fallo de red al arrancar el panel se mostraba como «el panel no está
  habilitado», que mandaba a revisar lo que no era.
- La insignia de estado decía «operativo» con monitores en pausa; ahora nombra
  el monitor afectado.
- El botón que se deshabilitaba al guardar se deducía de `document.activeElement`
  y podía ser el equivocado.
- Las pestañas no declaraban `role="tab"` ni `aria-selected`.
- `/advertir`, `/aislar` y `/sanciones` aparecían en el menú de cualquier
  miembro; ahora Discord los oculta a quien no modera.

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
