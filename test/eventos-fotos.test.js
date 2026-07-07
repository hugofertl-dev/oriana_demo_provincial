/* test/eventos-fotos.test.js — fotos reales en Eventos (feature eventos-fotos-reales).
 * Carga index.html con jsdom y afirma los criterios EARS: cada evento referencia
 * una foto url-safe y optimizada que existe en assets/, y tarjetas + hero la
 * muestran sin gradientes placeholder ni emojis.
 * Uso: node test/eventos-fotos.test.js   (exit 0 = verde)
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

console.log("── eventos-fotos.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

const EVENTOS = ev("EVENTOS");
check("EVENTOS tiene los 6 eventos", Array.isArray(EVENTOS) && EVENTOS.length === 6);

// ── Criterio 4: fotos url-safe, existentes y optimizadas ────────────────────
console.log("── Criterio 4: assets url-safe y optimizados");
const KB = 1024;
for (const e of EVENTOS) {
  const okName = typeof e.img === "string" && /^assets\/[a-z0-9-]+\.jpe?g$/.test(e.img);
  check(`${e.id} referencia foto url-safe (img: ${e.img || "—"})`, okName);
  if (!okName) continue;
  const f = path.join(root, e.img);
  const exists = fs.existsSync(f);
  check(`${e.img} existe`, exists);
  if (exists) check(`${e.img} pesa ≤ 155 KB`, fs.statSync(f).size <= 155 * KB);
}
const leftovers = fs.readdirSync(path.join(root, "assets")).filter(n => !/^[a-z0-9-]+\.[a-z0-9]+$/.test(n));
check("assets/ sin originales pesados ni nombres con espacios/acentos", leftovers.length === 0);

// ── Criterios 1 y 3: tarjetas del mosaico con foto, sin gradiente ni emoji ──
console.log("── Criterios 1 y 3: mosaico");
window.setLindaFilter("prox");
const mosaico = doc.getElementById("lindaBody");
const cards = [...mosaico.querySelectorAll(".ev-card")];
check("el mosaico renderiza las 6 tarjetas", cards.length === 6);
EVENTOS.forEach((e, i) => {
  const ph = cards[i] && cards[i].querySelector(".ph");
  const style = ph ? ph.getAttribute("style") || "" : "";
  check(`tarjeta ${e.id} usa su foto`, style.includes(e.img));
  check(`tarjeta ${e.id} sin gradiente placeholder ni emoji`,
    !style.includes("linear-gradient") && !cards[i].querySelector(".emo"));
});

// ── Criterios 2 y 3: hero del detalle con la misma foto ─────────────────────
console.log("── Criterios 2 y 3: detalle");
for (const e of EVENTOS) {
  window.renderEvento(e.id);
  const hero = doc.querySelector("#eventoBody .ev-hero");
  const style = hero ? hero.getAttribute("style") || "" : "";
  check(`hero de ${e.id} usa su foto, sin gradiente ni emoji`,
    style.includes(e.img) && !style.includes("linear-gradient") && !hero.querySelector(".emo"));
}

console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` eventos-fotos.test: ${PASS} PASS, ${FAIL} FAIL`);
process.exit(FAIL === 0 ? 0 : 1);
