/* test/tabbar.test.js — tabbar siempre visible (feature tabbar-siempre-visible).
 * Carga index.html con jsdom y afirma los criterios EARS: la tabbar
 * (Actividad/Inicio/Eventos) se ve y funciona en toda pantalla post-login,
 * se oculta solo en login/signup, y el estado activo es correcto.
 * Uso: node test/tabbar.test.js   (exit 0 = verde)
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

console.log("── tabbar.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }
check("show() y tabbar accesibles", typeof window.show === "function" && !!doc.getElementById("tabbar"));

const tabbar = doc.getElementById("tabbar");
const tabbarVisible = () => !tabbar.classList.contains("hidden");
const screenVisible = name => !doc.getElementById("screen-" + name).classList.contains("hidden");
const activeTabs = () => [...doc.querySelectorAll(".navbtn.active")].map(b => b.dataset.screen);

// ── Criterio 2: login y signup SIN tabbar ────────────────────────────────────
console.log("── Criterio 2: login/signup ocultan la tabbar");
window.show("login");
check("login oculta la tabbar", !tabbarVisible());
window.show("signup");
check("signup oculta la tabbar", !tabbarVisible());

// ── Criterio 1: toda pantalla post-login muestra la tabbar ──────────────────
console.log("── Criterio 1: tabbar visible en toda pantalla post-login");
const POST_LOGIN = ["home", "chat", "turnos", "reclamos", "cerca", "perfil", "ninos", "linda", "evento"];
for (const s of POST_LOGIN) {
  window.show(s);
  check(`pantalla '${s}' muestra la tabbar`, tabbarVisible());
}

// ── Criterio 1 (funcionalidad): las 3 pestañas navegan desde cualquier lado ─
console.log("── Criterio 1: las pestañas navegan (tocar = ir)");
const clickTab = screen => doc.querySelector(`.navbtn[data-screen="${screen}"]`).dispatchEvent(
  new window.MouseEvent("click", { bubbles: true }));
window.show("chat");
clickTab("linda");
check("desde el chat, tocar Eventos abre Eventos", screenVisible("linda") && !screenVisible("chat"));
window.show("evento");
clickTab("turnos");
check("desde el detalle de evento, tocar Actividad abre Actividad", screenVisible("turnos"));
window.show("perfil");
clickTab("home");
check("desde perfil, tocar Inicio abre Inicio", screenVisible("home"));

// ── Criterio 4: estado activo de las pestañas ────────────────────────────────
console.log("── Criterio 4: estado activo correcto");
window.show("turnos");
check("en Actividad, solo 'turnos' activa", activeTabs().join() === "turnos");
window.show("linda");
check("en Eventos, solo 'linda' activa", activeTabs().join() === "linda");
window.show("evento");
check("en detalle de evento, 'linda' sigue activa", activeTabs().join() === "linda");
for (const s of ["chat", "reclamos", "cerca", "perfil", "ninos"]) {
  window.show(s);
  check(`en '${s}' ninguna pestaña activa`, activeTabs().length === 0);
}

// ── Criterio 3/5: el layout reserva lugar para la tabbar (CSS estático) ─────
// jsdom no hace layout real; se afirma el contrato CSS: el composer del chat
// queda apilado sobre la tabbar (bottom ≥ alto de la barra) y las pantallas
// sin padding inferior previo lo reservan. La verificación visual final es
// manual con la app corriendo (parte del contrato de la feature).
console.log("── Criterios 3 y 5: espacio reservado para la barra");
const css = [...doc.querySelectorAll("style")].map(s => s.textContent).join("\n");
const px = (rule, prop) => {
  const m = rule && rule[0].match(new RegExp(prop + ":\\s*(\\d+)px"));
  return m ? parseInt(m[1], 10) : -1;
};
// El umbral se deriva del alto REAL de la barra: si #tabbar crece, esto falla.
const tabbarH = px(css.match(/#tabbar\{[^}]*\}/s), "height");
check("CSS de #tabbar declara su altura", tabbarH > 0);
check(`el composer sticky queda por encima de la tabbar (bottom ≥ ${tabbarH}px)`,
  px(css.match(/\.composer\{[^}]*\}/s), "bottom") >= tabbarH);
check(`#screen-evento reserva padding inferior ≥ ${tabbarH}px`,
  px(css.match(/#screen-evento\{[^}]*\}/s), "padding-bottom") >= tabbarH);

console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` tabbar.test: ${PASS} PASS, ${FAIL} FAIL`);
process.exit(FAIL === 0 ? 0 : 1);
