/* test/dictado-doble-envio.test.js — Fix: doble envío al apretar Send durante el dictado.
 * Carrera reproducida:
 *   1. onresult (interim) vuelca la transcripción al input
 *   2. el usuario toca Send -> sendMain envía y limpia el input
 *   3. llega el onresult FINAL (después del tap) y rellena el input con el mismo texto
 *   4. onend ve gotResult && texto -> auto-envía por segunda vez  ← BUG
 * También cubre: el envío manual no debe pisar replyWithVoice a true, el flujo
 * normal de dictado (sin tap) sigue auto-enviando, y el chat de niños tiene la
 * misma protección.
 * Uso: node test/dictado-doble-envio.test.js   (exit 0 = verde)
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
    // Rec controlable: el test dispara onstart/onresult/onend a mano y registra abort()
    window.__recs = [];
    const Rec = function () {
      this.aborted = 0;
      this.start = () => {};
      this.stop = () => {};
      this.abort = () => { this.aborted++; };
      window.__recs.push(this);
    };
    window.SpeechRecognition = Rec;
    window.webkitSpeechRecognition = Rec;
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {}, removeAttribute() {}, load() {} }; };
    window.fetch = () => Promise.reject(new Error("sin red en test"));
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
  }
});

const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const chatlog = () => doc.getElementById("chatlog");
const userMsgs = () => chatlog().querySelectorAll(".msg.user").length;

console.log("── dictado-doble-envio.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

window.typing = cb => cb();
ev("flow=null; llmDisabled=true");   // motor regex, sin red

// setupMic se llama 2 veces en orden: chat principal, chat de niños
const recMain = window.__recs[0];
const recNinos = window.__recs[1];
check("hay 2 instancias de SpeechRecognition (principal y niños)", !!recMain && !!recNinos);

const input = doc.getElementById("input");
const sendBtn = doc.getElementById("sendBtn");
const RESULT = txt => ({ results: [[{ transcript: txt }]] });

// ── Caso 1: la carrera reportada (Send durante el dictado) ──────────────────
console.log("── Caso 1: Send durante el dictado NO duplica el mensaje");
chatlog().innerHTML = "";
recMain.onstart();
recMain.onresult(RESULT("quiero sacar un turno"));           // interim visible en el input
check("la transcripción llegó al input", input.value === "quiero sacar un turno");
sendBtn.onclick();                                            // el usuario toca Send
check("el tap de Send envió el mensaje", userMsgs() === 1);
check("Send abortó el dictado en curso", recMain.aborted >= 1);
recMain.onresult(RESULT("quiero sacar un turno"));            // onresult final, llega DESPUÉS del tap
check("el onresult final ya no rellena el input", input.value === "");
recMain.onend();                                              // fin del dictado
check("onend NO auto-envía de nuevo (1 solo mensaje)", userMsgs() === 1);
check("replyWithVoice queda en false (envió a mano)", ev("replyWithVoice") === false);

// ── Caso 2: dictado normal (sin tap) sigue auto-enviando una vez ────────────
console.log("── Caso 2: dictado normal sigue auto-enviando");
chatlog().innerHTML = "";
recMain.onstart();
recMain.onresult(RESULT("cuál es el hospital más cercano"));
recMain.onend();
check("el dictado sin tap auto-envió una vez", userMsgs() === 1);
check("replyWithVoice queda en true (habló)", ev("replyWithVoice") === true);
check("el input quedó limpio", input.value === "");

// ── Caso 3: misma protección en el chat de niños ────────────────────────────
console.log("── Caso 3: chat de niños");
const input2 = doc.getElementById("input2");
const sendBtn2 = doc.getElementById("sendBtn2");
const nUserMsgs = () => ev("ninosLog.querySelectorAll('.msg.user').length");
ev("ninosLog.innerHTML=''");
recNinos.onstart();
recNinos.onresult(RESULT("hola"));
sendBtn2.onclick();
recNinos.onresult(RESULT("hola"));
recNinos.onend();
check("niños: Send durante dictado no duplica", nUserMsgs() === 1);
check("niños: Send abortó el dictado", recNinos.aborted >= 1);

console.log(`\n${PASS} ✅ / ${FAIL} ❌`);
process.exit(FAIL ? 1 : 0);
