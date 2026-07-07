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
5. Cargá las variables de entorno (ver la lista completa en **Variables de entorno**
   más abajo), con `netlify env:set NOMBRE "valor"` por cada una.
6. Publicá en producción:  `netlify deploy --prod`
7. Te da una URL `https://...netlify.app` para compartir.

### O con GitHub
1. Subí la carpeta a un repo de GitHub.
2. En netlify.com → "Add new site" → "Import from Git" → elegí el repo.
3. En Site settings → Environment variables, cargá las de la lista de abajo.
4. Deploy. Listo.

Archivos que usa Netlify: `netlify.toml` y `netlify/functions/` (`tts.js`, `chat.js`,
`log.js`, `_ratelimit.js`).

---

## Variables de entorno

**Requeridas** (sin ellas la voz o el chat no andan):

| Variable | Para qué |
|---|---|
| `LLM_API_KEY` | Chat con IA (clave de Anthropic). |
| `ELEVENLABS_API_KEY` | Voz por servidor (clave de ElevenLabs). |
| `ELEVENLABS_VOICE_ID` | Id de la voz argentina. |

**Opcionales** (la demo funciona sin ellas — *fail-open* — pero conviene cargarlas si
vas a compartir el link ampliamente):

| Variable | Para qué |
|---|---|
| `ALLOWED_ORIGIN` | Restringe CORS al dominio real, ej. `https://tu-sitio.netlify.app` (sin barra final). Sin setear → `*`. |
| `UPSTASH_REDIS_REST_URL` | Rate-limit por IP + telemetría de errores (base Redis de Upstash, gratis). |
| `UPSTASH_REDIS_REST_TOKEN` | Idem — token de la base Upstash (secreto). |
| `LOG_READ_TOKEN` | Secreto (aleatorio ≥32 chars) para leer el log de errores: `curl -H "Authorization: Bearer <token>" <url>/api/log`. |

Sin las `UPSTASH_*` no hay rate-limit ni se guardan los errores; sin `ALLOWED_ORIGIN`
los endpoints aceptan cualquier origen. Detalle técnico en `docs/lessons.md`.

---

## Chequeo post-deploy (smoke test)
Tras cada deploy, corré el smoke test para cazar un deploy roto o una env var faltante
antes de descubrirlo en el celular:

```bash
scripts/smoke.sh https://TU-SITIO.netlify.app          # completo: home + POST reales (cuesta ~centavos)
scripts/smoke.sh https://TU-SITIO.netlify.app --light  # gratis: home + routing (no detecta keys faltantes)
```
Verde = home OK + `/api/chat` responde con `{reply}` (LLM_API_KEY OK) + `/api/tts` devuelve
audio (ELEVENLABS_* OK). Si algo sale rojo, el mensaje te dice qué env var falta.

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
