/* ══════════════════════════════════════════════════════════════════
   Función serverless de Vercel — Texto a voz (ElevenLabs)
   El frontend llama a /api/tts y Vercel enruta este archivo automáticamente.
   La API key vive SOLO acá, del lado del servidor: nunca llega al navegador.

   Variables de entorno requeridas:
     ELEVENLABS_API_KEY   (sk_...)
     ELEVENLABS_VOICE_ID  (id de la voz argentina)
   ══════════════════════════════════════════════════════════════════ */

const EL_MODEL = "eleven_multilingual_v2";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") { setCors(res); return res.status(204).end(); }
  if (req.method !== "POST") { setCors(res); return res.status(405).json({ error: "Método no permitido" }); }

  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voice) {
    setCors(res);
    return res.status(500).json({ error: "Faltan ELEVENLABS_API_KEY o ELEVENLABS_VOICE_ID en el entorno" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const text = String(body.text || "").slice(0, 800).trim();
  if (!text) { setCors(res); return res.status(400).json({ error: "Falta el campo 'text'" }); }

  const stability = num(body.stability, 0.6);
  const style = num(body.style, 0.15);

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: EL_MODEL,
        voice_settings: { stability, similarity_boost: 0.75, style, use_speaker_boost: true }
      })
    });
    if (!r.ok) {
      const detail = await r.text();
      setCors(res);
      return res.status(r.status).json({ error: "ElevenLabs " + r.status, detail: detail.slice(0, 300) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    setCors(res);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (e) {
    setCors(res);
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}
function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }
function num(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
