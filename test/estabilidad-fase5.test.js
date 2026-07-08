/* test/estabilidad-fase5.test.js — FASE 5 del plan de estabilidad móvil (menores/deuda).
 *   ítem 25 — audioCache con tope (~30) y revokeObjectURL (memoria en demo larga con voz)
 *   ítem 26 — turnos/reclamos/favoritos persisten en localStorage; "Cerrar sesión" resetea
 *   ítem 27 — sin autofocus del input en táctil (el teclado tapaba los chips de guía)
 *   ítem 28 — bubble() ya no hace window.scrollTo (saltos con teclado abierto en iOS)
 * Uso: node test/estabilidad-fase5.test.js   (exit 0 = verde)
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

let scrollToCalls = 0;
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
    window.scrollTo = () => { scrollToCalls++; };
    // táctil: pointer coarse (celular)
    window.matchMedia = q => ({ matches: /pointer:\s*coarse/.test(q), addEventListener() {}, addListener() {} });
    window.__revoked = 0;
    window.URL.createObjectURL = () => "blob:stub-" + Math.random();
    window.URL.revokeObjectURL = () => { window.__revoked++; };
    // Estado persistido de una "sesión anterior": una reserva del usuario y un favorito.
    // (v:2 — shape con flag `seed`. El turno SEMILLA se regenera solo; acá va solo la reserva
    // del usuario, sin flag, que debe conservarse. Ver feature fechas-dinamicas.)
    window.localStorage.setItem("oriana_demo_db", JSON.stringify({
      v: 2,   // versión del shape (un payload sin versión o de otra versión se descarta)
      turnos_activos: [
        { hospital: "Hospital de Fátima Dr. René Favaloro", esp: "Pediatría", cuando: "Jue 9/07 · 08:15", estado: "Confirmado" }
      ],
      reclamos: [{ id: "ELEC-4801", tipo: "elec", titulo: "Corte total — Posadas", resumen: "", estado: "En gestión" }],
      favs: { e2: true }
    }));
  }
});

const { window } = dom;
const doc = window.document;
const ev = s => window.eval(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

console.log("── estabilidad-fase5.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

window.typing = cb => cb();

(async () => {
  // ── Ítem 26: la demo sobrevive al refresh ───────────────────────────────────
  console.log("── Ítem 26: turnos/reclamos/favoritos persisten (localStorage)");
  check("el turno de la 'sesión anterior' está al recargar", ev("DB.turnos_activos.length") === 2);
  check("el reclamo persistido está al recargar", ev("DB.reclamos.length") === 1 && ev("DB.reclamos[0].id") === "ELEC-4801");
  check("el favorito persistido está al recargar", ev("favs && favs.e2 === true"));
  // una mutación nueva se guarda
  ev("lastActionKey=null");
  window.ejecutarAccion({ type: "crear_turno", hospital: "Hospital de Pediatría Dr. Fernando Barreyro", especialidad: "Pediatría", horario: "Mié 8/07 · 09:30" });
  const stored = JSON.parse(window.localStorage.getItem("oriana_demo_db") || "{}");
  check("crear un turno lo persiste al toque", Array.isArray(stored.turnos_activos) && stored.turnos_activos.length === 3);
  window.toggleFav("e1");
  const stored2 = JSON.parse(window.localStorage.getItem("oriana_demo_db") || "{}");
  check("marcar un favorito lo persiste", stored2.favs && stored2.favs.e1 === true);
  // reset: cerrar sesión limpia la data de demo
  window.logout();
  check("'Cerrar sesión' borra la data persistida (demo limpia)", window.localStorage.getItem("oriana_demo_db") == null);

  // ── Ítem 25: audioCache con tope y revoke ───────────────────────────────────
  console.log("── Ítem 25: audioCache acotado (demo larga con voz)");
  window.fetch = () => Promise.resolve({ ok: true, blob: async () => ({}) });
  for (let i = 0; i < 35; i++) await window.serverSpeak("texto número " + i);
  check("el cache no pasa de ~30 entradas", ev("Object.keys(audioCache).length") <= 30);
  check("las entradas desalojadas liberan el objectURL (revoke)", window.__revoked >= 5);

  // ── Ítem 27: sin autofocus en táctil ────────────────────────────────────────
  console.log("── Ítem 27: sin autofocus del input en táctil");
  window.startAssistant();
  await sleep(400);
  check("en táctil el input NO se autofoca (el teclado tapaba los chips)", doc.activeElement !== doc.getElementById("input"));

  // ── Ítem 28: bubble() sin window.scrollTo ───────────────────────────────────
  console.log("── Ítem 28: burbujas sin window.scrollTo (saltos en iOS)");
  scrollToCalls = 0;
  window.pushBot("hola sin salto");
  check("pushBot no llama window.scrollTo", scrollToCalls === 0);

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` estabilidad-fase5.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
