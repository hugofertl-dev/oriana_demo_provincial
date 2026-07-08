# PLAN PENDIENTE — De demo estable a app probada desde todos lados

> Origen: relevamiento del 2026-07-07 post-cierre de `estabilidad-movil` (historial,
> auditoría de seguridad archivada, funciones serverless, netlify.toml, deuda en
> docs/lessons.md). La base móvil ya está sólida (5 fases: red, voz, races,
> performance, deuda); esto cubre lo que falta para que la demo aguante que
> **cualquiera, desde cualquier dispositivo y red, la pruebe sin que se caiga
> ni te deje ciego**.
>
> **Estado: EN CURSO (Fases 1-5 con código cerrado; queda el ítem 18 como Feature aparte).** Orden recomendado: 1 → 2 → 3 → 4 → 5.
> Fase 1 ítems 1-2 (rate-limit + CORS) IMPLEMENTADOS y cerrados (feature `rate-limit-apis`,
> commit f0529c4, validado en deploy). Ítems 3-4 (spending limits + concurrencia) son acción
> manual/operativa del usuario, sin código.
> Las fases 1-3 son nivel Feature (entrevista `feature-start` obligatoria);
> las 4-5 son mayormente Ajustes/Fixes directos. Marcados con ⚠️ los puntos
> que necesitan una DECISIÓN del usuario y con 🖐️ los que son acción manual
> del usuario (consolas/paneles externos), no código.

---

## FASE 1 — Blindaje de las APIs (que la prueba masiva no queme el presupuesto ni tire la demo)

El riesgo #1 documentado en `docs/lessons.md`: los endpoints son públicos, sin auth
ni límite de volumen. Compartir la URL ampliamente sin esto es regalar la API key.

1. **Rate-limit por IP en `/api/chat` y `/api/tts`.**
   - Hoy: costo mitigado POR REQUEST (tope body 40 KB, context 25 KB, history 16
     msgs, `max_tokens:1024`) pero NO en volumen — un `curl` en loop quema el
     presupuesto de Anthropic/ElevenLabs (CORS no frena scripts).
   - Netlify Functions no trae rate-limit gratis. Opciones a evaluar en la
     entrevista: contador en Netlify Blobs (sin servicio extra), Upstash Redis
     (free tier), o el rate limiting nativo de Netlify (plan pago).
   - Límite razonable de demo: ~N req/min por IP con respuesta 429 — el cliente
     YA maneja 429 con "dame unos segundos" + Reintentar (fase 4 de estabilidad).

2. **Restringir CORS al dominio real.**
   - `chat.js:157` ya lee `ALLOWED_ORIGIN` (hoy sin setear → `*`).
   - `tts.js:70` tiene `*` hardcodeado y NO lee la env var → unificar con el
     mismo patrón de chat.js.
   - 🖐️ Cargar `ALLOWED_ORIGIN` en las env vars del sitio en Netlify.

3. **🖐️ Spending limits como red de seguridad final.**
   - Consola de Anthropic: límite de gasto mensual.
   - ElevenLabs: revisar cuota del plan y alertas de consumo.
   - Sin código; es la última línea de defensa si 1 y 2 fallan.

4. **Presupuesto de concurrencia legítima.**
   - 20 testers simultáneos pueden pegarle al rate limit de Anthropic (429 en
     cadena: la demo entera responde "dame unos segundos" y parece rota).
   - Estimar en la entrevista: ¿cuánta gente a la vez es el escenario real?
     Si es un evento/presentación masiva, evaluar tier de la API key y/o cola
     con mensaje honesto ("hay mucha gente probando, esperá un momento").

## FASE 2 — Telemetría (enterarse cuando le falla a otro)

> **FASE 2 COMPLETA.** Ítem 5 cerrado (feature `telemetria-log`): captura global en el
> cliente → `/api/log` propio, persistido en Upstash, GET de lectura con token por header.
> Ítem 6 (visibilidad server) cubierto: `/api/log` hace `console.error` (panel Netlify) +
> histórico consultable en Upstash. Ítem 7 HECHO: `scripts/smoke.sh <url> [--light]`
> (home + POST reales a /api/chat y /api/tts; `--light` sin costo). Validado contra el
> deploy real (verde).

Hoy no hay NINGÚN error tracking: si un tester tiene un crash en su dispositivo,
la única forma de saberlo es que lo cuente. "Probar desde todos lados" solo sirve
si los fallos llegan.

5. **Captura global de errores en el cliente.**
   - `window.onerror` + `unhandledrejection` → POST a una función `/api/log`
     (o Sentry, gratis en este volumen — ⚠️ decidir: función propia minimalista
     vs servicio externo).
   - Payload mínimo: mensaje, stack recortado, user-agent, pantalla actual.
     SIN datos personales del ciudadano demo.
   - Anti-loop: tope de N errores por sesión, y el propio POST de log nunca
     debe generar otro error logueado.

6. **Visibilidad de los errores del server.**
   - `chat.js`/`tts.js` ya hacen `console.error` → van al log de functions de
     Netlify, pero nadie los mira. Definir dónde se consultan (panel Netlify
     alcanza para demo) y qué es alerta vs ruido.

7. **Smoke test post-deploy.**
   - Hoy: si falta una env var o el deploy sale mal, se descubre en el celular.
   - Script `scripts/smoke.sh <url>`: curl a la home (200 + contiene "ORIANA"),
     a `/api/chat` (respuesta bien formada) y `/api/tts` (audio o error
     controlado). Correrlo a mano tras cada push (o engancharlo a Netlify
     deploy notifications si se quiere automatizar).

## FASE 3 — Compatibilidad multi-navegador (la voz es el punto frágil)

> **FASE 3 CÓDIGO COMPLETO.** Feature `compat-multinavegador` (archivada): ítem 8
> (WebView WhatsApp/IG/FB → modal "abrí en Safari/Chrome" al tocar el micro, vía
> `isWebView()`) e ítem 9 (Firefox honesto: eliminado el dictado simulado, aviso por
> placeholder) IMPLEMENTADOS y cerrados. Ítem 10: matriz creada en
> `docs/matriz-navegadores.md` (Safari iOS ✓ prellenado). 🖐️ PENDIENTE: completar la
> matriz probando en dispositivos reales (esa prueba manual ES la verificación del ítem 10).

8. **WebView de WhatsApp/Instagram — el "a mí no me anda" más probable.**
   - Si el link se comparte por WhatsApp, mucha gente lo abre en el navegador
     embebido, donde el micrófono suele fallar o directamente no pide permiso.
   - Detectar WebView (user-agent) y mostrar banner: "Para usar el micrófono
     abrí ORIANA en Safari/Chrome" con instrucción de cómo (menú ⋯ → abrir en
     navegador). El chat por texto debe seguir andando igual en el WebView.

9. **Firefox: fallback honesto en vez de dictado simulado.**
   - Hoy `startDictation` sin `SpeechRecognition` SIMULA un dictado y manda una
     frase demo ("¿Cuál es el hospital más cercano?") — para un tester real
     parece un bug. Reemplazar por aviso claro: "Tu navegador no soporta
     dictado; escribile a ORIANA" (el TTS server-side sí anda en Firefox).
   - ⚠️ Decidir si el fallback simulado se conserva detrás de un flag para
     presentaciones guionadas o se elimina.

10. **Matriz de prueba manual documentada.**
    - Safari iOS ✓ (verificado por el usuario) · Chrome Android · Chrome/Edge
      desktop · Firefox desktop/Android · WebView WhatsApp/Instagram.
    - Por cada celda: carga, chat texto, dictado, TTS, geolocalización, back.
    - Registrar resultados en una tabla (en este archivo o en docs/) para saber
      qué está realmente probado y qué es fe.

## FASE 4 — Superficies muertas y races restantes

> **FASE 4 COMPLETA (código).** Ítem 11 (oriana-demo.html eliminado) e ítem 12 (chip
> durante el dictado) RESUELTOS. Ítem 13 (typing solapados, cosmético) saltado por decisión.

11. **✅ RESUELTO (2026-07-07) — `oriana-demo.html` eliminado.** El gemelo desktop
    viejo (sin chat LLM ni fixes de estabilidad) se borró del repo y del publish
    (`scripts/stage_publish.sh`), y se limpiaron sus referencias (`verify.sh`,
    hook `stop_verify.sh`, `oriana-proxy.py`, `docs/architecture.md`,
    `docs/lessons.md`). Sin redirect: nadie tenía el link viejo (decisión del usuario).
    `index.html` (responsive) es la única app; `oriana-mobile.html` su espejo.

12. **✅ RESUELTO (2026-07-07) — chip durante el dictado ya no deja mensaje fantasma.**
    El wrapper de `chipClick` llama a `cancelPending()` de ambos mics ANTES de enviar,
    en los dos caminos (pantalla de niños y chat principal); además `cancelPending`
    descarta el borrador a medio dictar del input (solo si había dictado vivo, no pisa
    texto tipeado). Test rojo-primero `test/chip-durante-dictado.test.js` (11 checks) +
    sabotage OK, sin regresión en dictado-doble-envio.

13. **⏭️ SALTADO por ahora (cosmético) — typing solapados (ítem 32 del plan viejo).**
    Dos indicadores "escribiendo…" pueden convivir. Baja prioridad; se encara solo si
    molesta en la prueba masiva (decisión del usuario, 2026-07-07).

## FASE 5 — Endurecimiento y deuda del harness

> **FASE 5 casi completa (2026-07-07).** Ítems 14 (headers+CSP), 15 (gate de secrets) y 17
> (CLAUDE.md) RESUELTOS. Ítem 16 investigado y NO aplicado (forzarlo empeora; dev-only, 0 prod).
> Ítem 18 (pre-generar audios) queda como Feature aparte, retomable cuando el usuario quiera.

14. **✅ RESUELTO (2026-07-07) — headers de seguridad + CSP en `netlify.toml`.**
    Bloque `[[headers]] for="/*"`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
    `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
    (`microphone=(self), geolocation=(self), camera=()`), HSTS, y CSP con `'unsafe-inline'`
    (la app es 100% inline) que BLOQUEA recursos externos/enmarcado y acota `connect-src`
    a same-origin (`/api/*`). `media-src` permite `blob:`/`data:` (TTS + primeAudio). Sin
    `'unsafe-eval'` (no hay eval en runtime). Verificado headless: 0 `securitypolicyviolation`
    al cargar y ejercitar primeAudio/modal/navegación. TOML válido.

15. **✅ RESUELTO (2026-07-07) — el gate de secrets ahora gatea.** `scripts/security_scan.sh`
    pasa a `gitleaks dir . --config .gitleaks.toml` (escanea el WORKING TREE, no `--staged`/
    historial → ve el código sin commitear y no da falso verde con todo commiteado). El `.env`
    local (keys reales, gitignoreado) queda allowlisteado en `.gitleaks.toml` nuevo. Validado:
    detecta un secreto plantado (exit≠0) e ignora el `.env`. El script hace `cd` a la raíz.

16. **⚠️ INVESTIGADO, NO aplicado (2026-07-07) — dev-only, forzarlo empeora.** `npm audit`:
    16 vulns TODAS en `netlify-cli` y transitivos (`@opentelemetry/core`, `esbuild`, `@netlify/*`);
    **0 en producción** (`npm audit --omit=dev`). `npm audit fix` sin `--force` no arregla nada;
    `--force` bumpea `netlify-cli` a un major y **EMPEORA a 46 vulns (16 high, 4 critical)** →
    revertido. Decisión: dejarlas (0 impacto en prod). Retomar solo si `netlify-cli` saca una
    versión sana, o con `overrides` puntuales si algún día molesta. osv-scanner las marca informativas.

17. **✅ RESUELTO (2026-07-07) — CLAUDE.md corregido.** La regla 3 (Tests reales) ya no dice
    "hoy no hay suite de tests"; apunta a la suite jsdom cableada en `scripts/verify.sh`.

18. **⏭️ A HACER COMO FEATURE APARTE — pre-generar audios fijos.** Cambia comportamiento en
    runtime + suma assets + necesita la KEY de ElevenLabs para generarlos (secreto que maneja
    el usuario) + decidir qué frases son "fijas" → es nivel Feature (entrevista `feature-start`),
    no un Ajuste de esta tanda. El audioCache (30) ya amortigua dentro de una sesión; esto
    amortiguaría ENTRE usuarios. Retomable cuando el usuario quiera arrancarlo.

---

## Verificación por fase

- Cada fix/feature con test jsdom rojo-primero donde el comportamiento sea
  testeable (patrón de `test/estabilidad-fase*.test.js`) + `sabotage_check`.
- Fase 1: además del test local, probar el rate-limit contra el deploy real
  (loop de curls → debe aparecer el 429 y el cliente mostrarlo bien).
- Fase 2: forzar un error a propósito en un dispositivo y verificar que llega
  al log/panel.
- Fase 3: la matriz del punto 10 ES la verificación (manual, en dispositivos).
- Cierre de cada fase: `verify.sh full` verde + línea en `progress/history.md`.
