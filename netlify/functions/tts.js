/* ══════════════════════════════════════════════════════════════════
   Función serverless de Netlify — Texto a voz (ElevenLabs)
   El frontend llama a /api/tts (redirigido en netlify.toml hacia acá).
   La API key vive SOLO acá, del lado del servidor: nunca llega al navegador.

   Variables de entorno requeridas:
     ELEVENLABS_API_KEY   (sk_...)
     ELEVENLABS_VOICE_ID  (id de la voz argentina)
   ══════════════════════════════════════════════════════════════════ */

const EL_MODEL = "eleven_multilingual_v2";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido" });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) {
    return json(500, { error: "Faltan ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID en el entorno" });
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "JSON inválido" }); }

  const text = String(body.text || "").slice(0, 800).trim();
  if (!text) return json(400, { error: "Falta el campo 'text'" });

  const stability = num(body.stability, 0.6);
  const style = num(body.style, 0.15);

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: EL_MODEL,
        voice_settings: { stability, similarity_boost: 0.50, style, use_speaker_boost: true }
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      return json(r.status, { error: "ElevenLabs " + r.status, detail: detail.slice(0, 300) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return {
      statusCode: 200,
      headers: { ...cors(), "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
      body: buf.toString("base64"),
      isBase64Encoded: true
    };
  } catch (e) {
    return json(502, { error: String((e && e.message) || e) });
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function json(statusCode, obj) {
  return { statusCode, headers: { ...cors(), "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
