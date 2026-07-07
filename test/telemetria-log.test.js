/* test/telemetria-log.test.js — FASE 2 del PLAN_PRODUCCION (telemetría).
 * Parte A (jsdom): captura global en el cliente (window error / unhandledrejection)
 *   → POST a /api/log con el shape correcto, tope de 10/sesión, anti-loop.
 * Parte B (require): handler serverless netlify/functions/log.js con fetch MOCKEADO
 *   → POST persiste en Upstash y responde 204; GET sin token 401 / con token lista.
 * Uso: node test/telemetria-log.test.js   (exit 0 = verde)
 */
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.resolve(__dirname, "..");
let PASS = 0, FAIL = 0;
function check(name, cond) {
  if (cond) { PASS++; console.log("  ✅ " + name); }
  else { FAIL++; console.log("  ❌ " + name); }
}

// ───────────────────────── Parte A — captura en el cliente (jsdom) ─────────────
(function clientCapture() {
  console.log("── Parte A: captura global en el cliente");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const vc = new VirtualConsole();
  vc.on("jsdomError", () => {});   // no ensuciar la salida con errores esperados

  const logCalls = [];      // POSTs a /api/log
  let failLog = false;      // cuando true, el fetch a /api/log rechaza
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: "https://demo.test/",
    beforeParse(window) {
      window.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
      window.SpeechSynthesisUtterance = function () {};
      const Rec = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
      window.SpeechRecognition = Rec; window.webkitSpeechRecognition = Rec;
      window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
      window.scrollTo = () => {};
      window.fetch = (url, opts) => {
        const u = String(url);
        if (u.includes("/api/log")) {
          logCalls.push({ url: u, body: opts && opts.body });
          return failLog ? Promise.reject(new Error("log caído")) : Promise.resolve({ ok: true, status: 204 });
        }
        return Promise.reject(new Error("sin red en test"));
      };
    }
  });
  const win = dom.window;

  // Dispara un error JS no capturado (evento 'error' de window).
  function fireError(msg) {
    const ev = new win.Event("error");
    ev.message = msg; ev.error = new Error(msg);
    win.dispatchEvent(ev);
  }
  function fireRejection(msg) {
    const ev = new win.Event("unhandledrejection");
    ev.reason = new Error(msg);
    win.dispatchEvent(ev);
  }

  // 1. Un error dispara un POST a /api/log con el shape esperado
  fireError("boom-de-prueba");
  const first = logCalls[0];
  check("un error dispara POST a /api/log", !!first);
  let payload = {};
  try { payload = JSON.parse(first.body); } catch {}
  check("payload trae msg con el mensaje del error", /boom-de-prueba/.test(payload.msg || ""));
  check("payload trae stack, ua, screen, url, ts", ["stack", "ua", "screen", "url", "ts"].every(k => k in payload));
  check("stack topado a ≤1000 chars", (payload.stack || "").length <= 1000);
  // SIN datos del ciudadano: el payload no debe incluir el nombre de la usuaria demo
  const nombre = (win.DB && win.DB.ciudadano && win.DB.ciudadano.nombre) || "Sofía";
  check("payload NO incluye el nombre del ciudadano", !JSON.stringify(payload).includes(nombre));

  // 2. unhandledrejection también loguea
  fireRejection("promesa-rota");
  check("una promesa rechazada también loguea", logCalls.some(c => /promesa-rota/.test(c.body || "")));

  // 3. Anti-loop: si el propio POST FALLA (aún bajo el cap), se intenta UNA vez,
  //    se traga el fallo (no throw) y no dispara una cascada de POSTs. Se prueba
  //    ANTES de agotar el cap para que ejercite el swallow real, no el tope.
  failLog = true;
  const before = logCalls.length;   // van 2, lejos del cap
  let threw = false;
  try { fireError("con-log-caido"); } catch { threw = true; }
  check("un fallo del propio /api/log no propaga excepción", !threw);
  check("el POST fallido se intentó una sola vez (sin cascada)", logCalls.length - before === 1);
  failLog = false;

  // 4. Tope de 10 por sesión: ya van 3, disparo 20 más → total no debe pasar de 10
  for (let i = 0; i < 20; i++) fireError("spam-" + i);
  check("tope de 10 errores por sesión (no manda más)", logCalls.length === 10);
})();

// ───────────────────────── Parte B — handler serverless ────────────────────────
(async function serverHandler() {
  console.log("── Parte B: handler /api/log (fetch mockeado)");
  // fetch falso que entiende el pipeline REST de Upstash según el primer verbo.
  const seen = [];
  globalThis.fetch = async (url, opts) => {
    const cmds = JSON.parse(opts.body);
    seen.push({ url: String(url), cmds });
    const verb = cmds[0][0];
    if (verb === "INCR") return { ok: true, status: 200, json: async () => [{ result: 1 }, { result: 1 }] };       // rate-limit
    if (verb === "LPUSH") return { ok: true, status: 200, json: async () => [{ result: 1 }, { result: "OK" }, { result: 1 }] };
    if (verb === "LRANGE") return { ok: true, status: 200, json: async () => [{ result: [JSON.stringify({ msg: "guardado" })] }] };
    return { ok: true, status: 200, json: async () => [{ result: null }] };
  };

  process.env.UPSTASH_REDIS_REST_URL = "https://x.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
  process.env.LOG_READ_TOKEN = "secreto-lectura";
  delete require.cache[require.resolve("../netlify/functions/log.js")];
  const { handler } = require("../netlify/functions/log.js");

  // 1. POST válido → 204 y persiste con LPUSH
  const post = await handler({ httpMethod: "POST", headers: { "x-nf-client-connection-ip": "1.1.1.1" }, body: JSON.stringify({ msg: "algo falló", stack: "x", ua: "UA", screen: "chat", url: "/", ts: "t" }) });
  check("POST válido responde 204", post.statusCode === 204);
  check("POST persiste con LPUSH a la lista", seen.some(s => s.cmds.some(c => c[0] === "LPUSH")));
  check("el LPUSH topa la lista (LTRIM) y pone TTL (EXPIRE)", seen.some(s => s.cmds.some(c => c[0] === "LTRIM")) && seen.some(s => s.cmds.some(c => c[0] === "EXPIRE")));

  // 2. POST sin msg → 400
  const bad = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({ stack: "x" }) });
  check("POST sin msg → 400", bad.statusCode === 400);

  // 3. GET sin token → 401 (el token va por header Authorization, no por query)
  const noTok = await handler({ httpMethod: "GET", headers: {} });
  check("GET sin token → 401", noTok.statusCode === 401);

  // 3b. GET con el token en la query string (NO debe autorizar: el secreto no viaja por URL)
  const inQuery = await handler({ httpMethod: "GET", headers: {}, queryStringParameters: { key: "secreto-lectura" } });
  check("GET con token en la query string NO autoriza (→401)", inQuery.statusCode === 401);

  // 4. GET con token equivocado en el header → 401
  const wrongTok = await handler({ httpMethod: "GET", headers: { authorization: "Bearer nope" } });
  check("GET con token equivocado → 401", wrongTok.statusCode === 401);

  // 5. GET con token correcto en Authorization → 200 + lista parseada
  const okGet = await handler({ httpMethod: "GET", headers: { authorization: "Bearer secreto-lectura" } });
  const gotBody = JSON.parse(okGet.body || "{}");
  check("GET con token correcto (header) → 200 con errores parseados", okGet.statusCode === 200 && Array.isArray(gotBody.errors) && gotBody.errors[0] && gotBody.errors[0].msg === "guardado");
  check("respuesta del GET trae X-Content-Type-Options: nosniff", okGet.headers["X-Content-Type-Options"] === "nosniff");

  // 6. Fail-open: sin config de Upstash, un POST igual responde 204 (no rompe)
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete require.cache[require.resolve("../netlify/functions/log.js")];
  delete require.cache[require.resolve("../netlify/functions/_ratelimit.js")];
  const { handler: h2 } = require("../netlify/functions/log.js");
  const failOpen = await h2({ httpMethod: "POST", headers: {}, body: JSON.stringify({ msg: "sin storage" }) });
  check("sin Upstash configurado el POST igual responde 204 (fail-open)", failOpen.statusCode === 204);

  console.log(`\n  ${PASS} verdes, ${FAIL} rojos`);
  process.exit(FAIL ? 1 : 0);
})();
