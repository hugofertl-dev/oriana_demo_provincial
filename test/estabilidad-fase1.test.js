/* test/estabilidad-fase1.test.js — FASE 1 del plan de estabilidad móvil (PLAN_ESTABILIDAD.md).
 * Cubre lo que jsdom puede reproducir:
 *   ítem 1  — fetch de /api/chat y /api/tts con AbortSignal (timeout de red)
 *   ítem 4  — reset de conversación invalida la respuesta LLM en vuelo + vacía llmQueue
 *   ítem 5  — el payload de /api/chat va acotado (≤16 mensajes, primero role user)
 *   ítem 6  — "quiero..." en paso confirm NO confirma el turno viejo
 * (ítems 2-3 son viewport/teclado: verificación manual en celular)
 * Uso: node test/estabilidad-fase1.test.js   (exit 0 = verde)
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
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
    window.SpeechSynthesisUtterance = function () {};
    const Rec = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
    window.SpeechRecognition = Rec;
    window.webkitSpeechRecognition = Rec;
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
    window.fetch = () => Promise.reject(new Error("sin red en test"));
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
  }
});

const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const flowState = () => ev("flow");
const chatlog = () => doc.getElementById("chatlog");
const allText = () => chatlog().textContent;
const lastBotHTML = () => { const els = chatlog().querySelectorAll(".msg.bot .bubble"); return els.length ? els[els.length - 1].innerHTML : ""; };
function reset() { chatlog().innerHTML = ""; }

console.log("── estabilidad-fase1.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

// typing() usa setTimeout(650ms); lo hacemos síncrono para el test.
window.typing = cb => cb();

const DB = ev("DB");

// ── Ítem 6: "quiero..." en paso confirm NO confirma el turno viejo ───────────
console.log("── Ítem 6: RX_YES no debe tratar 'quiero...' como confirmación");
reset();
window.handle("Quiero sacar un turno");
const hosp = DB.hospitales[0];
window.handle(hosp.nombre);
const esp = hosp.especialidades.find(e => !/guardia/i.test(e));
window.handle(esp);
window.handle(DB.turnos_agenda[0]);
check("flujo de turno llegó al paso confirm", flowState() && flowState().type === "turno" && flowState().step === "confirm");
const nTurnos = DB.turnos_activos.length;
// Esto es lo que manda el chip "+ Sacar un turno nuevo" (index.html) con un turno en confirm:
window.handle("Quiero sacar un turno en el hospital");
check("'Quiero sacar un turno...' NO confirmó el turno viejo", DB.turnos_activos.length === nTurnos);
check("no pintó '¡Listo...confirmado!' por el mensaje 'quiero...'", !/quedó\s*<strong>confirmado/i.test(lastBotHTML()));
// El sí genuino tiene que seguir funcionando (no sobre-corregir):
if (flowState() && flowState().step === "confirm") {
  window.handle("sí");
  check("'sí' en confirm SÍ confirma el turno", DB.turnos_activos.length === nTurnos + 1);
} else {
  // Si el mensaje re-arrancó el flujo (comportamiento alternativo válido), no hay confirm pendiente.
  check("'sí' en confirm SÍ confirma el turno (N/A: el flujo se reencaminó)", true);
}
ev("flow=null");

// ── Ítem 5: payload de /api/chat acotado (≤16 mensajes, primero user) ────────
console.log("── Ítem 5: llmHistory con tope al enviar");
(async () => {
  ev('llmHistory = Array.from({length:20},(_,i)=>({role:i%2?"assistant":"user",content:"m"+i}))');
  ev("llmDisabled=false; llmFailCount=0");
  let sent = null;
  window.fetch = (url, opts) => { sent = JSON.parse(opts.body); return Promise.resolve({ ok: true, json: async () => ({ reply: "ok", sugerencias: [], action: null }) }); };
  reset();
  await window.llmHandle("mensaje 21");
  check("el payload lleva como mucho 16 mensajes", sent && Array.isArray(sent.messages) && sent.messages.length <= 16);
  check("el primer mensaje enviado es role user (el server rechaza assistant-first)", sent && sent.messages.length && sent.messages[0].role === "user");
  check("el último mensaje enviado es el turno nuevo", sent && sent.messages[sent.messages.length - 1].content === "mensaje 21");

  // ── Ítem 1: los fetch de red llevan AbortSignal (timeout) ──────────────────
  console.log("── Ítem 1: timeouts de red (AbortSignal en /api/chat y /api/tts)");
  let capChat = null;
  window.fetch = (url, opts) => { capChat = opts; return Promise.resolve({ ok: true, json: async () => ({ reply: "ok", sugerencias: [], action: null }) }); };
  ev("llmHistory=[]"); reset();
  await window.llmHandle("con señal");
  check("fetch /api/chat lleva AbortSignal", !!(capChat && capChat.signal instanceof window.AbortSignal));
  let capTts = null;
  window.fetch = (url, opts) => { capTts = opts; return Promise.resolve({ ok: true, blob: async () => ({}) }); };
  await window.serverSpeak("hola");
  check("fetch /api/tts (serverSpeak) lleva AbortSignal", !!(capTts && capTts.signal instanceof window.AbortSignal));

  // ── Ítem 4: reset de conversación con request en vuelo ─────────────────────
  console.log("── Ítem 4: startAssistant invalida la respuesta en vuelo y vacía la cola");
  ev("llmHistory=[]; llmDisabled=false; llmFailCount=0"); reset();
  let resolveFetch;
  window.fetch = () => new Promise(r => { resolveFetch = r; });
  const inflight = window.llmHandle("hola en vuelo");
  ev('llmQueue.push("mensaje encolado")');
  window.startAssistant();   // reset con el fetch todavía en vuelo
  check("startAssistant vació llmQueue", ev("llmQueue.length") === 0);
  resolveFetch({ ok: true, json: async () => ({ reply: "respuesta tardía fantasma", sugerencias: [], action: null }) });
  await inflight;
  check("la respuesta vieja NO se inyectó en el historial nuevo", ev("llmHistory.length") === 0);
  check("la respuesta vieja NO se pintó en el chat nuevo", !allText().includes("respuesta tardía fantasma"));

  // Camino de error tardío: tampoco debe tocar el historial/failcount nuevos.
  let rejectFetch;
  window.fetch = () => new Promise((_, rej) => { rejectFetch = rej; });
  const inflight2 = window.llmHandle("otro en vuelo");
  window.startAssistant();
  ev("llmFailCount=0");
  rejectFetch(new Error("caída tardía"));
  await inflight2;
  check("el error tardío NO cuenta como fallo de la sesión nueva", ev("llmFailCount") === 0);
  check("el error tardío NO pintó aviso en el chat nuevo", !/problema de conexi[oó]n/i.test(allText()));

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` estabilidad-fase1.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
