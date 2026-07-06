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

### index.html y oriana-mobile.html deben ser idénticos (2026-07-06)
Son copias byte a byte. La app canónica es `index.html`; `oriana-mobile.html` es un
espejo que se sirve como raíz del proxy local. Al editar, cambiar `index.html` y luego
`cp index.html oriana-mobile.html`. `scripts/syntax_check.sh` bloquea si difieren.
`oriana-demo.html` es una variante vieja/aparte — NO se sincroniza.

### La API key de ElevenLabs nunca va al cliente (2026-07-06)
La voz usa la función serverless `/api/tts` (`netlify/functions/tts.js` y `api/tts.js`),
que inyecta `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` del entorno. En `index.html`,
`USE_SERVER_TTS=true` por defecto. Si faltan las env vars, la función responde 500 y la
demo cae sola a la voz del navegador (`speechSynthesis`) — no se rompe. Deploy: cargar
ambas env vars en Netlify/Vercel (ver `COMO-PUBLICAR.md`).

### No hay build ni suite de tests (2026-07-06)
Sitio 100% estático. `verify.sh` solo corre `scripts/syntax_check.sh` (node --check sobre
las funciones, validación del JS inline de los .html, py_compile del proxy, e invariante
index==mobile). `TEST_CMD`/`BUILD_CMD` quedan vacíos a propósito (SKIP). Un Fix que pida
test necesita montar el andamiaje mínimo o acordar verificación manual con el usuario.
