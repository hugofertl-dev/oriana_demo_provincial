# Lessons — memoria ESTABLE del proyecto

> Gotchas técnicos, contratos, trampas: lo que le costaría horas descubrir a un
> recién llegado (humano o agente). Se alimenta desde `feature-close`.
> Regla: si una lección queda obsoleta, SE BORRA o corrige — no conviven dos verdades.

## Formato de entrada

```
### <título corto> (AAAA-MM-DD)
<el hecho, 1-4 líneas. Qué esperabas, qué es en realidad, dónde está la evidencia.>
```

<!-- Entradas: -->

### iOS Safari: el micrófono (getUserMedia) solo anda en https y el "no" se pega por-sitio (2026-07-06)
`navigator.mediaDevices.getUserMedia` en iOS Safari: (1) requiere **https** (contexto
seguro) — en http/LAN el API ni existe y no se puede pedir permiso; (2) el prompt del
sistema **solo** aparece si se llama a getUserMedia **dentro de un gesto de usuario**
(por eso el botón "Activar" del panel llama getUserMedia directo, no tras un await);
(3) si el usuario deniega/descarta una vez, iOS lo recuerda **por-sitio** y **NUNCA vuelve
a preguntar** (aunque Ajustes › Safari › Micrófono esté en "Preguntar"): `getUserMedia`
rechaza al instante con `NotAllowedError`. Fix del lado del usuario: **aA › Ajustes del
sitio web › Micrófono › Permitir**, o **Ajustes › Safari › Avanzado › Datos de sitios web →
borrar el sitio**. No hay forma de resetearlo desde JS.

### iOS Safari: autoplay de audio bloqueado tras un await — primear un <audio> reusado (2026-07-06)
iOS bloquea `Audio.play()` si no está "pegado" a un gesto de usuario. En `speak()` el audio
llega **después** de un `await` (fetch de TTS al servidor), así que el gesto original ya
expiró → play() rechaza en silencio (y sin await, la promesa rechazada queda sin manejar).
Solución (en `index.html`): reusar **UN solo** elemento `<audio>` (`ttsAudio`) y
"desbloquearlo" con `primeAudio()` (reproduce un clip WAV silencioso generado al vuelo)
**durante el toque del micrófono**; luego `speak()` reproduce sobre ese mismo elemento ya
habilitado y hace `await ttsAudio.play()` (si aún se bloquea, cae a la voz del navegador).
NO sirve `new Audio()` por cada reproducción: cada elemento nuevo nace bloqueado.

### index.html y oriana-mobile.html deben ser idénticos (2026-07-06)
Son copias byte a byte. La app canónica es `index.html`; `oriana-mobile.html` es un
espejo que se sirve como raíz del proxy local. Al editar, cambiar `index.html` y luego
`cp index.html oriana-mobile.html`. `scripts/syntax_check.sh` bloquea si difieren.
`oriana-demo.html` es una variante vieja/aparte — NO se sincroniza.

### La API key de ElevenLabs nunca va al cliente (2026-07-06)
La voz usa la función serverless `/api/tts` (`netlify/functions/tts.js`, redirigida en
`netlify.toml`), que inyecta `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` del entorno. En
`index.html`, `USE_SERVER_TTS=true` por defecto. Si faltan las env vars, la función responde
500 y la demo cae sola a la voz del navegador (`speechSynthesis`) — no se rompe. Deploy: cargar
ambas env vars en Netlify (ver `COMO-PUBLICAR.md`).

### No hay build; los tests corren con jsdom vía node (2026-07-06)
Sitio 100% estático. `verify.sh` corre `scripts/syntax_check.sh` (node --check sobre las
funciones, validación del JS inline de los .html, py_compile del proxy, e invariante
index==mobile). Para tests de lógica del chat: `node test/reclamos.test.js` carga index.html
con **jsdom** (devDep en package.json), stubbea speechSynthesis/SpeechRecognition/Audio/fetch
en `beforeParse`, y hace síncrono `typing` (`window.typing=cb=>cb()`). OJO: `flow` y `DB` son
`let`/`const` de nivel superior → NO son props de `window`; leerlos con `window.eval("flow")`
(el eval global sí ve el entorno léxico). Las `function` sí quedan en `window`.

### El motor de intenciones es regex ordenado: reglas nuevas pueden pisar intents críticos (2026-07-06)
`handle()` evalúa reglas regex EN ORDEN y la primera que matchea gana. Al agregar una regla:
(1) ponerla en la posición correcta respecto de las existentes; (2) usar triggers ESPECÍFICOS,
no genéricos como `problema` (colisiona con casi todo); (3) verificar que no le robe casos a la
**línea 144/violencia** (prioridad de seguridad) ni a "hospital más cercano"/turnos/policía.
Caso real: una regla reclamo-hospital con `maltrat` corriendo antes que la de violencia desviaba
revelaciones de violencia con mención médica al flujo de ticket. El disparador de entrada debe
ser conservador; el detalle fino (ej. "trato inadecuado") se resuelve DENTRO del flujo. Hay
tests de regresión de estas colisiones en `test/reclamos.test.js`.

### Re-stagear (git add) después de editar, antes de commitear (2026-07-06)
Si se hace `git add` y luego se siguen editando archivos (p.ej. tras un review), el índice
queda con la versión vieja. `verify.sh` da verde porque lee el working tree, no el índice →
el commit se llevaría el código viejo. Antes de commitear: `git add -A` de nuevo y confirmar
con `git diff --cached`.

### Detalle visual menor conocido: badge de estado en listas .benefit (2026-07-06)
En las listas tipo `.benefit` + `.amt` (turnos y "Mis reclamos"), con título largo + badge de
texto largo (ej. "En gestión"), el badge queda pegado al borde derecho. Es comportamiento
heredado del componente original de turnos, no específico de reclamos. Si molesta, ajustar el
layout de `.benefit`/`.amt` en el CSS (afecta a ambas pantallas por igual).

### El endpoint /api/chat es un proxy LLM público SIN rate-limit (deuda) (2026-07-06)
`netlify/functions/chat.js` proxea a Claude con `LLM_API_KEY` del entorno. Es público (CORS),
sin auth ni rate-limit → un tercero puede quemar el presupuesto de la API key llamándolo en loop
(vía `curl`; CORS solo frena navegadores de terceros, no scripts). Mitigado en costo POR REQUEST
(tope body 40 KB, context 25 KB, history 16 msgs × 2000 chars, `max_tokens:1024`, `thinking:disabled`)
pero NO en volumen. Pendiente: rate-limit por IP / edge. Lever parcial: setear `ALLOWED_ORIGIN`
en Netlify (restringe CORS al dominio). Deploy: cargar `LLM_API_KEY` (y opcional `ALLOWED_ORIGIN`)
en las env vars de Netlify. Ojo: `netlify/functions/tts.js` tiene el mismo patrón CORS `*`.

### No confiar en el `action` del LLM para gatear estado sin validar (2026-07-06)
El chat-LLM devuelve `action` (crear_turno/crear_reclamo/...) que el frontend ejecuta contra la
DB. `ejecutarAccion` (index.html) debe: (1) validar que la action trae TODOS los campos requeridos
antes de crear — si falta uno, pedirlo en vez de un no-op silencioso que deja un "confirmado"
fantasma; (2) ser idempotente — el modelo puede re-emitir una action ya confirmada (ej. al decir
"gracias") y duplicaría el ticket; se compara contra la firma de la última action creada
(`lastActionKey`). El `OUTPUT_SCHEMA` de chat.js restringe `action.type` a un enum, así que no se
pueden fabricar acciones novedosas. Tests en `test/reclamos.test.js`.

### Remapear toda la paleta de golpe con alias en :root (2026-07-07)
Para un rediseño CSS-first sin tocar el markup/JS: reescribir `:root` con los tokens
NUEVOS + **alias de los nombres viejos apuntando a ellos** (`--teal:var(--primary)`,
`--line:var(--border)`, `--muted:var(--ink-medium)`, `--n1..3`, `--ink-soft`, etc.).
Todo el `var(--teal)` inline del markup/JS toma la paleta nueva sin cambiar una sola
clase → los hooks de los tests/handlers quedan intactos. Fue la palanca del rediseño.

### Screenshot headless: encuadrar el teléfono con viewport 480 (2026-07-07)
El `.phone` es `min(430px,100vw)`. Con `chrome --headless=new --window-size=430,...`
el teléfono queda con el borde derecho FUERA del frame (parece cortado) — NO es overflow
real (se midió `documentElement.scrollWidth <= clientWidth`). Fix: capturar con
`--window-size=480,980 --force-device-scale-factor=2` → el teléfono de 430 queda centrado
y completo. Para manejar la app en el screenshot: inyectar un `<script>` con
`window.typing=cb=>cb()` (typing síncrono) y `show("pantalla")` antes de capturar.
Ojo: `--screenshot` a secas captura ANTES de que corra el script inyectado en `load`
(sale siempre el login) — envolver el `show(...)` en `setTimeout(...,400)` y agregar
`--virtual-time-budget=3000` para que Chrome espere a que la app navegue (2026-07-07).

### iOS: el mic queda SORDO tras reproducir TTS por `<audio>` — usar AudioContext (2026-07-07)
Síntoma: tras una respuesta hablada, el próximo dictado arranca (`onstart` y hasta
`onaudiostart`) pero NUNCA llega `onspeechstart`/`onresult` — el mic entrega silencio
durante toda esa sesión; se recupera solo ~15-60 s después. Causa: iOS retiene la
sesión de audio del `<audio>` element en modo reproducción y no hay forma de soltarla
a demanda (descargar el src con `load()` NO alcanza; refrescar getUserMedia tampoco).
**Cura (fix #4):** reproducir el mp3 del TTS por **AudioContext** (`webAudioPlay`) y
hacer `ctx.suspend()` al terminar y en `stopAudio()` — suspende libera la sesión al
instante y el dictado siguiente nace con captura viva. El contexto se desbloquea en
`primeAudio()` (dentro de un gesto, exigencia de iOS) y el `<audio>` primeado queda
de fallback. Técnica de diagnóstico que lo destrabó: overlay de log visible en el
teléfono (activable por query param) logueando eventos de SpeechRecognition
(`onaudiostart/onspeechstart/onresult`) + estado del TTS con timestamps.
Receta usada en eventos-fotos-reales, sirve para futuras fotos (con test de peso
≤155 KB en `test/eventos-fotos.test.js`):
`sips --resampleWidth 1000 -s format jpeg -s formatOptions 55 "orig.jpg" --out slug.jpg`.
Trampas: (1) la calidad 70+ NO alcanza el objetivo si el original ya venía muy
comprimido (recorrido-historico 974 KB→314 KB con q72; hizo falta q45); calibrar
por archivo mirando el peso resultante. (2) NO upscalear originales chicos
(maraton era 639px: se recomprime tal cual, upscalear empeora). Nombres SIEMPRE
url-safe (sin espacios/acentos) — los originales tenían hasta un espacio antes
de la extensión ("Peña de chamame .jpg").

### `screen-ninos` NO es modo niños: es "Acompañamiento" (violencia) (2026-07-07)
Trampa de nombres legacy: `#screen-ninos`, `ninoslog`, `composer2`, `ninosWelcome`,
`ninosHandle` corresponden a la pantalla **Acompañamiento** (chat confidencial para
situaciones de violencia, línea 144/911) — nada que ver con niños. Cualquier cambio de
tono, copy o flujo ahí es SENSIBLE (usuario en situación de riesgo): tratarlo con el
mismo cuidado que el ruteo a la línea 144 del motor de intenciones.

### El chat tiene DOS motores: coordinar contexto entre LLM y regex (2026-07-07)
El chat corre con el LLM (`smartHandle`→`llmHandle`→/api/chat) como primario y el motor regex
(`handle`/`flow`) como fallback y para flujos client-side (geolocalización). Aprendizajes:
(1) Lo que resuelve el motor regex/geo (ej. "el más cercano es X") NO lo ve el LLM salvo que lo
registres en `llmHistory` → usar `recordLLM(role,content)` para que la conversación se infiera
en el próximo turno. (2) Si el LLM debe DELEGAR algo a la app (ej. la ubicación real), que emita
una `action` que el frontend intercepta (`ubicacion_cercana`→abre modal), NO que lo calcule el
modelo. (3) Un flujo regex abierto desde el LLM (modal con `flow={type:loc,step:await}`) DEBE
soltar `flow` al descartarse (`closeGeoPanel`), si no `smartHandle`'s `if(flow)` secuestra el
próximo mensaje hacia el motor local. (4) Error del LLM: NO degradar a regex al primer fallo
(da respuestas raras) — mostrar aviso de conexión + reintentar; degradar solo tras N fallos.

### API de Claude: sonnet-5 / output_config / thinking:disabled son válidos (2026-07-06)
Al revisar `chat.js` pueden "sonar" inventados `claude-sonnet-5`, `output_config.format` y
`thinking:{type:"disabled"}` — NO lo son (skill `claude-api`, estado 2026): Sonnet 5 existe y
soporta structured outputs; `{type:"disabled"}` se acepta en Sonnet 5 (solo Fable 5 lo rechaza);
`stop_reason:"refusal"` es real y hay que chequearlo ANTES de leer `response.content`. No hay que
cablear `temperature`/`top_p`/`budget_tokens` (dan 400 en la familia 4.7/4.8/Sonnet 5).

### Red móvil: TODO fetch necesita timeout, y Netlify corta a ~10 s (2026-07-07)
En 4G mala un `fetch` sin señal cuelga MINUTOS: typing infinito, `llmBusy` trabado, demo muerta.
Contrato del proyecto: todo request de red del frontend va por `fetchTimeout(url,opts,ms)`
(index.html; AbortController, no `AbortSignal.timeout` — iOS<16). Lado server: las funciones de
Netlify se cortan a ~10-26 s, así que los clientes HTTP internos deben fallar ANTES de eso
(`chat.js`: SDK Anthropic con `timeout:8000, maxRetries:0` — los defaults son 10 min y 2 retries;
`tts.js`: `AbortSignal.timeout(8000)`), si no el navegador nunca ve el error y no puede reintentar.
Además el reset de conversación (`startAssistant`) invalida respuestas en vuelo con `llmEpoch` y
vacía `llmQueue`: sin eso, una respuesta vieja se inyecta, el historial arranca con rol assistant
y `/api/chat` lo rechaza con 400 para siempre (`llmDisabled` permanente).
