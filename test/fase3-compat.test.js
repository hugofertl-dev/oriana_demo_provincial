/* test/fase3-compat.test.js — FASE 3 del PLAN_PRODUCCION (compatibilidad multi-navegador).
 *   ítem 8 — WebView de WhatsApp/IG: al tocar el micro, modal "abrí en Safari/Chrome" (isWebView + estado webview)
 *   ítem 9 — Firefox honesto: sin SpeechRecognition NO se simula el dictado; aviso claro
 * Uso: node test/fase3-compat.test.js   (exit 0 = verde)
 *
 * Estrategia: isWebView() se prueba montando el documento con distintos user-agent
 * (opción `userAgent` de JSDOM) y llamando window.isWebView(). El estado "webview"
 * del panel se prueba llamando window.renderMicPanel("webview") y leyendo el DOM.
 * La ausencia del dictado simulado se chequea a nivel fuente en AMBOS archivos publicados.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const root = path.resolve(__dirname, "..");
const files = {
  "index.html": fs.readFileSync(path.join(root, "index.html"), "utf8"),
  "oriana-mobile.html": fs.readFileSync(path.join(root, "oriana-mobile.html"), "utf8"),
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

let PASS = 0, FAIL = 0;
function check(name, cond) {
  if (cond) { PASS++; console.log("  ✅ " + name); }
  else { FAIL++; console.log("  ❌ " + name); }
}

// Monta index.html en JSDOM con un user-agent dado; devuelve {window, errors}.
// opts.noSpeech = simula un navegador sin SpeechRecognition (ej. Firefox).
function mount(userAgent, opts = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => { if (!/Could not parse CSS|Not implemented/.test(String(e && e.message))) errors.push(e); });
  const dom = new JSDOM(files["index.html"], {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: "https://demo.test/",
    beforeParse(window) {
      // La opción `userAgent` de JSDOM no aplica en esta versión → forzarlo.
      Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
      window.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
      window.SpeechSynthesisUtterance = function () {};
      if (!opts.noSpeech) {
        const Rec = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
        window.SpeechRecognition = Rec;
        window.webkitSpeechRecognition = Rec;
      }
      window.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
      window.fetch = () => Promise.reject(new Error("sin red en test"));
      window.scrollTo = () => {};
      window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
      window.URL.createObjectURL = () => "blob:stub";
    }
  });
  return { window: dom.window, errors };
}

// User-agents reales representativos.
const UA = {
  whatsapp:   "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.6.78",
  instagram:  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 331.0.0.37.90",
  facebook:   "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/450.0.0.0]",
  androidwv:  "Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  chromeAnd:  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  firefox:    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
  safariIOS:  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  chromeIOS:  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.0.0 Mobile/15E148 Safari/604.1",
};

(async () => {
  console.log("── fase3-compat :: isWebView() por user-agent (ítem 8)");
  // Un solo mount por UA; reusamos window.isWebView (lee navigator.userAgent).
  const cases = [
    ["WhatsApp",       UA.whatsapp,  true],
    ["Instagram",      UA.instagram, true],
    ["Facebook (FBAN)",UA.facebook,  true],
    ["Android wv",     UA.androidwv, true],
    ["Chrome Android", UA.chromeAnd, false],
    ["Firefox",        UA.firefox,   false],
    ["Safari iOS",     UA.safariIOS, false],
    ["Chrome iOS",     UA.chromeIOS, false],
  ];
  let firstErr = null;
  for (const [nombre, ua, esperado] of cases) {
    const { window, errors } = mount(ua);
    if (errors.length && !firstErr) firstErr = errors[0];
    const got = typeof window.isWebView === "function" ? window.isWebView() : "(sin isWebView)";
    check(`isWebView(${nombre}) === ${esperado}`, got === esperado);
    window.close();
  }
  if (firstErr) { console.log("     JS error al cargar: " + (firstErr.message || firstErr)); }

  console.log("── fase3-compat :: modal WebView (renderMicPanel) (ítem 8)");
  const { window: w } = mount(UA.whatsapp);
  w.renderMicPanel("webview");
  const lead = w.document.getElementById("micLead").textContent;
  const steps = w.document.getElementById("micSteps").innerHTML;
  const act = w.document.getElementById("micActivate");
  check("el lead nombra Safari y Chrome", /Safari/.test(lead) && /Chrome/.test(lead));
  check("los pasos explican abrir en el navegador", /Abrir en el navegador/i.test(steps));
  check("el botón 'Activar micrófono' queda oculto (no se pide permiso)", act.style.display === "none");
  w.close();

  console.log("── fase3-compat :: Firefox honesto — tocar el micro NO auto-envía (ítem 9, behavioral)");
  {
    // Navegador sin SpeechRecognition (Firefox) y UA normal (no WebView): tocar 🎙️
    // debe avisar por placeholder y NO mandar ningún mensaje (antes: simulaba y auto-enviaba).
    const { window: fx, errors } = mount(UA.firefox, { noSpeech: true });
    if (errors.length) console.log("     JS error: " + (errors[0].message || errors[0]));
    const doc = fx.document;
    const micBtn = doc.getElementById("micBtn");
    const inputEl = doc.getElementById("input");
    const before = doc.querySelectorAll("#chatlog .msg.user").length;
    check("carga sin SpeechRecognition y existe el botón de micro", !!micBtn && errors.length === 0);
    micBtn.click();   // la rama !rec de btn.onclick es síncrona (no hay await antes del return)
    await sleep(50);  // por si algún handler async del click alcanza a correr
    const after = doc.querySelectorAll("#chatlog .msg.user").length;
    // MSG_SIN_DICTADO es un `const` top-level → no queda en window en un script clásico;
    // se verifica por el texto observable del placeholder.
    check("el placeholder muestra el aviso honesto ('no soporta dictado')", /no soporta dictado/i.test(inputEl.placeholder));
    check("NO se envió ningún mensaje automático al tocar el micro", after === before);
    fx.close();
  }

  console.log("── fase3-compat :: Firefox honesto, sin dictado simulado (ítem 9)");
  for (const [name, html] of Object.entries(files)) {
    check(`${name}: no queda el placeholder 'simulando' del dictado falso`, !/simulando/.test(html));
    check(`${name}: no queda el auto-envío demo del fallback (replyWithVoice=true;onFinal(demo`, !/onFinal\(demo/.test(html)),
    check(`${name}: define isWebView()`, /function isWebView\(/.test(html));
    check(`${name}: define el aviso honesto MSG_SIN_DICTADO`, /MSG_SIN_DICTADO/.test(html));
  }

  console.log("");
  console.log(`fase3-compat: ${PASS} ✅  ${FAIL} ❌`);
  process.exit(FAIL === 0 ? 0 : 1);
})();
