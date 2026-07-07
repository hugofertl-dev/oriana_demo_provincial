/* test/ratelimit.test.js — FASE 1 del PLAN_PRODUCCION (blindaje de APIs).
 * Prueba el helper de rate-limit por IP (Upstash Redis vía REST) con un fetch
 * MOCKEADO — sin red real. Cubre: bajo el límite pasa, sobre el límite bloquea,
 * borde exacto, fail-open (sin config / timeout / respuesta no-ok), y extracción
 * de IP detrás de Netlify.
 * Uso: node test/ratelimit.test.js   (exit 0 = verde)
 */
const assert = require("assert");
const { checkRateLimit, clientIp } = require("../netlify/functions/_ratelimit");

let PASS = 0, FAIL = 0;
function check(name, fn) {
  Promise.resolve().then(fn).then(
    () => { PASS++; console.log("  ✅ " + name); },
    (e) => { FAIL++; console.log("  ❌ " + name + " — " + (e && e.message)); }
  );
}

// fetch falso que devuelve un pipeline Upstash [{result:count},{result:0|1}]
function fakeFetch(count, { ok = true, status = 200 } = {}) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return {
      ok, status,
      json: async () => [{ result: count }, { result: 1 }]
    };
  };
  f.calls = calls;
  return f;
}
const ev = (headers) => ({ headers });
const NF = ev({ "x-nf-client-connection-ip": "1.2.3.4" });
const CFG = { url: "https://x.upstash.io", token: "tok" };

(async () => {
  // 1. Bajo el límite → allowed, remaining correcto
  await check("bajo el límite pasa (count 5, limit 20 → allowed, remaining 15)", async () => {
    const r = await checkRateLimit(NF, "chat", 20, 60, { ...CFG, fetch: fakeFetch(5) });
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(r.remaining, 15);
  });

  // 2. En el borde exacto (count == limit) todavía pasa
  await check("borde: count==limit pasa (count 20, limit 20 → allowed)", async () => {
    const r = await checkRateLimit(NF, "chat", 20, 60, { ...CFG, fetch: fakeFetch(20) });
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(r.remaining, 0);
  });

  // 3. Sobre el límite → bloquea con retryAfter
  await check("sobre el límite bloquea (count 21, limit 20 → !allowed, retryAfter 60)", async () => {
    const r = await checkRateLimit(NF, "chat", 20, 60, { ...CFG, fetch: fakeFetch(21) });
    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.retryAfter, 60);
  });

  // 4. tts con su propio límite (40)
  await check("tts límite 40: count 41 bloquea", async () => {
    const r = await checkRateLimit(NF, "tts", 40, 60, { ...CFG, fetch: fakeFetch(41) });
    assert.strictEqual(r.allowed, false);
  });

  // 5. Sin config (env vars ausentes) → fail-open y NO llama a fetch
  await check("sin config → fail-open, no toca fetch", async () => {
    const spy = fakeFetch(999);
    const r = await checkRateLimit(NF, "chat", 20, 60, { url: undefined, token: undefined, fetch: spy });
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(spy.calls.length, 0, "no debió llamar a Upstash sin config");
  });

  // 6. fetch tira (timeout/red) → fail-open
  await check("fetch rechaza (timeout) → fail-open", async () => {
    const boom = async () => { throw new Error("timeout"); };
    const r = await checkRateLimit(NF, "chat", 20, 60, { ...CFG, fetch: boom });
    assert.strictEqual(r.allowed, true);
  });

  // 7. respuesta no-ok (500 de Upstash) → fail-open
  await check("Upstash responde 500 → fail-open", async () => {
    const r = await checkRateLimit(NF, "chat", 20, 60, { ...CFG, fetch: fakeFetch(1, { ok: false, status: 500 }) });
    assert.strictEqual(r.allowed, true);
  });

  // 8. result no numérico → fail-open (defensa contra shape inesperado)
  await check("result no numérico → fail-open", async () => {
    const weird = async () => ({ ok: true, status: 200, json: async () => [{ error: "x" }] });
    const r = await checkRateLimit(NF, "chat", 20, 60, { ...CFG, fetch: weird });
    assert.strictEqual(r.allowed, true);
  });

  // 9. clientIp: prioriza x-nf-client-connection-ip
  await check("clientIp usa x-nf-client-connection-ip", async () => {
    assert.strictEqual(clientIp(ev({ "x-nf-client-connection-ip": "9.9.9.9" })), "9.9.9.9");
  });

  // 10. clientIp: fallback al primer hop de x-forwarded-for
  await check("clientIp cae al primer hop de x-forwarded-for", async () => {
    assert.strictEqual(clientIp(ev({ "x-forwarded-for": "8.8.8.8, 10.0.0.1" })), "8.8.8.8");
  });

  // 10b. clientIp: topa la IP a 45 chars (IPv6 máx) ante un header inflado
  await check("clientIp topa la IP a 45 chars", async () => {
    const huge = "a".repeat(500);
    assert.strictEqual(clientIp(ev({ "x-nf-client-connection-ip": huge })).length, 45);
    assert.strictEqual(clientIp(ev({ "x-forwarded-for": huge + ", 10.0.0.1" })).length, 45);
  });

  // 11. la clave por IP separa endpoints (dos IPs distintas no comparten cupo)
  await check("clave incluye endpoint+IP (llama a /pipeline con INCR de la clave correcta)", async () => {
    const spy = fakeFetch(1);
    await checkRateLimit(ev({ "x-nf-client-connection-ip": "5.5.5.5" }), "chat", 20, 60, { ...CFG, fetch: spy });
    assert.strictEqual(spy.calls.length, 1);
    assert.ok(/\/pipeline$/.test(spy.calls[0].url), "debe pegarle al endpoint /pipeline");
    const sent = JSON.stringify(spy.calls[0].opts.body);
    assert.ok(sent.includes("rl:chat:5.5.5.5"), "la clave debe ser rl:<endpoint>:<ip>");
  });

  // esperar a que resuelvan los checks async encolados
  await new Promise(r => setTimeout(r, 50));
  console.log(`\n  ${PASS} verdes, ${FAIL} rojos`);
  process.exit(FAIL ? 1 : 0);
})();
