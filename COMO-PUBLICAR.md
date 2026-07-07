# Publicar ORIANA (demo) con la API key oculta

La voz usa una **función serverless** que guarda la API key de ElevenLabs del lado
del servidor. La key **nunca** llega al navegador ni aparece en el código de la web.

El frontend (`index.html`) llama a `/api/tts`, la función le agrega la key y devuelve
el audio. Si la función no está disponible, la demo sigue funcionando con la voz del
navegador (sin romperse).

Vas a necesitar dos datos de tu cuenta ElevenLabs:
- **API Key** (empieza con `sk_...`)
- **Voice ID** de la voz argentina (My Voices → ⋯ → Copy Voice ID)

Además, el **chat con IA** (Claude/Anthropic) usa otra función serverless
(`netlify/functions/chat.js`, endpoint `/api/chat`) con su propia variable:
- **`LLM_API_KEY`** — API key de Anthropic. Si falta, el chat cae solo al
  motor local por reglas (la demo no se rompe, responde más rígida).

---

## Publicar en Netlify

Netlify "Drop" (arrastrar archivos) **no** ejecuta funciones. Para que ande la voz
por ElevenLabs necesitás deploy desde Git o con la CLI. La forma más simple:

### Con la CLI de Netlify
1. Instalá Node.js (nodejs.org) si no lo tenés.
2. Instalá la CLI:  `npm install -g netlify-cli`
3. Entrá a la carpeta de la demo (donde está `index.html`) en la terminal.
4. Ejecutá:  `netlify deploy` (seguí los pasos, elegí crear un sitio nuevo).
5. Cargá las variables de entorno:
   `netlify env:set ELEVENLABS_API_KEY "tu_api_key"`
   `netlify env:set ELEVENLABS_VOICE_ID "tu_voice_id"`
6. Publicá en producción:  `netlify deploy --prod`
7. Te da una URL `https://...netlify.app` para compartir.

### O con GitHub
1. Subí la carpeta a un repo de GitHub.
2. En netlify.com → "Add new site" → "Import from Git" → elegí el repo.
3. En Site settings → Environment variables, agregá:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID`
   - `LLM_API_KEY` (Anthropic, para el chat con IA)
4. Deploy. Listo.

Archivos que usa Netlify: `netlify.toml` y `netlify/functions/tts.js`.

---

## Probar que la voz anda
- Abrí la URL publicada, tocá "Iniciar demo como María".
- Mandá un **audio** (botón del micrófono). Si escuchás la voz de ElevenLabs, ✅.
- Si escuchás la voz del navegador, revisá que las variables de entorno estén bien
  cargadas y volvé a desplegar.

## Notas
- La demo queda en `https`, así que el micrófono pide permiso una sola vez.
- La voz por servidor ya viene **activada** por defecto: en `index.html` está
  `const USE_SERVER_TTS = true;`, así que el frontend llama a `/api/tts` y la key
  queda oculta. No hace falta pegar ninguna key en el código.
- Si querés usar solo la voz del navegador (sin ElevenLabs), poné
  `const USE_SERVER_TTS = false;` y dejá `EL_API_KEY`/`EL_VOICE_ID` vacíos.
- Si las variables de entorno no están cargadas, la función responde con error y la
  demo cae sola a la voz del navegador (no se rompe).
- `oriana-proxy.py` ya no hace falta para producción (era solo para pruebas locales).
- La función ya está creada: `netlify/functions/tts.js`. Lee `ELEVENLABS_API_KEY` y
  `ELEVENLABS_VOICE_ID` de las variables de entorno de Netlify.
