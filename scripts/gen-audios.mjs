#!/usr/bin/env node
/* scripts/gen-audios.mjs — genera los audios FIJOS del acompañamiento (FASE 5 ítem 18).
 *
 * Para cada frase fija: aplica speakable() (idéntico al runtime), calcula audioKey() (hash),
 * pide el MP3 al /api/tts DEL DEPLOY (misma voz/modelo/settings que el TTS en vivo → suena
 * igual, y NO hace falta la key de ElevenLabs) y lo guarda en assets/audio/<hash>.mp3.
 * Al final escribe assets/audio/manifest.json con la lista de hashes disponibles.
 *
 * Reusa speakable/audioKey/ninosKB/kbSpoken cargando index.html con jsdom (una sola fuente
 * de verdad; los 5 KB salen de ninosKB, las 9 de flujo de scripts/audios-fijos.json).
 *
 * Uso:  node scripts/gen-audios.mjs [https://tu-sitio.netlify.app]
 *       (default: el deploy de la demo). Cuesta ~14 llamadas a TTS (unos centavos).
 */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const BASE = (process.argv[2] || "https://incomparable-puffpuff-76e538.netlify.app").replace(/\/$/, "");
const OUT = resolve(root, "assets/audio");

// Cargar index.html en jsdom para reusar speakable()/audioKey()/ninosKB/kbSpoken().
const html = readFileSync(resolve(root, "index.html"), "utf8");
const vc = new VirtualConsole();
vc.on("jsdomError", () => {});
const dom = new JSDOM(html, {
  runScripts: "dangerously", virtualConsole: vc, url: "https://demo.test/",
  beforeParse(w) {
    w.speechSynthesis = { getVoices: () => [], speak() {}, cancel() {}, addEventListener() {} };
    w.SpeechSynthesisUtterance = function () {};
    const R = function () { this.start = () => {}; this.stop = () => {}; this.abort = () => {}; };
    w.SpeechRecognition = R; w.webkitSpeechRecognition = R;
    w.Audio = function () { return { play() {}, pause() {}, addEventListener() {} }; };
    w.fetch = () => Promise.reject(new Error("sin red (jsdom)"));   // el fetch REAL de TTS usa el global de node
    w.scrollTo = () => {};
    w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
    w.URL.createObjectURL = () => "blob:stub";
  }
});
const w = dom.window;
// speakable/audioKey/kbSpoken son `function` → van a window; ninosKB es `const` top-level →
// NO va a window (ver docs/lessons.md), se lee con eval (que sí ve el entorno léxico).
const { speakable, audioKey, kbSpoken } = w;
const ninosKB = w.eval("typeof ninosKB!=='undefined' ? ninosKB : null");
if (![speakable, audioKey, kbSpoken, ninosKB].every(Boolean)) {
  console.error("❌ No pude leer speakable/audioKey/kbSpoken/ninosKB de index.html"); process.exit(1);
}

// 9 frases de flujo (JSON canónico) + 5 derivadas de ninosKB (misma función que el runtime).
const { flow } = JSON.parse(readFileSync(resolve(root, "scripts/audios-fijos.json"), "utf8"));
const kb = Array.from(ninosKB).map(kbSpoken);
const phrases = [...flow, ...kb];

mkdirSync(OUT, { recursive: true });
console.log(`Generando ${phrases.length} audios fijos vía ${BASE}/api/tts …\n`);
const manifest = [];
for (const p of phrases) {
  const clean = speakable(p).slice(0, 600);   // EXACTAMENTE lo que hace speak()
  const key = audioKey(clean);
  const res = await fetch(`${BASE}/api/tts`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean, stability: 0.35, style: 0.05 })   // mismos settings que EL.stab/EL.style
  });
  const ctype = res.headers.get("content-type") || "";
  if (!res.ok || !/audio\/mpeg/.test(ctype)) {
    console.error(`❌ TTS falló (${res.status} ${ctype}) para: ${p.slice(0, 50)}…`); process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(resolve(OUT, `${key}.mp3`), buf);
  if (!manifest.includes(key)) manifest.push(key);
  console.log(`  ✅ ${key}.mp3  (${(buf.length / 1024).toFixed(1)} KB)  ← ${p.slice(0, 45)}…`);
}
writeFileSync(resolve(OUT, "manifest.json"), JSON.stringify(manifest) + "\n");
console.log(`\n🟢 ${manifest.length} audios en assets/audio/ + manifest.json. Commitealos y deployá.`);
dom.window.close();
