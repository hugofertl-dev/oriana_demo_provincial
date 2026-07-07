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

- **WebView de WhatsApp/Instagram/Facebook:** al tocar 🎙️ aparece un modal
  "abrí en Safari/Chrome" y NO se intenta el dictado. El chat de texto anda
  normal. (Detección por user-agent en `isWebView()`.)
- **Firefox (u otro navegador sin `SpeechRecognition`):** al tocar 🎙️ el
  placeholder avisa "tu navegador no soporta dictado, escribile a ORIANA".
  Ya NO simula un dictado ni auto-envía frases. El TTS server-side sí anda.

## Matriz

| Navegador / entorno            | Carga | Chat texto | Dictado (STT) | TTS (voz) | Geo | Back | Fecha · quién |
|--------------------------------|:-----:|:----------:|:-------------:|:---------:|:---:|:----:|---------------|
| Safari iOS                     |   ✓   |     ✓      |       ✓       |     ✓     |  ✓  |  ✓   | 2026-07 · Hugo (verificado en estabilidad-movil) |
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
