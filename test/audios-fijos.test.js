/* test/audios-fijos.test.js — FASE 5 ítem 18: audios fijos pre-generados del acompañamiento.
 * Prueba la LÓGICA DE SELECCIÓN en speak() (sin red ni audio real):
 *   - audioKey() determinístico e igual a una implementación de referencia (idéntica a la del generador).
 *   - frase con hash en PREGEN → reproduce el MP3 de assets/audio/ (NO pega a /api/tts).
 *   - frase sin hash → cae al TTS en vivo (serverSpeak).
 *   - asset presente pero que falla al reproducir → fallback al TTS en vivo (fail-safe).
 *   - las 9 frases de flujo del JSON canónico están textualmente en index.html (guard de drift).
 * Uso: node test/audios-fijos.test.js   (exit 0 = verde)
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
    const R = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
    window.SpeechRecognition = R; window.webkitSpeechRecognition = R;
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {}, removeAttribute() {}, load() {} }; };
    window.fetch = () => Promise.reject(new Error("sin red en test"));
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
  }
});

const { window } = dom;
const ev = s => window.eval(s);

console.log("── audios-fijos.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

// Implementación de referencia del hash: DEBE coincidir con la del generador (que usa window.audioKey).
function refKey(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); }

console.log("── audioKey determinístico e igual a la referencia");
check("audioKey existe", typeof window.audioKey === "function");
for (const s of ["Hola mundo", "Línea 144 · 24 h", "áéíóú ñ 911", ""]) {
  check(`audioKey(${JSON.stringify(s.slice(0,12))}) determinístico y = referencia`,
    window.audioKey(s) === window.audioKey(s) && window.audioKey(s) === refKey(s) && /^[0-9a-f]{8}$/.test(window.audioKey(s)));
}
check("audioKey distingue textos distintos", window.audioKey("uno") !== window.audioKey("dos"));

// ── Instrumentar el pipeline de reproducción ────────────────────────────────
let calls;
function reset() { calls = { webAudio: [], server: 0, browser: 0 }; ev("replyWithVoice=true; ttsOn=true"); }
window.webAudioPlay = async (url) => { calls.webAudio.push(url); if (window.__failAsset && /assets\/audio\//.test(url)) throw new Error("asset fail"); };
window.serverSpeak = async (t) => { calls.server++; return "blob:server"; };
window.browserSpeak = () => { calls.browser++; };
window.stopAudio = () => {};

const PHRASE = "Frase de prueba para audios fijos";
const cleanKey = () => window.audioKey(window.speakable(PHRASE).slice(0, 600));

(async () => {
  console.log("── frase CON audio fijo (hash en PREGEN) → reproduce el asset, NO /api/tts");
  reset(); window.__failAsset = false;
  const key = cleanKey();
  ev(`PREGEN = new Set(["${key}"])`);
  await window.speak(PHRASE);
  check("reprodujo assets/audio/<hash>.mp3", calls.webAudio[0] === `assets/audio/${key}.mp3`);
  check("NO llamó al TTS en vivo (serverSpeak)", calls.server === 0);

  console.log("── frase SIN audio fijo (PREGEN vacío) → TTS en vivo");
  reset(); ev("PREGEN = new Set()");
  await window.speak(PHRASE);
  check("llamó al TTS en vivo (serverSpeak)", calls.server === 1);
  check("no reprodujo ningún asset", !calls.webAudio.some(u => /assets\/audio\//.test(u)));

  console.log("── asset presente pero que FALLA al reproducir → fallback a TTS en vivo (fail-safe)");
  reset(); window.__failAsset = true;
  ev(`PREGEN = new Set(["${key}"])`);
  await window.speak(PHRASE);
  check("intentó el asset primero", calls.webAudio.some(u => u === `assets/audio/${key}.mp3`));
  check("cayó al TTS en vivo tras el fallo del asset", calls.server === 1);
  window.__failAsset = false;

  console.log("── guard de drift: las 9 frases de flujo del JSON están en index.html");
  const canon = JSON.parse(fs.readFileSync(path.join(root, "scripts/audios-fijos.json"), "utf8"));
  check("audios-fijos.json tiene 9 frases de flujo", Array.isArray(canon.flow) && canon.flow.length === 9);
  let allPresent = true;
  for (const f of canon.flow) if (!html.includes(f)) { allPresent = false; console.log("     falta en index.html: " + f.slice(0, 50)); }
  check("cada frase del JSON aparece textual en index.html (si editás una, regenerá)", allPresent);

  console.log(`\naudios-fijos: ${PASS} ✅  ${FAIL} ❌`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
