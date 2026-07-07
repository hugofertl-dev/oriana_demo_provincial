# compat-multinavegador — FASE 3 del PLAN_PRODUCCION (compatibilidad multi-navegador)

**Fecha:** 2026-07-07 · **Estado:** done

## Qué se hizo
- **Ítem 8 — WebView de WhatsApp/Instagram/Facebook:** `isWebView()` detecta el navegador
  embebido por user-agent; al tocar 🎙️ se abre el modal de micro en estado `webview`
  ("abrí en Safari/Chrome", con pasos), sin intentar el dictado. El chat de texto sigue igual.
- **Ítem 9 — Firefox honesto:** eliminado el dictado *simulado* (auto-enviaba "¿Cuál es el
  hospital más cercano?"). Sin `SpeechRecognition`, tocar el micro avisa por placeholder
  (`MSG_SIN_DICTADO`) y NO envía nada.
- **Ítem 10 — matriz de prueba manual:** `docs/matriz-navegadores.md` (filas por navegador ×
  columnas por función), prellenada con Safari iOS ✓. Se completa a mano en dispositivos.

## Criterios ✅
Los 5 EARS cumplidos (WebView modal sin dictado · chat texto intacto · Firefox honesto sin
auto-envío · UA sin falsos positivos incl. CriOS/FxiOS · matriz existe).

## Decisiones clave
- Aviso de WebView **solo al tocar el micro** (no banner al cargar) — decisión del usuario.
- Firefox simulado **eliminado del todo** (no se conserva tras flag) — decisión del usuario.
- Modal del WebView **clonado** del panel de micro existente (design-system).
- `isWebView` acotado a WA/IG/FB (FBAN/FBAV/FB_IAB) + Android `wv`; se quitó `Line/` por
  alcance no pedido (obs. del reviewer).

## Verificación
`scripts/verify.sh full` verde (suite completa + `test/fase3-compat.test.js`, 22 checks) +
`sabotage_check` OK (rojo sin el fix). Screenshot headless del modal aprobado visualmente.
Reviewer en contexto fresco: APROBADO CON OBSERVACIONES — las 3 menores aplicadas
(test behavioral del crit. 3, borrado de guard muerto en `startDictation`, `Line/` fuera).

## Pendiente (manual, en dispositivos reales)
Completar la matriz `docs/matriz-navegadores.md`: WebView WhatsApp/IG, Firefox, Chrome
Android/desktop. La verificación del ítem 10 ES esa prueba manual.

## Archivos
`index.html`, `oriana-mobile.html` (espejo), `scripts/verify.sh`,
`test/fase3-compat.test.js` (nuevo), `docs/matriz-navegadores.md` (nuevo).
