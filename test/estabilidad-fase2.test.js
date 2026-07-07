/* test/estabilidad-fase2.test.js — FASE 2 del plan de estabilidad móvil (voz confiable).
 * Cubre lo que jsdom puede reproducir:
 *   ítem 7  — errores del dictado (network/no-speech/audio-capture) dan aviso visible
 *   ítem 8  — dictado en es-AR con fallback si el motor no lo soporta
 *   ítem 9  — un borrador tipeado NO se envía solo al cancelar el dictado
 *   ítem 10 — el mic se libera al terminar el dictado (sin indicador de grabación colgado)
 *   ítem 11 — AudioContext "interrupted" se descarta al volver a foreground
 * Uso: node test/estabilidad-fase2.test.js   (exit 0 = verde)
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
    // Stub de SpeechRecognition que registra instancias y permite disparar eventos.
    window.__recs = [];
    const Rec = function () {
      this.__starts = 0;
      this.start = () => { this.__starts++; if (this.onstart) this.onstart(); };
      this.stop = () => { if (this.onend) this.onend(); };
      this.abort = () => {};
      window.__recs.push(this);
    };
    window.SpeechRecognition = Rec;
    window.webkitSpeechRecognition = Rec;
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
    window.fetch = () => Promise.reject(new Error("sin red en test"));
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
    // getUserMedia stub: entrega un stream trucho con tracks que cuentan stop()
    window.__stopped = 0;
    const fakeStream = () => ({
      getTracks: () => [{ stop: () => { window.__stopped++; }, muted: false, addEventListener() {} }],
      getAudioTracks: () => [{ stop: () => { window.__stopped++; }, muted: false, addEventListener() {} }]
    });
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => fakeStream() }
    });
  }
});

const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const chatlog = () => doc.getElementById("chatlog");
const input = doc.getElementById("input");
const userMsgs = () => chatlog().querySelectorAll(".msg.user").length;

console.log("── estabilidad-fase2.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

window.typing = cb => cb();
ev("llmDisabled=true");   // los envíos van al motor regex (sin red)

const rec = window.__recs[0];   // instancia del composer principal (micBtn/input)
check("setupMic creó la instancia de dictado", !!rec && typeof rec.onend === "function");

// ── Ítem 8: idioma del dictado ────────────────────────────────────────────────
console.log("── Ítem 8: dictado en es-AR (voseo/topónimos) con fallback");
check("rec.lang es es-AR (no es-ES peninsular)", rec.lang === "es-AR");
rec.onerror({ error: "language-not-supported" });
rec.onend();
check("si el motor no soporta es-AR cae a es-419 y reintenta", rec.lang === "es-419" && rec.__starts >= 1);
ev("flow=null");

// ── Ítem 9: borrador tipeado NO se envía al cancelar el dictado ───────────────
console.log("── Ítem 9: cancelar dictado no manda el borrador tipeado");
input.value = "reclamo a medio escrib";
const before = userMsgs();
rec.onstart();                    // mic tocado por error, con texto a medio tipear
rec.onend();                      // se cancela sin hablar (sin onresult)
check("no se envió el borrador", userMsgs() === before);
check("el borrador sigue en el input", input.value === "reclamo a medio escrib");
// y el dictado real SÍ envía lo transcripto:
input.value = "";
rec.onstart();
rec.onresult({ results: [[{ transcript: "hola oriana" }]] });
rec.onend();
check("lo dictado sí se envía", userMsgs() === before + 1);

// ── Ítem 7: errores del dictado con aviso visible ─────────────────────────────
console.log("── Ítem 7: errores de dictado visibles (Android sin red = 'network')");
input.value = "";
rec.onstart();
rec.onerror({ error: "network" });
rec.onend();
check("error 'network' deja un aviso visible (no parece mic roto)", /conexi[oó]n|internet/i.test(input.placeholder));
rec.onstart();
check("arrancar de nuevo limpia el aviso", !/conexi[oó]n|internet/i.test(input.placeholder));
rec.onerror({ error: "no-speech" });
rec.onend();
check("error 'no-speech' avisa que no escuchó", /no te escuch/i.test(input.placeholder));

// ── Ítem 10: liberar el mic al terminar el dictado ────────────────────────────
console.log("── Ítem 10: el mic se libera al terminar (indicador de grabación)");
(async () => {
  await window.activateMic();   // concede permiso (stub) → _micStream vivo
  check("activateMic marca permiso concedido", (await window.micPermissionState()) === "granted");
  const stopped = window.__stopped;
  rec.onstart();
  rec.onresult({ results: [[{ transcript: "probando el micrófono" }]] });
  rec.onend();
  check("al terminar el dictado se apagan los tracks del mic", window.__stopped > stopped && ev("_micStream") === null);
  check("el permiso sigue reconocido sin el stream vivo (flag, no stream)", (await window.micPermissionState()) === "granted");

  // ── Ítem 11: AudioContext interrupted al volver de background ──────────────
  console.log("── Ítem 11: AudioContext 'interrupted' se recrea al volver a foreground");
  window.__ctxClosed = false;
  ev('ttsCtx = { state:"interrupted", close(){ window.__ctxClosed = true; return Promise.resolve(); } }');
  doc.dispatchEvent(new window.Event("visibilitychange"));
  await new Promise(r => setTimeout(r, 20));
  check("el ctx interrumpido se cierra y se descarta", window.__ctxClosed === true && ev("ttsCtx") === null);

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` estabilidad-fase2.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
