# rate-limit-apis — FASE 1 del PLAN_PRODUCCION (blindaje de APIs)

**Cerrada:** 2026-07-07 · **Commit:** f0529c4

## Qué se hizo (ítems 1-2 de Fase 1)
Rate-limit por IP en los endpoints públicos pagos + CORS restringido al dominio real.
- `netlify/functions/_ratelimit.js` (nuevo): ventana fija por IP con Upstash Redis vía REST
  (`INCR` + `EXPIRE … NX` en pipeline atómico). Prefijo `_` → Netlify no lo trata como endpoint.
- `chat.js`: 20 req/min por IP · `tts.js`: 40 req/min por IP → **429 con `Retry-After`** antes de
  llamar al LLM/ElevenLabs (el cliente ya maneja 429 con "dame unos segundos" + Reintentar).
- `tts.js`: CORS unificado a `ALLOWED_ORIGIN` (antes `*` hardcodeado).

## Criterios ✅
- C1 429 al superar 20/40 en 60s, sin tocar el proveedor · C2 bajo el límite pasa normal ·
  C3 fail-open ante fallo de Upstash (silencioso si faltan env vars) · C4 shape `{error}` +
  `Retry-After` legible como HTTP 429 por el cliente · C5 `Access-Control-Allow-Origin` desde
  `ALLOWED_ORIGIN` con fallback `*`.

## Decisiones clave
- **Mecanismo:** Upstash Redis (elegido sobre Netlify Blobs por atomicidad, y sobre el nativo por costo).
- **Límites:** holgado (chat 20 / tts 40 por min) para tolerar NAT/WiFi compartido de evento.
- **FAIL-OPEN** (decisión explícita del usuario): un fallo del contador nunca tira la demo; la red
  final son los spending limits (ítem 3, manual).

## Hallazgos útiles / validado en deploy
- IP de `x-nf-client-connection-ip` (fallback `x-forwarded-for`, topada a 45 chars). El usuario
  **validó contra el deploy real** que rotando un `x-nf-client-connection-ip` falso el 429 aparece
  igual → Netlify sobrescribe ese header, es inspoofable. Detalle en `docs/lessons.md`.
- Reviewer APROBADO CON OBSERVACIONES (2 menores aplicadas) · security-auditor 0 altos (secreto
  Upstash no se filtra, sin inyección en clave Redis, CORS sin origin-reflection).

## Pendiente de Fase 1 (acción manual del usuario, sin código)
- Ítem 3: spending limits en consolas de Anthropic y ElevenLabs.
- Ítem 4: presupuesto de concurrencia si hay evento masivo (evaluar tier de la API key).

## Verificación
`node test/ratelimit.test.js` (12 checks, rojo-primero + sabotaje manual de `count<=limit`) +
`scripts/verify.sh full` verde + e2e contra el deploy validado por el usuario.
