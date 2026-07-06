# Arquitectura — ORIANA (demo provincial)

Detalle de arquitectura del proyecto. `CLAUDE.md` apunta acá; no duplicar contenido.

## Qué es

Demo **solo front-end** de un asistente virtual para servicios sociales/públicos
provinciales (Argentina). Sin backend propio, sin framework, sin build. Cada pantalla
y toda la lógica viven inline (HTML + `<style>` + `<script>`) en un único archivo HTML.
UI y textos en español rioplatense (`es-AR`). Persona simulada: la ciudadana **María González**.

Flujos: sacar turnos médicos, hospital/policía más cercano, beneficios sociales,
perfil/documentos, y acompañamiento por violencia de género (línea 144).

## Archivos

- **`index.html`** — app canónica y actual. **`oriana-mobile.html` es idéntico byte a byte**
  (ver `docs/lessons.md`: editar uno y copiar al otro). Pantallas:
  `login, home, chat, turnos, cerca, perfil, ninos, linda, evento`.
- **`oriana-demo.html`** — variante vieja y más chica (`chat, turnos, cerca, perfil, ninos`).
  No se despliega; no asumir que los cambios de `index.html` aplican acá.
- **`oriana-proxy.py`** — server local (solo stdlib). Sirve los HTML en `http://localhost:8787`
  y proxea POSTs a ElevenLabs inyectando el `xi-api-key` que manda el navegador. Da un origen
  seguro para que el permiso de micrófono persista y evita CORS en pruebas locales.
- **`netlify/functions/tts.js`** — proxy TTS serverless (Netlify).
  Lee `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` del entorno, acepta `POST {text, stability?, style?}`
  y devuelve `audio/mpeg`. La key nunca llega al navegador.
- **`netlify.toml`** — publica la raíz estática y redirige `/api/tts` → `/.netlify/functions/tts`.
- **`COMO-PUBLICAR.md`** — guía de deploy (Netlify), en español.

## Correr localmente

```bash
python3 oriana-proxy.py        # sirve en http://localhost:8787/oriana-mobile.html
# o para probar la función serverless:
./node_modules/.bin/netlify dev --offline   # sirve en http://localhost:8888 con /api/tts
```

## Arquitectura interna (todo dentro de `index.html`)

- **Backend simulado** — un único `const DB = {...}` con todos los datos: `ciudadano`,
  `documentos`, `beneficios`, `hospitales`, `policia`, `turnos_agenda`, `turnos_activos`.
  Es la fuente de verdad de lo que el asistente "sabe". Las mutaciones (ej. confirmar turno)
  hacen push a `DB.turnos_activos`.
- **Motor de intenciones** — `handle(text)` es un router por regex hacia flujos/acciones.
  **No** es un LLM: matchea por keywords sobre texto normalizado (`norm()` saca acentos/mayúsculas).
- **Máquina de estados de flujo** — un global `let flow` guarda el flujo multi-turno activo
  (`type: "turno"` slot-filling, o `"loc"` instalación más cercana). Mientras `flow` esté seteado,
  `flowDispatch()` intercepta todo, maneja cancelar (`RX_CANCEL`) y sí/no (`RX_YES`/`RX_NO`,
  a propósito permisivos) y no suelta hasta cerrar el flujo.
- **Instalación más cercana** — `distXY()` calcula distancia euclídea sobre coordenadas `xy`
  falsas del `DB` (no es geo real).
- **Voz (I/O)** — entrada por `SpeechRecognition` (STT); salida por `speak()`, que usa TTS de
  ElevenLabs si hay voz configurada, con fallback a `speechSynthesis` del navegador.
  `speakable()` expande abreviaturas/números para TTS más natural. `audioCache` memoiza audio por texto.
  Orden en `speak()`: `USE_SERVER_TTS` (default `true`) → `/api/tts` serverless → voz del navegador.
