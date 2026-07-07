/* test/chip-durante-dictado.test.js — Fix: mensaje fantasma al tocar un chip durante el dictado.
 * Misma carrera que el doble envío de Send (ver test/dictado-doble-envio.test.js):
 *   1. onresult (interim) vuelca la transcripción al input
 *   2. el usuario toca un CHIP -> chipClick envía el texto del chip
 *   3. llega el onresult FINAL (después del tap) y rellena el input
 *   4. onend ve gotResult && texto -> auto-envía la transcripción  ← MENSAJE FANTASMA
 * Cura: chipClick desarma el dictado pendiente de AMBOS mics (cancelPending), igual que Send.
 * Uso: node test/chip-durante-dictado.test.js   (exit 0 = verde)
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

console.log("── chip-durante-dictado.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

window.typing = cb => cb();
ev("flow=null; llmDisabled=true");   // motor regex, sin red

const recMain = window.__recs[0];
const recNinos = window.__recs[1];
check("hay 2 instancias de SpeechRecognition (principal y niños)", !!recMain && !!recNinos);

const input = doc.getElementById("input");
const RESULT = txt => ({ results: [[{ transcript: txt }]] });

// ── Caso 1: tocar un chip durante el dictado NO deja mensaje fantasma ────────
console.log("── Caso 1: chip durante el dictado no duplica");
chatlog().innerHTML = "";
recMain.onstart();
recMain.onresult(RESULT("quiero sacar un turno"));           // interim en el input
check("la transcripción llegó al input", input.value === "quiero sacar un turno");
window.chipClick("hola");                                    // el usuario toca un chip mientras dicta
check("el chip envió su mensaje", userMsgs() === 1);
check("el chip abortó el dictado en curso", recMain.aborted >= 1);
recMain.onresult(RESULT("quiero sacar un turno"));           // onresult final, DESPUÉS del tap
check("el onresult final ya no rellena el input", input.value === "");
recMain.onend();                                             // fin del dictado
check("onend NO auto-envía la transcripción (1 solo mensaje)", userMsgs() === 1);

// ── Caso 2: el chip también desarma el dictado del chat de niños ─────────────
console.log("── Caso 2: chipClick cancela también el mic de niños");
recNinos.onstart();
recNinos.onresult(RESULT("hola"));
window.chipClick("hola");
check("el chip abortó el dictado de niños en curso", recNinos.aborted >= 1);

// ── Caso 3: pantalla de niños VISIBLE (rama del wrapper) tampoco duplica ─────
console.log("── Caso 3: chip con la pantalla de niños visible");
const input2 = doc.getElementById("input2");
const nUserMsgs = () => ev("ninosLog.querySelectorAll('.msg.user').length");
doc.getElementById("screen-ninos").classList.remove("hidden");   // niños visible → rama ninosVisible del wrapper
ev("ninosLog.innerHTML=''");
recNinos.onstart();
recNinos.onresult(RESULT("me duele la panza"));                  // interim en el input2
window.chipClick("hola");                                        // toca un chip mientras dicta
check("niños visible: el chip envió su mensaje", nUserMsgs() === 1);
check("niños visible: el input2 quedó limpio (borrador descartado)", input2.value === "");
recNinos.onresult(RESULT("me duele la panza"));                  // onresult final, DESPUÉS del tap
recNinos.onend();
check("niños visible: onend NO auto-envía la transcripción (1 solo mensaje)", nUserMsgs() === 1);
doc.getElementById("screen-ninos").classList.add("hidden");

console.log(`\n${PASS} ✅ / ${FAIL} ❌`);
process.exit(FAIL ? 1 : 0);
