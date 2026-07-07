/* ══════════════════════════════════════════════════════════════════
   Rate-limit por IP con Upstash Redis (REST) — compartido por chat.js y tts.js.
   El prefijo "_" hace que Netlify NO lo trate como endpoint; solo se importa.

   Ventana fija: por cada request se hace INCR de una clave `rl:<endpoint>:<ip>`
   y, en el primer hit, EXPIRE <windowSec> NX (setea el TTL solo si no lo tiene).
   La clave expira sola al terminar la ventana → nueva ventana limpia.

   FAIL-OPEN (decisión del usuario): si faltan las env vars, Upstash no responde,
   tarda o devuelve algo inesperado, la request PASA. El rate-limit ahorra
   presupuesto; la red final son los spending limits. Nunca tira la demo.

   Variables de entorno (opcionales — sin ellas, todo pasa como hoy):
     UPSTASH_REDIS_REST_URL    (https://xxxx.upstash.io)
     UPSTASH_REDIS_REST_TOKEN  (secreto)
   ══════════════════════════════════════════════════════════════════ */

// IP del cliente detrás de Netlify: la trae en x-nf-client-connection-ip.
// Fallback al primer hop de x-forwarded-for (el cliente real; los siguientes
// son proxies). "unknown" agrupa lo que no traiga IP (peor caso: un solo cupo).
function clientIp(event) {
  const h = (event && event.headers) || {};
  // Tope de 45 chars (largo máx de un IPv6): acota el tamaño de la clave Redis
  // ante cualquier header raro/inflado (defensa en profundidad — en prod el
  // header nf lo setea Netlify y no llega inflado, pero no confiamos en eso).
  const cap = (v) => String(v).trim().slice(0, 45);
  const nf = h["x-nf-client-connection-ip"];
  if (nf) return cap(nf);
  const xff = h["x-forwarded-for"];
  if (xff) return cap(xff.split(",")[0]);
  return "unknown";
}

// Consume 1 del cupo de `ip` para `endpoint`. Devuelve {allowed, remaining, retryAfter}.
// opts.{url,token,fetch} son inyectables para tests; por defecto salen del entorno
// y del fetch global de Node 18+.
async function checkRateLimit(event, endpoint, limit, windowSec, opts = {}) {
  const url = opts.url !== undefined ? opts.url : process.env.UPSTASH_REDIS_REST_URL;
  const token = opts.token !== undefined ? opts.token : process.env.UPSTASH_REDIS_REST_TOKEN;
  const fetchImpl = opts.fetch || globalThis.fetch;

  // Sin config → fail-open silencioso (modo "como hoy", sin ruido en el log).
  if (!url || !token) return { allowed: true, remaining: limit, skipped: true };

  const key = `rl:${endpoint}:${clientIp(event)}`;
  try {
    // Pipeline atómico de Upstash: INCR y, si es nueva, EXPIRE ... NX.
    const res = await fetchImpl(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, String(windowSec), "NX"]]),
      // Corto a propósito: si Upstash tarda, no colgamos la demo — fail-open.
      signal: AbortSignal.timeout(1500)
    });
    if (!res.ok) {
      console.error("ratelimit: Upstash", res.status, "→ fail-open");
      return { allowed: true, remaining: limit, failOpen: true };
    }
    const data = await res.json();               // [{result:<count>}, {result:0|1}]
    const count = Number(data && data[0] && data[0].result);
    if (!Number.isFinite(count)) {
      console.error("ratelimit: respuesta inesperada de Upstash → fail-open");
      return { allowed: true, remaining: limit, failOpen: true };
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), retryAfter: windowSec };
  } catch (e) {
    // Timeout, red caída, JSON roto: dejar pasar y avisar al log (telemetría fase 2).
    console.error("ratelimit:", String((e && e.message) || e).slice(0, 200), "→ fail-open");
    return { allowed: true, remaining: limit, failOpen: true };
  }
}

module.exports = { checkRateLimit, clientIp };
