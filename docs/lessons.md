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
