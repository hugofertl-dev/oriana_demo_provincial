/* ══════════════════════════════════════════════════════════════════
   Función serverless de Netlify — Telemetría de errores del cliente (/api/log)
   FASE 2 del PLAN_PRODUCCION. El frontend captura errores globales
   (window.onerror + unhandledrejection) y los POSTea acá.

     POST  → guarda el error: console.error (visible en el panel de Netlify) +
             persiste en Upstash (lista `errlog`, topada a 200, TTL 7 días).
             Responde 204. FAIL-OPEN: si Upstash no está o falla, responde igual.
     GET ?key=<LOG_READ_TOKEN>  → devuelve los últimos 50 en JSON (401 sin token).

   Variables de entorno (todas opcionales — sin ellas la escritura sigue viva):
     UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN  (mismos que el rate-limit)
     LOG_READ_TOKEN   (secreto para leer por GET; sin él, GET siempre 401)
     ALLOWED_ORIGIN   (restringe CORS; sin setear → *)
   ══════════════════════════════════════════════════════════════════ */

const { checkRateLimit } = require("./_ratelimit");

const LIST_KEY = "errlog";
const MAX_LIST = 200;              // tope de la lista (LTRIM 0 199)
const TTL = 7 * 24 * 3600;         // 7 días
const READ_N = 50;                 // cuántos devuelve el GET
const RL_LIMIT = 30, RL_WINDOW = 60;   // rate-limit del propio /api/log (fail-open)

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors(), body: "" };

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // ── Lectura protegida por token ──────────────────────────────────────────
  if (event.httpMethod === "GET") {
    // Rate-limit también la lectura (fail-open): sin esto el token se puede
    // brute-forcear sin freno (el 401 responde rápido y barato).
    const rlg = await checkRateLimit(event, "logread", 10, RL_WINDOW);
    if (!rlg.allowed) return json(429, { error: "Demasiadas solicitudes" }, { "Retry-After": String(rlg.retryAfter) });
    // El token va por header Authorization (NO en la query string: una URL con el
    // secreto se filtra a access logs, historial y Referer).
    const readToken = process.env.LOG_READ_TOKEN;
    const auth = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
    const provided = auth.replace(/^Bearer\s+/i, "").trim();
    if (!readToken || provided !== readToken) return json(401, { error: "No autorizado" });
    if (!url || !token) return json(200, { errors: [], note: "sin storage configurado" });
    try {
      const data = await redis(url, token, [["LRANGE", LIST_KEY, "0", String(READ_N - 1)]]);
      const raw = (data && data[0] && data[0].result) || [];
      const errors = raw.map(s => { try { return JSON.parse(s); } catch { return { raw: s }; } });
      return json(200, { errors });
    } catch (e) {
      console.error("log.js GET:", String((e && e.message) || e).slice(0, 200));
      return json(502, { error: "No se pudo leer" });
    }
  }

  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido" });

  // Rate-limit por IP (fail-open): que un flood no queme la cuota diaria de Upstash.
  const rl = await checkRateLimit(event, "log", RL_LIMIT, RL_WINDOW);
  if (!rl.allowed) return json(429, { error: "Demasiadas solicitudes" }, { "Retry-After": String(rl.retryAfter) });

  if ((event.body || "").length > 8000) return json(413, { error: "Payload demasiado grande" });
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "JSON inválido" }); }

  // Shape mínimo, saneado del lado server (no confiamos en el cliente).
  // SIN datos personales: solo diagnóstico técnico (no guardamos IP tampoco).
  const entry = {
    msg: String(body.msg || "").slice(0, 500),
    stack: String(body.stack || "").slice(0, 1000),
    ua: String(body.ua || "").slice(0, 300),
    screen: String(body.screen || "").slice(0, 40),
    url: String(body.url || "").slice(0, 300),
    ts: String(body.ts || "").slice(0, 40)
  };
  if (!entry.msg) return json(400, { error: "Falta 'msg'" });

  // Visible en Netlify → Functions → log de /api/log (ítem 6 del plan).
  console.error("client-error:", JSON.stringify(entry));

  // Persistir (fail-open: si no hay config o Upstash falla, igual devolvemos 204).
  if (url && token) {
    try {
      await redis(url, token, [
        ["LPUSH", LIST_KEY, JSON.stringify(entry)],
        ["LTRIM", LIST_KEY, "0", String(MAX_LIST - 1)],
        ["EXPIRE", LIST_KEY, String(TTL)]
      ]);
    } catch (e) {
      console.error("log.js persist:", String((e && e.message) || e).slice(0, 200));
    }
  }
  return { statusCode: 204, headers: cors(), body: "" };
};

async function redis(url, token, commands) {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2000)
  });
  if (!res.ok) throw new Error("Upstash " + res.status);
  return res.json();
}

function cors() {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
  };
}
function json(statusCode, obj, extraHeaders) {
  return { statusCode, headers: { ...cors(), "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", ...(extraHeaders || {}) }, body: JSON.stringify(obj) };
}
