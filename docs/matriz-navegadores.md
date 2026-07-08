# Matriz de prueba multi-navegador — ORIANA (demo provincial)

> FASE 3 del `PLAN_PRODUCCION.md`, ítem 10. Esto NO se verifica con tests: se
> llena **probando a mano en cada navegador/dispositivo real**. Es el registro
> de qué está efectivamente probado y qué es fe.
>
> Convención: ✓ anda · ✗ falla · ⚠️ anda con salvedad (anotar cuál) · — no aplica
> · ▢ sin probar todavía. Poné fecha e iniciales cuando completes una fila.

## Qué probar en cada celda

- **Carga:** abre, se ve la home de ORIANA, no queda en blanco.
- **Chat texto:** escribir un mensaje y recibir respuesta del LLM.
- **Dictado (STT):** tocar 🎙️ y que transcriba lo hablado (voseo es-AR).
- **TTS (voz):** que ORIANA conteste por voz y se escuche.
- **Geo:** "hospital más cercano" → permiso de ubicación → distancia.
- **Back:** el botón atrás del dispositivo/navegador navega entre pantallas
  (no sale de la demo de golpe).

## Comportamiento esperado por caso especial (FASE 3, ya implementado)

- **iOS que no sea Safari (Chrome/Firefox/Edge iOS, WebViews):** en iPhone el micrófono
  SOLO funciona en Safari (Apple lo bloquea en el resto, aunque usen WebKit). Al tocar 🎙️
  aparece el modal "en el iPhone el mic solo anda en Safari, abrí este link en Safari" y NO
  se intenta el dictado. El chat de texto anda normal. (Detección: `iosNeedsSafari()`.)
  OJO: **WhatsApp en iOS abre el link en el navegador por defecto** (si es Chrome, cae en
  Chrome iOS) — por eso este caso es el "a mí no me anda" más común en iPhone.
- **WebView de WhatsApp/Instagram/Facebook (Android):** al tocar 🎙️ aparece un modal
  "abrí en el navegador" y NO se intenta el dictado. El chat de texto anda
  normal. (Detección por user-agent en `isWebView()`.)
- **Firefox (u otro navegador sin `SpeechRecognition`):** al tocar 🎙️ el
  placeholder avisa "tu navegador no soporta dictado, escribile a ORIANA".
  Ya NO simula un dictado ni auto-envía frases. El TTS server-side sí anda.

## Matriz

| Navegador / entorno            | Carga | Chat texto | Dictado (STT) | TTS (voz) | Geo | Back | Fecha · quién |
|--------------------------------|:-----:|:----------:|:-------------:|:---------:|:---:|:----:|---------------|
| Safari iOS                     |   ✓   |     ✓      |       ✓       |     ✓     |  ✓  |  ✓   | 2026-07 · Hugo (verificado en estabilidad-movil) |
| Chrome iOS (CriOS)             |   ✓   |     ✓      | — (modal "abrí en Safari") |  —  |  ▢  |  ▢   | 2026-07-07 · Hugo — mic solo en Safari; modal ios-safari OK |
| Firefox iOS (FxiOS)            |   ▢   |     ▢      | — (modal "abrí en Safari") |  —  |  ▢  |  ▢   | esperado: modal ios-safari (mismo caso que Chrome iOS) |
| Chrome Android                 |   ▢   |     ▢      |       ▢       |     ▢     |  ▢  |  ▢   |               |
| Chrome desktop                 |   ▢   |     ▢      |       ▢       |     ▢     |  ▢  |  —   |               |
| Edge desktop                   |   ▢   |     ▢      |       ▢       |     ▢     |  ▢  |  —   |               |
| Firefox desktop                |   ▢   |     ▢      | — (aviso honesto) |  ▢    |  ▢  |  —   | esperado: modal/placeholder "no soporta dictado" |
| Firefox Android                |   ▢   |     ▢      | — (aviso honesto) |  ▢    |  ▢  |  ▢   |               |
| WebView WhatsApp               |   ▢   |     ▢      | — (modal "abrí en navegador") | ▢ | ▢ | ▢ | esperado: modal Safari/Chrome |
| WebView Instagram              |   ▢   |     ▢      | — (modal "abrí en navegador") | ▢ | ▢ | ▢ | esperado: modal Safari/Chrome |

## Notas de prueba

_(Anotar acá cualquier "a mí no me anda", con navegador + versión + qué pasó.)_

-
