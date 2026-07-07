/* test/estabilidad-fase3.test.js — FASE 3 del plan de estabilidad móvil (robustez del chat).
 *   ítem 13 — goChat pasa por smartHandle (lock del LLM), no por handle directo
 *   ítem 14 — el flow loc/address se limpia al salir del chat
 *   ítem 15 — abrir el modal geo vacía llmQueue (el mensaje encolado no se come como dirección)
 *   ítem 16 — dobles disparos: chips con debounce + flow seteado sincrónico (antes del typing)
 *   ítem 17 — cerrar el modal geo cancela el getCurrentPosition en vuelo; "cancelar" cierra el modal
 *   ítem 18 — popstate (back de Android) navega entre pantallas en vez de salir de la demo
 * Uso: node test/estabilidad-fase3.test.js   (exit 0 = verde)
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
  url: "https://demo.test/",
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
    // geolocalización: guarda los callbacks para dispararlos DESPUÉS (test de cancelación)
    window.__geoCb = null;
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition(ok, err) { window.__geoCb = { ok, err }; } }
    });
  }
});

const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const chatlog = () => doc.getElementById("chatlog");
const userMsgs = () => chatlog().querySelectorAll(".msg.user").length;
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("── estabilidad-fase3.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

window.typing = cb => cb();

(async () => {
  // ── Ítem 13: goChat respeta el lock del LLM (smartHandle) ───────────────────
  console.log("── Ítem 13: goChat → smartHandle (no saltea el lock del LLM)");
  ev("llmDisabled=false; llmFailCount=0; llmHistory=[]");
  let fetchCalled = false;
  window.fetch = () => { fetchCalled = true; return Promise.resolve({ ok: true, json: async () => ({ reply: "ok", sugerencias: [], action: null }) }); };
  window.goChat("Quiero sacar un turno en el hospital");
  await sleep(300);
  check("goChat va al LLM vía smartHandle (fetch llamado)", fetchCalled);
  check("goChat no dejó un flujo regex colgado", ev("flow") == null);
  ev("flow=null; llmDisabled=true");   // el resto de los tests usa el motor regex
  window.fetch = () => Promise.reject(new Error("sin red"));

  // ── Ítem 16b: el flow se setea sincrónico (antes del typing de 650 ms) ──────
  console.log("── Ítem 16: flow sincrónico + chips con debounce");
  chatlog().innerHTML = "";
  const pend = [];
  window.typing = cb => { pend.push(cb); };   // typing NO corre todavía (simula los 650 ms)
  window.handle("Quiero sacar un turno");
  check("flow queda seteado ANTES de que corra el typing", ev("flow") && ev("flow").type === "turno");
  pend.forEach(cb => cb()); pend.length = 0;
  window.typing = cb => cb();
  ev("flow=null");

  // ── Ítem 16a: doble tap en un chip no dispara dos veces ─────────────────────
  chatlog().innerHTML = "";
  window.pushBot("Elegí una opción" + window.chipRow([{ label: "Hola", send: "hola" }]));
  const chip = chatlog().querySelector(".chip");
  const before = userMsgs();
  chip.click();
  chip.click();   // doble tap inmediato
  check("el segundo tap inmediato NO manda un segundo mensaje", userMsgs() === before + 1);

  // ── Ítem 14: el flow loc se limpia al salir del chat ────────────────────────
  console.log("── Ítem 14: flow loc/address expira al navegar fuera del chat");
  ev('flow={type:"loc",kind:"hospital",step:"address"}');
  window.show("home");
  check("salir del chat limpia el flow loc (address)", ev("flow") == null);
  window.show("chat");

  // ── Ítem 15: abrir el modal geo vacía la cola del LLM ───────────────────────
  console.log("── Ítem 15: mensaje encolado no se come como dirección");
  ev('llmQueue.push("mensaje tipeado mientras el LLM abría el modal")');
  window.openGeoPanel("hospital");
  check("openGeoPanel vació llmQueue", ev("llmQueue.length") === 0);
  window.closeGeoPanel();

  // ── Ítem 17: geo sin cancelación ────────────────────────────────────────────
  console.log("── Ítem 17: cerrar el modal cancela la geolocalización en vuelo");
  chatlog().innerHTML = "";
  ev('flow={type:"loc",kind:"hospital",step:"await"}; _geoKind="hospital"');
  window.openGeoPanel("hospital");
  window.requestGeo();
  window.closeGeoPanel();                    // el usuario cierra ANTES de que llegue la ubicación
  window.__geoCb.ok({ coords: { latitude: -27.366, longitude: -55.8935 } });
  await sleep(600);                          // onGeoOk usa un setTimeout de 500 ms
  check("la tarjeta 'más cercano' NO aparece tras cerrar el modal", !/km/.test(chatlog().textContent));
  // "cancelar" tipeado con el modal abierto: limpia el flow Y cierra el modal
  ev('flow={type:"loc",kind:"hospital",step:"await"}');
  window.openGeoPanel("hospital");
  window.handle("cancelar");
  check("'cancelar' tipeado cierra el modal geo", !doc.getElementById("geoModal").classList.contains("open"));
  check("'cancelar' tipeado limpia el flow", ev("flow") == null);

  // ── Ítem 18: back físico de Android ─────────────────────────────────────────
  console.log("── Ítem 18: popstate navega hacia atrás dentro de la demo");
  window.show("chat");
  window.show("turnos");
  window.dispatchEvent(new window.PopStateEvent("popstate", { state: { screen: "chat" } }));
  check("popstate con {screen:'chat'} vuelve al chat", !doc.getElementById("screen-chat").classList.contains("hidden"));
  check("la pantalla anterior (turnos) quedó oculta", doc.getElementById("screen-turnos").classList.contains("hidden"));
  check("navegar apila estados en history (pushState por pantalla)", window.history.length > 1);

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` estabilidad-fase3.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
