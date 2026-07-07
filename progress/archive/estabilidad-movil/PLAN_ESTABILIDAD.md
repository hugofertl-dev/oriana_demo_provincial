# PLAN PENDIENTE — Estabilidad de la demo en celulares (iOS/Android)

> Origen: auditoría profunda del 2026-07-07 (3 auditores en paralelo: compat móvil,
> robustez JS, backend/performance). 28 hallazgos verificados en código.
> Objetivo: que la demo funcione 100% en celulares (donde más se testea) sin
> congelarse, sin bugs visibles y sin problemas de performance.
>
> **Estado: IMPLEMENTADO (5/5 fases, 2026-07-07).** Tests por fase en
> `test/estabilidad-fase{1..5}.test.js` (rojos antes de cada fix) + sabotage checks.
> Decisiones: ítem 12 = queda auto-envío (decisión del usuario); ítem 23 = descartado
> (POST no cacheable por CDN); ítem 26 = persistencia en localStorage con reset en
> "Cerrar sesión"; ítem 32 = no encarado (cosmético). Pendiente de verificación
> manual en celular: teclado/viewport (✓ verificado), voz flash_v2_5 (escuchar),
> back de Android, indicador de mic, voz tras bloquear pantalla.
> Las líneas citadas corresponden a index.html del commit ~c90d2ae; pueden correrse.

---

## FASE 1 — Estabilidad crítica (la demo no se muere en escena)

1. **Timeout del chat (cliente + server)** — el bug #1, confirmado por los 3 auditores.
   - `index.html:1094`: `fetch("/api/chat")` sin AbortController → en 4G mala cuelga
     minutos, typing infinito, `llmBusy` trabado, mensajes encolados en silencio.
     Fix: AbortController ~15 s → cae al camino de error transitorio existente (chip Reintentar).
   - `netlify/functions/chat.js:118`: SDK Anthropic con defaults (timeout 10 min,
     2 retries internos) vs límite de Netlify ~10-26 s. Fix: `timeout: 8000, maxRetries: 0`.
   - Ídem `/api/tts` (`index.html:909` y `tts.js`: fetch a ElevenLabs sin timeout).

2. **Viewport iOS: tabbar tapada por la barra de Safari.**
   - `index.html:43,46`: `.phone{height:min(880px,100vh)}` — 100vh en iOS mide con la
     barra colapsada; al cargar, los últimos ~50-70px (tabbar) quedan detrás de la UI.
   - Fix: `100dvh` con fallback `100vh` + `padding-bottom:env(safe-area-inset-bottom)`
     en `#tabbar` (+ `viewport-fit=cover` en el meta si hace falta para el notch).

3. **Teclado virtual tapa el composer (iOS y Android Chrome ≥108).**
   - No existe `interactive-widget` en el meta viewport ni handler de `visualViewport`.
   - Fix: `interactive-widget=resizes-content` en el meta + dvh (cubre Android);
     para iOS viejos, handler de visualViewport. Verificación visual en ambos SO.

4. **Reset de conversación con request en vuelo → LLM deshabilitado toda la sesión.**
   - `index.html:2104` (`startAssistant`): vacía `llmHistory` sin cancelar el fetch en
     vuelo ni `llmQueue` → la respuesta vieja se inyecta y el historial queda empezando
     con rol `assistant` → el server lo rechaza con 400 SIEMPRE (`chat.js:114`) → 3
     fallos → `llmDisabled=true` permanente.
   - Fix: epoch/generación (o AbortController) que invalide respuestas en vuelo +
     vaciar `llmQueue` al resetear.

5. **`llmHistory` sin tope → 413 sistemático y degradación permanente en demos largas.**
   - `index.html:1096`: se manda el historial ENTERO cada turno; `chat.js:99` corta a
     40 KB con 413; el server solo usa `slice(-16)` (`chat.js:105`).
   - Fix (1 línea): recortar en el cliente (`llmHistory = llmHistory.slice(-16)` tras cada push).

6. **`RX_YES` incluye "quiero" → confirma flujos que el usuario no confirmó.**
   - `index.html:1155`: en paso `confirm`, tocar "+ Sacar un turno nuevo" (manda
     "Quiero sacar un turno…", `index.html:417`) confirma el turno VIEJO.
   - Fix: sacar `quiero` de RX_YES (o anclarlo `^quiero$`). Test jsdom fácil (rojo primero).

## FASE 2 — Voz confiable en Android e iOS (superficie principal del test)

7. **Feedback de errores del dictado.** `index.html:1846`: `rec.onerror` ignora todo
   salvo "not-allowed". En Android el STT va contra servidores de Google: sin red da
   `network` y el usuario no ve NADA (parece mic roto). Fix: para
   `network`/`no-speech`/`audio-capture`, aviso visible ("No te escuché / revisá la conexión").

8. **Dictado en es-AR.** `index.html:1843`: `rec.lang="es-ES"` (peninsular) transcribe
   peor voseo y topónimos ("sacá un turno", "Itaembé Miní") → el motor regex no matchea.
   Fix: `es-AR`. Verificar en dispositivo que Android lo soporte (fallback es-419).

9. **No enviar borradores tipeados al cancelar el dictado.** `index.html:1845-1849`:
   `rec.onend` envía lo que haya en el input aunque no hubo transcript (mic tocado por
   error con texto a medio escribir). Fix: comparar contra el valor previo al dictado.

10. **Liberar `_micStream` tras el dictado.** `index.html:1827-1829`: los tracks quedan
    vivos toda la sesión → indicador naranja de "grabando" permanente (iOS) /
    notificación de mic (Android). Fix: `getTracks().forEach(t=>t.stop())` en `rec.onend`
    — OJO: `micPermissionState` (`index.html:1683`) usa `_micStream` como señal de
    "granted"; reemplazar por flag booleano.

11. **Recuperar el AudioContext al volver de background/pantalla bloqueada.**
    `index.html:873`: si el ctx queda "interrupted" (bloquear el teléfono durante TTS),
    el `resume()` fuera de gesto puede no resolver nunca → ORIANA muda el resto de la
    sesión. Fix: en `visibilitychange→visible`, si `state!=="running"`, cerrar y recrear
    el contexto (o resume con timeout de carrera).

12. **Auto-envío en la primera pausa del dictado** (menor pero de la misma zona):
    `continuous=false` + onend envía → pensar a mitad de frase manda un mensaje
    incompleto. Evaluar: mostrar el texto y pedir confirmación, o re-arrancar rec.

## FASE 3 — Robustez del chat (races y flujos colgados)

13. **`goChat()` saltea el lock del LLM.** `index.html:701`: llama `handle()` directo
    (no `smartHandle`) → respuestas cruzadas si hay una en vuelo + habilita el bug de
    "quiero" (ítem 6). Fix: `goChat` → `smartHandle`.

14. **Flow `loc/address` colgado tras navegar.** `index.html:1791-1798`: si el usuario
    no escribe la dirección y se va, al volver CUALQUIER mensaje se interpreta como
    dirección. Fix: expirar/limpiar el flow loc al salir del chat (en `show()`).

15. **Mensaje encolado se come como dirección y cierra el modal geo.**
    `index.html:1139-1142` + `1590-1602`: texto tipeado mientras el LLM abría
    `ubicacion_cercana` → `locStep` lo traga y cierra el modal. Fix: en step `await`,
    ignorar texto que no parezca dirección o vaciar `llmQueue` al abrir el modal.

16. **Dobles disparos.** `index.html:1160-1181, 998-1003, 2042-2053`: flow se setea
    650 ms tarde (dentro de `typing()`) y los chips no se deshabilitan → doble tap =
    flujos dobles; en Acompañamiento, doble tap inserta DOS turnos. Fix: setear flow
    sincrónico antes de `typing()` + debounce/disable de chips al primer tap.

17. **Geo sin cancelación.** `index.html:1766-1781`: cerrar el modal o navegar no
    cancela `getCurrentPosition` → la tarjeta "más cercano" aparece igual después;
    "cancelar" tipeado limpia el flow pero no cierra el modal. Fix: flag de cancelación
    en `onGeoOk` + `closeGeoPanel()` en el camino RX_CANCEL.

18. **Back físico de Android saca de la demo.** Sin `pushState`/`popstate` en el
    archivo: el back instintivo pierde toda la conversación. Fix: pushState por
    pantalla + popstate → `show()`.

## FASE 4 — Performance y pulido

19. **TTS más rápido.** `tts.js:11,38`: `eleven_multilingual_v2` es el modelo lento.
    Fix: `eleven_flash_v2_5`/`turbo_v2_5` + `AbortSignal.timeout(8000)`. (Validar que
    la voz elegida suene bien en el modelo nuevo.)

20. **Warm-up del primer mensaje.** Cold start de la función + compilación del schema:
    el PRIMER mensaje tras inactividad es el más lento — justo al arrancar la demo.
    Fix barato: ping de warm-up a `/api/chat` al cargar la app.

21. **Cache de assets.** No hay `[[headers]]` en `netlify.toml`: los 6 JPEG (~756 KB)
    se revalidan en cada visita. Fix: `Cache-Control: public, max-age=31536000, immutable`
    para `/assets/*`. (Los HTML con max-age=0 están BIEN — no tocar.)

22. **Fotos al tamaño de uso.** Miden 1000-1500 px para tarjetas de ~180-380 px CSS →
    recomprimir a ~640 px (~40-60 KB c/u). Receta sips en `docs/lessons.md`.

23. **Cache CDN del TTS fijo.** `tts.js:54` (`no-store`): el saludo se re-sintetiza
    (y se paga) en cada carga. Fix: cache CDN keyed por hash del texto, o pre-generar
    los audios fijos como assets.

24. **429/529 con reintento inmediato.** `index.html:1110-1126`: todo error muestra
    "Reintentar" instantáneo — reintentar un 429 lo agrava. Fix: para 429/529, mensaje
    "dame unos segundos" + chip deshabilitado ~5 s.

## FASE 5 — Menores / deuda (evaluar si valen para la demo)

25. `audioCache` sin límite ni `revokeObjectURL` (`index.html:804,902-917`) → memoria
    creciente en demo larga con voz. Fix: cap ~30 entradas con revoke.
26. **Recargar la página borra turnos/reclamos/favoritos** (DB en memoria; la sesión
    persiste). Decisión de producto: persistir en localStorage o aceptarlo — pero
    saberlo ANTES de refrescar frente a una audiencia.
27. Autofocus del input al entrar al chat (`index.html:2110`) abre el teclado en
    Android tapando los chips de guía. Fix: quitar autofocus en táctil.
28. `window.scrollTo(0,1e9)` por burbuja (`index.html:964`) produce saltos con teclado
    abierto en iOS; los scrollTop de los contenedores alcanzan. Fix: borrar la línea.
29. Landscape inusable (marco 430px). Para demo: forzar/avisar portrait o extender la
    media query con `(max-height:500px)`.
30. `publish = "."` en `netlify.toml` publica docs/, progress/, test/, CLAUDE.md por
    URL. Fix: publicar desde subdirectorio o excluir.
31. `tts.js:49` reenvía el `detail` crudo de errores de ElevenLabs (leak menor).
32. Typing indicators solapados con N mensajes rápidos (cosmético).

---

## Deudas conocidas previas (ya registradas, no de esta auditoría)
- `/api/chat` público sin rate-limit (riesgo de costo). Ver `docs/lessons.md`.
- CORS `*` en `chat.js` y `tts.js` (`ALLOWED_ORIGIN` opcional endurece).

## Verificado y OK (para no re-auditar)
localStorage envuelto en try/catch · `decodeAudioData` forma callback (Safari) ·
`getVoices()` precalentado en load · autoplay iOS resuelto con primeAudio en gesto ·
geolocalización con timeout · validación de payload de chat.js sólida (40 KB, roles,
2000 chars) · texto TTS limitado (600/800) · TTS se pide DESPUÉS de renderizar el
texto · HTML autocontenido sin fuentes/scripts externos · render de listas trivial.
