/* test/reclamos.test.js — smoke test del flujo de reclamos (feature reclamos-tickets).
 * Carga index.html con jsdom, stubbea las APIs de voz/audio que jsdom no trae,
 * y ejercita el motor de intenciones por código afirmando los criterios EARS.
 * Uso: node test/reclamos.test.js   (exit 0 = verde)
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

// Capturar errores reales de JS del script inline (no el ruido de CSS de jsdom).
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
// flow y DB son let/const de nivel superior -> NO son props de window.
// window.eval corre en el entorno léxico global y sí los ve.
const ev = s => window.eval(s);
const flowState = () => ev("flow");
const chatlog = () => doc.getElementById("chatlog");
const lastBotHTML = () => { const els = chatlog().querySelectorAll(".msg.bot .bubble"); return els.length ? els[els.length - 1].innerHTML : ""; };
const allText = () => chatlog().textContent;
function reset() { chatlog().innerHTML = ""; }

console.log("── reclamos.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }
check("funciones y estado accesibles (handle, DB, renderReclamos)",
  typeof window.handle === "function" && ev("typeof DB") === "object" && typeof window.renderReclamos === "function");

// typing() usa setTimeout(650ms); lo hacemos síncrono para el test.
window.typing = cb => cb();

const DB = ev("DB");

// ── Criterio 5 (estado vacío, antes de generar ninguno) ──────────────────────
console.log("── Criterio 5: estado vacío de 'Mis reclamos'");
window.renderReclamos();
check("lista vacía muestra 'No tenés reclamos'", /No ten[eé]s reclamos/i.test(doc.getElementById("reclamosList").innerHTML));

// ── Criterio 1 (reclamo genérico → menú de 2 temas, sin flujo) ───────────────
console.log("── Criterio 1: reclamo sin tema → ofrece los 2 temas");
reset(); window.handle("Quiero hacer un reclamo");
check("ofrece tema Luz", /Luz/i.test(lastBotHTML()));
check("ofrece tema Hospital", /Hospital/i.test(lastBotHTML()));
check("no arranca un flujo todavía", flowState() == null);

// ── Criterio 2 (flujo eléctrico, slot-filling, sin ticket hasta confirmar) ───
console.log("── Criterio 2: flujo servicio eléctrico");
reset(); window.handle("Reclamo por corte o baja tensión de luz");
check("arranca flujo elec en paso 'tipo'", flowState() && flowState().type === "reclamo" && flowState().sub === "elec" && flowState().step === "tipo");
window.handle("Corte total");
check("guarda tipo y pide localidad", flowState().step === "localidad" && /corte total/i.test(flowState().data.tipo));
check("el paso localidad NO ofrece chips (carga libre)", !/class="chip/.test(lastBotHTML()));
window.handle("x");
check("rechaza localidad inválida (sigue en 'localidad')", flowState().step === "localidad");
window.handle("Posadas");
check("guarda localidad y pide dirección", flowState().step === "direccion" && /posadas/i.test(flowState().data.localidad));
check("el paso dirección NO ofrece chips (carga libre)", !/class="chip/.test(lastBotHTML()));
window.handle("Avenida Uruguay");
check("rechaza dirección sin número (sigue en 'direccion')", flowState().step === "direccion");
window.handle("Av. Uruguay 1234");
check("guarda dirección (calle y número) y pide desde cuándo", flowState().step === "desde" && /1234/.test(flowState().data.direccion));
window.handle("Hace unas horas");
check("guarda 'desde' y pasa a confirmar", flowState().step === "confirm" && /hora/i.test(flowState().data.desde));
check("NO generó ticket antes de confirmar", DB.reclamos.length === 0);

// ── Criterio 4 (confirmar → ticket ELEC- + estado 'En gestión') ──────────────
console.log("── Criterio 4: confirmación genera ticket");
reset(); window.handle("confirmar");
check("se generó 1 reclamo", DB.reclamos.length === 1);
check("ticket con prefijo ELEC-", /^ELEC-\d+$/.test(DB.reclamos[0].id));
check("estado 'En gestión'", DB.reclamos[0].estado === "En gestión");
check("confirmación muestra el número de ticket", allText().includes(DB.reclamos[0].id));
check("el reclamo elec guardó localidad y dirección", /posadas/i.test(DB.reclamos[0].titulo) && /1234/.test(DB.reclamos[0].resumen));
check("flujo cerrado tras confirmar", flowState() == null);

// ── Criterio 3 (flujo hospital) ──────────────────────────────────────────────
console.log("── Criterio 3: flujo hospital público");
reset(); window.handle("Reclamo por atención en un hospital público");
check("arranca flujo hosp en paso 'hospital'", flowState() && flowState().sub === "hosp" && flowState().step === "hospital");
window.handle("Hospital Central Provincial");
check("guarda hospital y pide problema", flowState().step === "problema" && /central/i.test(flowState().data.hospital.nombre));
window.handle("Demora en la atención");
check("guarda problema y pide descripción", flowState().step === "desc" && /demora/i.test(flowState().data.problema));
window.handle("Esperé más de cuatro horas y no me atendieron");
check("guarda descripción y pasa a confirmar", flowState().step === "confirm" && flowState().data.desc.length > 3);
reset(); window.handle("sí");
check("se generó el 2º reclamo", DB.reclamos.length === 2);
check("ticket con prefijo HOSP-", /^HOSP-\d+$/.test(DB.reclamos[1].id));

// ── Criterio 5 (lista con reclamos) ──────────────────────────────────────────
console.log("── Criterio 5: lista con reclamos generados");
window.renderReclamos();
const listHTML = doc.getElementById("reclamosList").innerHTML;
check("lista muestra el ticket ELEC", listHTML.includes(DB.reclamos[0].id));
check("lista muestra el ticket HOSP", listHTML.includes(DB.reclamos[1].id));

// ── Criterio 6 (tema fuera de alcance → mensaje educado, sin ticket) ─────────
console.log("── Criterio 6: tema fuera de alcance");
const before = DB.reclamos.length;
reset(); window.handle("Quiero reclamar por la basura de mi cuadra");
check("responde que todavía no cuenta con esa información", /no cuento con la informaci[oó]n|sigo aprendiendo/i.test(lastBotHTML()));
check("NO generó ticket para tema fuera de alcance", DB.reclamos.length === before);
check("no dejó un flujo abierto", flowState() == null);
reset(); window.handle("reclamo por el agua");
check("otro tema fuera de alcance (agua) también es rechazado con cortesía", /no cuento con la informaci[oó]n|sigo aprendiendo/i.test(lastBotHTML()) && DB.reclamos.length === before);

// ── Criterio 7 (cancelar durante el flujo → sin ticket) ──────────────────────
console.log("── Criterio 7: cancelar durante el flujo");
const before2 = DB.reclamos.length;
window.handle("Reclamo por corte o baja tensión de luz");
check("flujo abierto", flowState() != null);
window.handle("cancelar");
check("flujo abandonado sin ticket", flowState() == null && DB.reclamos.length === before2);

// ── Regresión de ruteo (hallazgos del review) ────────────────────────────────
console.log("── Regresión: el ruteo de reclamos no pisa intents críticos");
// #1 (seguridad): violencia que menciona atención médica NO debe caer en reclamo-hospital.
const before3 = DB.reclamos.length;
reset(); window.handle("mi pareja me maltrata y necesito atención médica");
check("violencia+médico deriva a acompañamiento (144), no a reclamo", /acompa[nñ]amiento|confidencial/i.test(lastBotHTML()));
check("no arranca flujo de reclamo por maltrato+atención", flowState() == null && DB.reclamos.length === before3);
// #2: 'problema' + hospital cercano debe ir a ubicación, no a reclamo.
reset(); window.handle("tengo un problema de salud, ¿dónde queda el hospital más cercano?");
check("problema+hospital cercano → flujo de ubicación (loc), no reclamo", flowState() && flowState().type === "loc" && flowState().kind === "hospital");
ev("flow=null"); // limpiar
// "denunciar problemas en el hospital" (palabra del pedido original) SÍ debe ir a reclamo-hospital.
reset(); window.handle("quiero denunciar problemas en el hospital");
check("'denunciar problemas en el hospital' → reclamo-hospital", flowState() && flowState().sub === "hosp");
ev("flow=null");

console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` reclamos.test: ${PASS} PASS, ${FAIL} FAIL`);
process.exit(FAIL === 0 ? 0 : 1);
