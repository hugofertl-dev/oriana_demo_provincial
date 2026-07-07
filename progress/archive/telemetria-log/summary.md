# telemetria-log — FASE 2 del PLAN_PRODUCCION (telemetría de errores)

**Cerrada:** 2026-07-07 · **Commit:** (pendiente)

## Qué se hizo (ítem 5, con parte del 6)
Captura global de errores del cliente → endpoint propio `/api/log` (NO Sentry, decisión del usuario).
- **`netlify/functions/log.js`** (nuevo):
  - **POST**: sanea el payload (slices), `console.error` (visible en panel Netlify → ítem 6) + persiste
    en Upstash (`LPUSH errlog` → `LTRIM 0 199` → `EXPIRE 7d`). Responde **204**. Rate-limit 30/min
    reusando `_ratelimit.js`. Body cap 8000. **No guarda IP ni datos del ciudadano.**
  - **GET**: lectura de los últimos 50 en JSON, **token por header `Authorization: Bearer`** (no query
    string), GET también rate-limited (10/min) y con `X-Content-Type-Options: nosniff`. Sin/mal token → 401.
  - **FAIL-OPEN**: sin Upstash o si falla, el POST igual responde 204.
- **`index.html`** (+espejo `oriana-mobile.html`, byte-idéntico): handlers `error` + `unhandledrejection`
  → POST con `{msg, stack≤1000, ua, screen(_lastScreen), url(pathname), ts}`. Anti-loop: tope 10/sesión +
  `.catch()`/`try` para que el propio POST nunca re-loguee ni rompa.
- **`netlify.toml`**: redirect `/api/log`.

## Criterios ✅
C1 captura con shape correcto sin PII · C2 tope 10/sesión · C3 fallo del POST se traga (no cascada) ·
C4 persiste (lista 200, TTL 7d) + 204, fail-open · C5 GET 401 sin token / lista con token.

## Decisiones y aprendizajes
- **Persistir en Upstash** (sobre solo-console.error) para tener histórico consultable reusando la base del rate-limit.
- **Lectura por token en header** (no query string) — fix de la auditoría: un secreto en la URL se filtra
  a access logs/historial/Referer. Regla general para futuros endpoints protegidos → ver `docs/lessons.md`.
- Reviewer APROBADO (obs. menor aplicada: se quitó el flag `_errSending` que no protegía nada; el anti-loop
  real es `.catch()` + cap). Security-auditor: 2 MEDIOS **corregidos** (token por header + GET rate-limited),
  1 bajo asumido por diseño ("log drowning", tradeoff del fail-open), sin inyección en Redis.

## A futuro (anotado por la auditoría, no bloqueante)
- Cuando se construya un panel lector de los logs: **escapar** `msg`/`stack` (XSS almacenado latente desde
  input anónimo del POST público). Hoy inocuo: el GET devuelve JSON con `nosniff`.
- Cuando se conecte a datos REALES: verificar que ningún mensaje de error interpole PII del ciudadano.

## 🖐️ Acción del usuario
Cargar `LOG_READ_TOKEN` en Netlify (aleatorio ≥32 chars). Lectura:
`curl -H "Authorization: Bearer <token>" https://<sitio>/api/log`. Las `UPSTASH_*` ya estaban.

## Verificación
`node test/telemetria-log.test.js` (19 checks, rojo-primero + sabotaje manual de cap y token) +
`scripts/verify.sh full` verde.
