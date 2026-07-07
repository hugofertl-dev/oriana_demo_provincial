/* test/speakable.test.js — normalización de texto para la voz (fix voz-abreviaturas).
 * La voz no debe leer abreviaturas crudas: "Mié 8/07" debe decirse
 * "miércoles ocho de julio". Ejercita speakable() real cargando index.html en jsdom.
 * Uso: node test/speakable.test.js   (exit 0 = verde)
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
    window.URL.createObjectURL = () => "blob:stub";
  }
});

const { window } = dom;
const ev = s => window.eval(s);

console.log("── speakable.test :: carga del documento");
check("index.html cargó sin errores de JS", scriptErrors.length === 0);
if (scriptErrors.length) { scriptErrors.forEach(e => console.log("     " + (e.message || e))); process.exit(1); }
check("speakable accesible", ev("typeof speakable") === "function");

const say = t => ev("speakable(" + JSON.stringify(t) + ")");
// La abreviatura no debe sobrevivir como palabra suelta (ojo: "miércoles" contiene "mié",
// por eso se busca la abreviatura aislada y no un includes).
const abbrLeft = (out, ab) => new RegExp("(^| )" + ab + "([ ,.]|$)", "i").test(out);

console.log("── días abreviados de la agenda de turnos → nombre completo");
const AGENDA = [
  ["Mié 8/07 · 09:30", "Mié", "miércoles", "ocho de julio"],
  ["Jue 9/07 · 08:15", "Jue", "jueves", "nueve de julio"],
  ["Vie 10/07 · 10:20", "Vie", "viernes", "diez de julio"],
  ["Lun 14/07", "Lun", "lunes", "catorce de julio"],
  ["Sáb 12/07 · 20:00", "Sáb", "sábado", "doce de julio"],
  ["Dom 13/07", "Dom", "domingo", "trece de julio"],
  ["Mar 8/07 · 09:30", "Mar", "martes", "ocho de julio"]
];
for (const [txt, ab, dia, fecha] of AGENDA) {
  const out = say(txt);
  check(`"${txt}" dice "${dia}"`, out.toLowerCase().includes(dia) && !abbrLeft(out, ab));
  check(`"${txt}" dice "${fecha}"`, out.includes(fecha));
}

console.log("── 'mar' palabra común NO se convierte en 'martes'");
check("'el mar estaba agitado' conserva 'mar'", /\bmar estaba\b/i.test(say("el mar estaba agitado")) && !/martes/i.test(say("el mar estaba agitado")));

console.log("── horas: formato hablado de 12 h con momento del día y 'a las'");
check("'Jue 9/07 · 15:40' → 'a las tres y cuarenta de la tarde'", (() => { const o = say("Jue 9/07 · 15:40"); return o.includes("a las tres y cuarenta de la tarde") && !/quince y cuarenta/.test(o); })());
check("'Sáb 12/07 · 20:00' → 'a las ocho de la noche'", (() => { const o = say("Sáb 12/07 · 20:00"); return o.includes("a las ocho de la noche") && !/veinte en punto/.test(o); })());
check("'Mié 8/07 · 11:00' → 'a las once de la mañana'", say("Mié 8/07 · 11:00").includes("a las once de la mañana"));
check("'Vie 10/07 · 10:20' → 'a las diez y veinte de la mañana'", say("Vie 10/07 · 10:20").includes("a las diez y veinte de la mañana"));
check("'09:15' → 'nueve y cuarto de la mañana'", say("El turno es a las 09:15").includes("nueve y cuarto de la mañana"));
check("'21:00 a 01:00' → hora 1 en femenino ('una', no 'uno')", (() => { const o = say("21:00 a 01:00"); return o.includes("nueve de la noche") && /\buna de la/.test(o) && !/\buno de la/.test(o); })());
check("'12:30' → 'doce y media del mediodía'", say("12:30").includes("doce y media del mediodía"));
check("no dice 'a las a las' cuando el texto ya lo trae", !/a las a las/.test(say("Turnos: Mié 09/07 a las 11:00")));

console.log("── abreviaturas con punto: el punto no sobrevive");
check("'Dr. Ramón Madariaga' → 'doctor Ramón' (sin punto pegado)", (() => { const o = say("Hospital Dr. Ramón Madariaga"); return o.includes("doctor Ramón") && !o.includes("doctor."); })());
check("'Av. Uruguay' → 'avenida Uruguay' (sin punto pegado)", (() => { const o = say("Av. Uruguay 1234"); return o.includes("avenida Uruguay") && !o.includes("avenida."); })());

console.log("── regresión: fechas y horas ya cubiertas siguen bien");
check("'Turnos: Mié 09/07 a las 11:00' → 'nueve de julio' y 'once'", (() => { const o = say("Turnos: Mié 09/07 a las 11:00"); return o.includes("nueve de julio") && /once/.test(o); })());
check("'24 h' → 'veinticuatro horas'", /veinticuatro horas/.test(say("Guardia 24 h")));
check("'$3.000' → 'tres mil pesos'", /tres mil pesos/.test(say("$3.000")));

console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` speakable.test: ${PASS} PASS, ${FAIL} FAIL`);
process.exit(FAIL === 0 ? 0 : 1);
