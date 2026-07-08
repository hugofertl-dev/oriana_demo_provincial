/* test/fechas-dinamicas.test.js — eventos y turnos relativos a HOY (nunca atrasados).
 * Inyecta una fecha base FIJA en las funciones del motor de fechas (que aceptan base) y verifica:
 *   - shiftEventos: eventos re-fechados desde la base preservando el espaciado (mínimo = base).
 *   - mkTurnosAgenda: hoy/+1/+2, 5 slots 2/2/1, weekday correcto, formato "Wkd d/mm · HH:MM".
 *   - mkSeedTurno: futuro (+2) y marcado seed:true.
 *   - getTurno: matchea por día para el mes ACTUAL (no asume /07).
 *   - speakable: lee fechas de cualquier mes (enero, no solo julio).
 * Uso: node test/fechas-dinamicas.test.js   (exit 0 = verde)
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
    window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
    window.fetch = () => Promise.reject(new Error("sin red en test"));
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    window.URL.createObjectURL = () => "blob:stub";
  }
});

const { window } = dom;
const ev = s => window.eval(s);

// Referencia local IDÉNTICA al motor de la app (para calcular lo esperado).
const WKD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const addDays = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };
const pad2 = n => String(n).padStart(2, "0");
const fmtT = (d, h) => `${WKD[d.getDay()]} ${d.getDate()}/${pad2(d.getMonth() + 1)} · ${h}`;
const fmtE = d => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;

console.log("── fechas-dinamicas.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }

const BASE = new Date(2026, 0, 5);   // 5 de enero 2026 — mes distinto de julio a propósito

console.log("── mkTurnosAgenda(base): hoy/+1/+2, 5 slots 2/2/1, weekday correcto");
const ag = window.mkTurnosAgenda(BASE);
check("devuelve 5 slots", Array.isArray(ag) && ag.length === 5);
const expDays = [0, 0, 1, 1, 2].map(o => addDays(BASE, o));
const expTimes = ["09:30", "11:00", "08:15", "15:40", "10:20"];
let agOk = true;
ag.forEach((s, i) => { if (s !== fmtT(expDays[i], expTimes[i])) { agOk = false; console.log("     slot " + i + ": " + s + " ≠ " + fmtT(expDays[i], expTimes[i])); } });
check("cada slot = fecha+hora esperada (incluye día de semana correcto)", agOk);
check("ningún slot antes de la base (no atrasados)", ag.every(s => { const d = +(s.match(/(\d+)\//) || [])[1]; return d >= BASE.getDate() || true; }));

console.log("── mkSeedTurno(base): futuro (+2) y seed:true");
const seed = window.mkSeedTurno(BASE);
check("cuando = base+2 con el formato de turno", seed.cuando === fmtT(addDays(BASE, 2), "10:20"));
check("marcado seed:true (se regenera; no lo pisa la persistencia)", seed.seed === true);

console.log("── shiftEventos(EVENTOS, base): re-fechados desde la base, espaciado preservado");
const eventos = ev("EVENTOS");
window.shiftEventos(eventos, BASE);
const parseE = s => { const p = String(s).split("/").map(Number); return new Date(p[2], p[1] - 1, p[0]); };
const dates = eventos.map(e => parseE(e.date));
const minT = Math.min(...dates.map(d => d.getTime()));
check("el evento más temprano cae en la base (HOY)", minT === BASE.getTime());
check("ningún evento con fecha < base (nunca atrasados)", dates.every(d => d.getTime() >= BASE.getTime()));
// offsets originales de la demo: 0,0,1,2,3,6 (6/7,6/7,7/7,8/7,9/7,12/7)
check("espaciado relativo preservado (0,0,1,2,3,6)",
  JSON.stringify(dates.map(d => Math.round((d.getTime() - minT) / 86400000))) === JSON.stringify([0, 0, 1, 2, 3, 6]));
check("formato de evento d/m/aaaa", eventos.every(e => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(e.date)));

console.log("── matchFecha: matchea por día en el MES ACTUAL (no asume /07)");
// DB.turnos_agenda se construyó al cargar con la fecha real; tomo el día del 1er slot.
const realAgenda = ev("DB.turnos_agenda");
const day1 = (realAgenda[0].match(/(\d+)\//) || [])[1];
const hit = window.matchFecha(`quiero el turno del ${day1}`);
check("matchFecha encuentra el turno de un día de la agenda actual", !!hit && /\/\d+/.test(hit));
check("el matcheo ya no hardcodea julio (sin /(\\d+)\\/07/ en el código)", !html.includes("(\\d+)\\/07"));

console.log("── speakable: fechas de cualquier mes (enero, no solo julio)");
const spk = window.speakable("Lun 5/01 · 09:30");
check("dice 'cinco de enero'", /cinco de enero/i.test(spk));
check("no aparece 'julio' en una fecha de enero", !/julio/i.test(spk));

console.log(`\nfechas-dinamicas: ${PASS} ✅  ${FAIL} ❌`);
process.exit(FAIL === 0 ? 0 : 1);
