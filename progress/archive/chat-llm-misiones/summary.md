# chat-llm-misiones — Chat de ORIANA con Claude (Anthropic) + datos de Misiones

**Fecha:** 2026-07-06 · **Estado:** done · **Commit impl.:** 04faf0a (+ cierre con fixes)

## Qué se hizo
Chat principal conducido por Claude vía función serverless `netlify/functions/chat.js`
(endpoint `/api/chat`, key en `LLM_API_KEY` del entorno, redirect en `netlify.toml`).
El LLM responde solo temas de la demo con datos de Misiones (system prompt + contexto JSON
de la DB) y devuelve `{reply, sugerencias, action}`. El frontend (`index.html`) muestra el
reply y ejecuta `action` (crear_turno / crear_reclamo / derivar_acompanamiento) contra la DB
simulada — mismos shapes y mismo contador de ticket que el flujo regex. Fallback: si `/api/chat`
falla, cae al motor de intenciones regex sin romper la conversación. Modelo `claude-sonnet-5`
(elegido por costo del endpoint público, decisión del usuario).

## Criterios (✅)
Respuesta por Claude con key oculta; solo datos de Misiones; fuera de tema → "estoy aprendiendo"
+ retoma; turno/reclamo confirmado se registra en la DB y aparece en Actividad/Mis reclamos;
fallback a regex; lectura por voz (ElevenLabs) cuando entró por audio; teléfonos como `tel:`.

## Review + seguridad (contexto fresco)
- **XSS descartado** con evidencia: la salida del LLM se escapa con `esc()`/`chipAttr()` (nunca
  llega a innerHTML sin escapar).
- API validada contra la skill `claude-api`: `claude-sonnet-5`, `output_config.format`,
  `thinking:{type:"disabled"}` y `stop_reason:"refusal"` son válidos y correctos.
- **Fixes aplicados al cierre** (tests en `test/reclamos.test.js`, 44/44):
  1. Idempotencia en `ejecutarAccion` → una action re-emitida no duplica ticket/turno.
  2. Guarda de action incompleta → sin "confirmación fantasma" (pide el dato en vez de no-op).
  3. `chat.js`: 500 genérico (no revela el nombre de la env var).
  4. CORS configurable por `ALLOWED_ORIGIN` (default `*`, no rompe deploy).

## Deuda conocida (aceptada por el usuario)
Endpoint `/api/chat` público SIN rate-limit → riesgo de abuso de costo de la API key. Mitigado
en costo por request (topes de payload/history, max_tokens 1024, thinking off) pero no en
volumen. Falta rate-limit por IP / edge. Ver `docs/lessons.md`. Requiere `LLM_API_KEY` (y
opcional `ALLOWED_ORIGIN`) en las env vars de Netlify.
