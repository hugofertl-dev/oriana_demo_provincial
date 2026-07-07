/* test/estabilidad-fase4.test.js — FASE 4 del plan de estabilidad móvil (performance).
 * Cubre lo que jsdom puede reproducir:
 *   ítem 20 — warm-up: al cargar la app se pinguea /api/chat (cold start fuera del 1er mensaje)
 *   ítem 24 — 429/529: mensaje "dame unos segundos" + chip Reintentar deshabilitado (sin
 *             martillar el endpoint) y SIN contar como fallo hacia llmDisabled
 * (ítems 19/21/22/23 son config/assets: se verifican por inspección, no acá)
 * Uso: node test/estabilidad-fase4.test.js   (exit 0 = verde)
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

let PASS = 0, FAIL = 0;
function check(name, cond) {
  if (cond) { PASS++; console.log("  ✅ " + name); }
  else { FAIL++; console.log("  ❌ " + name); }
}

const scriptErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => { if (!/Could not parse CSS|Not implemented/.test(String(e && e.message))) scriptErrors.push(e); });

const fetchCalls = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  url: "https://demo.test/",
  beforeParse(window) {
    window.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
    window.SpeechSynthesisUtterance = function () {};
    const Rec = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
    window.SpeechRecognition = Rec;
    window.webkitSpeechRecognition = Rec;
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
    window.fetch = (url, opts) => { fetchCalls.push({ url: String(url), method: (opts && opts.method) || "GET" }); return Promise.reject(new Error("sin red en test")); };
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
  }
});

const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const chatlog = () => doc.getElementById("chatlog");
const lastBotHTML = () => { const els = chatlog().querySelectorAll(".msg.bot .bubble"); return els.length ? els[els.length - 1].innerHTML : ""; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("── estabilidad-fase4.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

window.typing = cb => cb();

(async () => {
  // ── Ítem 20: warm-up del cold start al cargar ───────────────────────────────
  console.log("── Ítem 20: ping de warm-up a /api/chat al cargar la app");
  await sleep(1400);   // el ping va diferido para no competir con la carga inicial
  check("se pingueó /api/chat al cargar (cold start fuera del 1er mensaje)",
    fetchCalls.some(c => c.url.includes("/api/chat")));

  // ── Ítem 24: 429/529 → esperar, no martillar ────────────────────────────────
  console.log("── Ítem 24: 429/529 con espera en vez de reintento inmediato");
  ev("llmDisabled=false; llmFailCount=0; llmHistory=[]");
  chatlog().innerHTML = "";
  window.fetch = () => Promise.resolve({ ok: false, status: 429, json: async () => ({}) });
  await window.llmHandle("hola");
  check("429 avisa 'unos segundos' (no 'problema de conexión')", /segund/i.test(lastBotHTML()));
  const chip = chatlog().querySelector(".chip");
  check("el chip Reintentar arranca deshabilitado", !!chip && /pointer-events:\s*none/.test(chip.getAttribute("style") || ""));
  check("429 NO cuenta como fallo hacia llmDisabled", ev("llmFailCount") === 0 && ev("llmDisabled") === false);
  check("el turno fallido se saca del historial (reintento limpio)", ev("llmHistory.length") === 0);
  // los errores comunes siguen con el camino de siempre:
  chatlog().innerHTML = "";
  window.fetch = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
  await window.llmHandle("hola");
  check("un 500 sigue el camino transitorio de siempre (Reintentar habilitado)",
    /problema de conexi[oó]n/i.test(lastBotHTML()) && ev("llmFailCount") === 1);

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` estabilidad-fase4.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
