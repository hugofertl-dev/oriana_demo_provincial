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
    // Stub de geolocalización (configurable por test vía window.__geoResult)
    window.__geoResult = null;
    Object.defineProperty(window.navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(ok, err) {
          const g = window.__geoResult;
          if (g && g.ok) ok({ coords: g.ok });
          else if (g && g.err) err({ code: g.err });
        }
      }
    });
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
window.handle("Hospital Madariaga");
check("guarda hospital y pide problema", flowState().step === "problema" && /madariaga/i.test(flowState().data.hospital.nombre));
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

// ── chat-LLM: ejecutarAccion — idempotencia + guarda de acción incompleta ────
console.log("── chat-LLM: ejecutarAccion (fixes del review)");
ev("lastActionKey=null");
const nT = DB.turnos_activos.length;
const okT = window.ejecutarAccion({ type: "crear_turno", hospital: "Hospital Madariaga", especialidad: "Clínica médica", horario: "Vie 10/07 · 10:20" });
check("crear_turno completo agrega 1 turno", DB.turnos_activos.length === nT + 1 && /Confirmado/.test(okT));
const dupT = window.ejecutarAccion({ type: "crear_turno", hospital: "Hospital Madariaga", especialidad: "Clínica médica", horario: "Vie 10/07 · 10:20" });
check("crear_turno re-emitido NO duplica (idempotencia)", DB.turnos_activos.length === nT + 1 && dupT === "");
const nT2 = DB.turnos_activos.length;
const incT = window.ejecutarAccion({ type: "crear_turno", hospital: "Hospital Madariaga", especialidad: null, horario: null });
check("crear_turno incompleto NO crea y pide el dato (sin confirmación fantasma)", DB.turnos_activos.length === nT2 && /falt[oó] un dato/i.test(incT));
const nR = DB.reclamos.length;
const incR = window.ejecutarAccion({ type: "crear_reclamo", tipo_reclamo: "elec", lugar: null, problema: null });
check("crear_reclamo incompleto NO crea y pide el dato", DB.reclamos.length === nR && /falt[oó] un dato/i.test(incR));

// ── geo-cercania: ubicación real / dirección para hospital/comisaría cercano ──
console.log("── geo-cercania: ubicación + distancia (haversine)");
ev("geoRef=null");
// 1) elegir "hospital más cercano" abre el modal de ubicación (y preserva flow loc/kind)
reset(); window.startLoc("hospital");
check("startLoc abre el modal de ubicación", doc.getElementById("geoModal").classList.contains("open"));
check("startLoc preserva flow.type=loc/kind", flowState() && flowState().type === "loc" && flowState().kind === "hospital" && flowState().step === "await");
// descartar el modal (✕/backdrop) suelta el flujo await → el próximo mensaje va al LLM, no a locStep
window.closeGeoPanel();
check("cerrar el modal sin compartir suelta el flujo await", flowState() == null);
// 2) umbral híbrido 100 km: Posadas cerca (no ancla), Buenos Aires lejos (ancla)
check("Posadas NO supera el umbral (usa ubicación real)", ev("haversine([-27.40,-55.91], POSADAS) > 100") === false);
check("Buenos Aires SÍ supera el umbral (se ancla a Posadas)", ev("haversine([-34.60,-58.38], POSADAS) > 100") === true);
// 3) mostrarCercano real desde una coord de Posadas → devuelve el más cercano con distancia
window.getComputedStyle && (window.getComputedStyle = window.getComputedStyle || (()=>({})));
reset(); window.mostrarCercano("hospital", [-27.3660, -55.8935], "tu ubicación", false);
check("mostrarCercano deja geoRef seteado", ev("geoRef && geoRef.point") && ev("geoRef.anchored") === false);
check("chat muestra un hospital con distancia en km", /km/.test(allText()) && /Hospital/i.test(lastBotHTML()));
check("el más cercano a coord centro es el de Pediatría (Moreno)", /Barreyro|Pediatr/i.test(lastBotHTML()));
// 4) permiso denegado → panel con instrucciones
window.renderGeoPanel("denied");
check("panel denegado explica cómo habilitar", /bloqueada/i.test(doc.getElementById("geoLead").textContent) && doc.getElementById("geoActivate").textContent === "Reintentar");
// 5) dirección tipeada: localidad reconocida (Villa Cabello) → distancia desde ahí (aprox)
ev("geoRef=null"); window.pedirDireccion();
check("pedirDireccion pasa a paso 'address'", flowState() && flowState().step === "address");
reset(); window.handle("Villa Cabello");
check("dirección reconocida ancla a esa localidad", ev("geoRef && geoRef.label") === "Villa Cabello" && ev("geoRef.anchored") === true);
check("muestra distancia aproximada", /aprox/i.test(lastBotHTML()) && /km/.test(lastBotHTML()));
// 6) dirección NO reconocida → ancla Posadas
window.pedirDireccion(); reset(); window.handle("calle inexistente 9999 zzz");
check("dirección desconocida ancla a Posadas", ev("geoRef && geoRef.label") === "Posadas");
// 7) requestGeo con permiso concedido (stub) → onGeoOk limpia el flujo
ev("flow={type:'loc',kind:'hospital',step:'await'}; _geoKind='hospital'");
window.__geoResult = { ok: { latitude: -27.40, longitude: -55.91 } };
window.requestGeo();
check("requestGeo (permitido) procesa la ubicación y cierra el flujo", flowState() == null);
// 8) integración LLM: la action ubicacion_cercana abre el modal (no la calcula el modelo)
ev("flow=null; geoRef=null"); window.closeGeoPanel();
const outUC = window.ejecutarAccion({ type: "ubicacion_cercana", kind: "policia", hospital: null, especialidad: null, horario: null, tipo_reclamo: null, lugar: null, problema: null, descripcion: null });
check("ejecutarAccion(ubicacion_cercana) abre el modal y no devuelve tarjeta", doc.getElementById("geoModal").classList.contains("open") && outUC === "");
check("ejecutarAccion(ubicacion_cercana) setea flow loc/policia", flowState() && flowState().type === "loc" && flowState().kind === "policia");

// ── chat-LLM: manejo de error de conexión (async — fetch stub rechaza) ────────
(async () => {
  console.log("── chat-LLM: error de conexión → aviso + reintentar (sin degradar)");
  ev("llmDisabled=false; llmFailCount=0; llmHistory.length=0"); reset();
  await window.llmHandle("hola");   // fetch stub rechaza → path de error
  check("error transitorio muestra aviso de conexión + Reintentar", /problema de conexi[oó]n/i.test(lastBotHTML()) && /Reintentar/i.test(lastBotHTML()));
  check("1 error NO deshabilita el LLM", ev("llmDisabled") === false);
  await window.llmHandle("hola"); await window.llmHandle("hola");   // 2do y 3er fallo
  check("3 fallos consecutivos → modo básico (llmDisabled)", ev("llmDisabled") === true && ev("llmFailCount") >= 3);

  console.log("\n" + (FAIL === 0 ? "🟢" : "🔴") + ` reclamos.test: ${PASS} PASS, ${FAIL} FAIL`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
