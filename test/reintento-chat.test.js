/* test/reintento-chat.test.js — Fix: reintento automático del chat LLM.
 * Un bache transitorio (timeout o 5xx) de UN request ya no muestra "problema de
 * conexión": se reintenta UNA vez en silencio (typing visible) antes de avisar.
 * 429/529 (saturado) NO se reintentan — van directo al aviso "muchas consultas".
 * Uso: node test/reintento-chat.test.js   (exit 0 = verde)
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

const dom = new JSDOM(html, {
  runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://demo.test/",
  beforeParse(window) {
    window.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
    window.SpeechSynthesisUtterance = function () {};
    const Rec = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
    window.SpeechRecognition = Rec; window.webkitSpeechRecognition = Rec;
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
    window.fetch = () => Promise.reject(new Error("sin red en test"));
  }
});
const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const chatlog = () => doc.getElementById("chatlog");
const lastBotHTML = () => { const els = chatlog().querySelectorAll(".msg.bot .bubble"); return els.length ? els[els.length - 1].innerHTML : ""; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
window.typing = cb => cb();

// fetch programable: cada llamada consume la siguiente respuesta de la cola.
// entrada: {status} para respuesta HTTP, o {reject:true} para simular timeout/red,
//          o {ok:true, reply} para éxito.
let queue = [], calls = 0;
function setSeq(arr) { queue = arr.slice(); calls = 0; }
window.fetch = (url, opts) => {
  if (!String(url).includes("/api/chat")) return Promise.reject(new Error("otro endpoint"));
  // El ping de warm-up (OPTIONS) NO debe consumir la cola ni contar como intento.
  if (opts && opts.method === "OPTIONS") return Promise.resolve({ ok: true, status: 204, json: async () => ({}) });
  calls++;
  const r = queue.shift() || { reject: true };
  if (r.reject) return Promise.reject(new Error("aborted"));         // timeout/red
  if (r.ok) return Promise.resolve({ ok: true, status: 200, json: async () => ({ reply: r.reply || "listo!", sugerencias: [], action: null }) });
  return Promise.resolve({ ok: false, status: r.status, json: async () => ({}) });
};
function reset() { ev("llmDisabled=false; llmFailCount=0; llmHistory=[]; llmEpoch=0"); chatlog().innerHTML = ""; }

console.log("── reintento-chat.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

(async () => {
  // 1. 5xx una vez y luego éxito → NO muestra el aviso; entra la respuesta. (rojo antes del fix)
  reset(); setSeq([{ status: 500 }, { ok: true, reply: "todo bien" }]);
  await window.llmHandle("hola");
  check("un 500 transitorio se reintenta y entra la respuesta (sin aviso)",
    /todo bien/.test(lastBotHTML()) && !/problema de conexi[oó]n/i.test(lastBotHTML()));
  check("el reintento hizo exactamente 2 fetches", calls === 2);
  check("tras recuperar, llmFailCount vuelve a 0", ev("llmFailCount") === 0);

  // 2. timeout (red) una vez y luego éxito → también se recupera solo
  reset(); setSeq([{ reject: true }, { ok: true, reply: "recuperado" }]);
  await window.llmHandle("hola");
  check("un timeout único se reintenta y entra la respuesta", /recuperado/.test(lastBotHTML()) && calls === 2);

  // 3. Falla las DOS veces → recién ahí muestra el aviso (una sola vez lógica)
  reset(); setSeq([{ status: 500 }, { status: 500 }]);
  await window.llmHandle("hola");
  check("si fallan los 2 intentos, muestra 'problema de conexión'", /problema de conexi[oó]n/i.test(lastBotHTML()));
  check("dos intentos = 2 fetches y cuenta como UN fallo (llmFailCount=1)", calls === 2 && ev("llmFailCount") === 1);

  // 4. 429 (saturado) NO se reintenta: aviso 'muchas consultas' y 1 solo fetch
  reset(); setSeq([{ status: 429 }, { ok: true, reply: "no debería usarse" }]);
  await window.llmHandle("hola");
  check("429 no se reintenta (aviso 'segundos', 1 fetch)", /segund/i.test(lastBotHTML()) && calls === 1);
  check("429 no cuenta como fallo", ev("llmFailCount") === 0);

  // 5. 529 (saturado) tampoco se reintenta
  reset(); setSeq([{ status: 529 }, { ok: true, reply: "no" }]);
  await window.llmHandle("hola");
  check("529 no se reintenta (1 fetch)", calls === 1 && /segund/i.test(lastBotHTML()));

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` reintento-chat.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
