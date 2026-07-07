# Handoff — eventos-fotos-reales (próximo trabajo) · 2026-07-07

> No hay trabajo a medias: `feature_list.json` está vacío, todo commiteado y **pusheado**
> a `pre_produccion` (en sync con origin). Esto es un handoff de ESTADO + el próximo paso
> planificado, para retomar con contexto limpio.

## Estado exacto del proyecto
Todo verde y deployado. Features cerradas (ver `progress/archive/INDEX.md` + su `summary.md`):
- ✅ reclamos-tickets · ✅ chat-llm-misiones · ✅ ui-healthcare-redesign · ✅ geo-cercania
- `scripts/verify.sh full` VERDE (63 tests jsdom + invariante `index.html===oriana-mobile.html` + syntax).
- Rama actual: **pre_produccion** (deploy branch, auto-deploy de Netlify al pushear). En sync con origin.
- Ramas de feature ya borradas (mergeadas). Quedan `main` y `pre_produccion`.

## Próximo trabajo (planificado, NO empezado): refactor de Eventos con fotos reales
Es nivel **Feature** → arrancar con el skill `feature-start` (entrevista + criterios).
Objetivo: reemplazar los **gradientes placeholder** de las tarjetas de eventos por las 6 fotos
reales ya commiteadas en `assets/`.

### Próximo paso CONCRETO
1. `feature-start`: entrevistar (¿qué tamaño/recorte de foto? ¿todas las tarjetas o solo el mosaico?
   ¿lazy-load?). 2. **Optimizar las imágenes** de `assets/` (hoy ~12 MB, resoluciones full-cámara
   4604×5756, 5616×3744 — redimensionar a ~800–1000px de ancho para móvil; bajarían muchísimo).
   3. **Renombrar a url-safe** (sin espacios ni acentos; ej. `pena-chamame.jpg`, `feria-gastronomica.jpg`).
   4. Mapear cada evento del `DB` (en `index.html`, screen `linda`/eventos, clase `.ev-card .ph`
   y el detalle `.ev-hero`) a su foto, reemplazando el `background: linear-gradient(...)` por la imagen.

### Referencia visual
Skill `design-system` (referencia canónica = chat; el sistema de tokens está en `:root` de `index.html`).
Las tarjetas de evento hoy usan `.ev-card`/`.ev-card .ph` con gradientes; el mosaico está en `renderLinda`.

## Archivos clave / dónde está todo
- `index.html` (= `oriana-mobile.html`, espejo byte-idéntico — editar uno y `cp` al otro; lo fuerza el verify).
  Eventos: buscar `renderLinda`, `.ev-card`, `#screen-evento`, `.ev-hero`. Fotos: `DB.eventos` (si existe) o el render.
- `assets/` (6 JPEG, commiteadas, SIN referenciar aún): "Peña de chamame .jpg" (¡espacio antes del .jpg!),
  "Feria y patio gastronomico.jpg", "Musica en vivo en el Teatro Lirico.jpg",
  "Recorrido historico por el centro de Posadas.jpeg", "Degustacion de productos misioneros.jpg",
  "Maraton de la Costanera 10K.jpeg".
- Chat: dos motores — LLM (`/api/chat`, `netlify/functions/chat.js`) + regex (`handle`/`flow`). Ver
  la lección "El chat tiene DOS motores" en `docs/lessons.md` antes de tocar el chat.

## Verificación
`scripts/verify.sh full` (63 tests). Para el chat-LLM en vivo: `netlify dev` (carga `.env` con LLM_API_KEY)
→ `localhost:8888`. Para geolocalización/mic: necesita `localhost`/https (no `file://`).

## Trampas descubiertas (ya en docs/lessons.md)
- `index.html === oriana-mobile.html` es invariante (el verify bloquea si difieren).
- Screenshots headless: encuadrar con `--window-size=480,980` (si no, el teléfono queda cortado; no es overflow).
- Remapeo de paleta por alias en `:root` (rediseño CSS-first sin tocar markup/JS).
- No confiar en el `action` del LLM sin validar (idempotencia + campos completos en `ejecutarAccion`).

## Recordatorios abiertos (no bloqueantes)
- **Netlify env vars:** `LLM_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` deben estar cargadas.
  Opcional: `ALLOWED_ORIGIN` (endurece CORS del chat).
- **Deuda:** `/api/chat` es público sin rate-limit (riesgo de abuso de costo por volumen). Ver `docs/lessons.md`.
- `netlify/functions/tts.js` tiene el mismo patrón CORS `*` que `chat.js`.
