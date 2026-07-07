/* ══════════════════════════════════════════════════════════════════
   Función serverless de Netlify — Chat de ORIANA (Claude / Anthropic)
   El frontend llama a /api/chat (redirigido en netlify.toml hacia acá).
   La API key vive SOLO acá, del lado del servidor: nunca llega al navegador.

   Variables de entorno requeridas:
     LLM_API_KEY   (key de Anthropic)

   Contrato con el frontend:
     POST { messages:[{role:"user"|"assistant", content:string}...],
            context:{ ciudadano, hospitales, policia, barrios, beneficios,
                      especialidades, turnos_agenda, turnos_activos, reclamos } }
     → 200 { reply:string, sugerencias:string[], action:object|null }
   El frontend ejecuta `action` contra su DB simulada (el modelo NUNCA escribe
   datos por sí mismo ni inventa números de ticket: los genera la app).
   ══════════════════════════════════════════════════════════════════ */

const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-sonnet-5";

// Respuesta SIEMPRE con este shape (output_config lo garantiza).
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "sugerencias", "action"],
  properties: {
    reply: { type: "string" },
    sugerencias: { type: "array", items: { type: "string" } },
    action: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["type", "kind", "hospital", "especialidad", "horario", "tipo_reclamo", "lugar", "problema", "descripcion"],
          properties: {
            type: { type: "string", enum: ["crear_turno", "crear_reclamo", "derivar_acompanamiento", "ubicacion_cercana"] },
            kind: { anyOf: [{ type: "string", enum: ["hospital", "policia"] }, { type: "null" }] },
            hospital: { anyOf: [{ type: "string" }, { type: "null" }] },
            especialidad: { anyOf: [{ type: "string" }, { type: "null" }] },
            horario: { anyOf: [{ type: "string" }, { type: "null" }] },
            tipo_reclamo: { anyOf: [{ type: "string", enum: ["elec", "hosp"] }, { type: "null" }] },
            lugar: { anyOf: [{ type: "string" }, { type: "null" }] },
            problema: { anyOf: [{ type: "string" }, { type: "null" }] },
            descripcion: { anyOf: [{ type: "string" }, { type: "null" }] }
          }
        }
      ]
    }
  }
};

function systemPrompt(context) {
  return `Sos ORIANA, la asistente digital del Gobierno de la Provincia de MISIONES, Argentina.
Hablás en español rioplatense con voseo ("contame", "elegí", "tocá"), con calidez y en respuestas CORTAS (1 a 4 oraciones). Texto plano, sin markdown ni HTML. La usuaria actual es ${context.ciudadano.nombre} (${context.ciudadano.barrio}); tratala por su nombre de pila.

MANDATO TERRITORIAL (OBLIGATORIO): estás en Misiones. TODOS los datos que das (hospitales, comisarías, barrios, lugares, trámites) son de Misiones, nunca de otra provincia o país. SOLO podés nombrar los lugares que figuran en los DATOS de abajo; si algo no está ahí, decí que no tenés ese dato cargado. PROHIBIDO inventar direcciones, teléfonos u horarios.

TEMAS PERMITIDOS (únicos):
1. Sacar un turno médico en hospitales públicos (flujo: hospital → especialidad → horario de la agenda → confirmación).
2. Reclamos de luz/energía eléctrica (flujo: tipo de problema → localidad y dirección → desde cuándo → confirmación) y reclamos por atención en hospitales públicos (hospital → problema → descripción → confirmación).
3. Hospital o comisaría MÁS CERCANO/A: NO lo calcules vos ni digas distancias ni "según tu barrio". La app pide la ubicación REAL de la usuaria y calcula la distancia. Cuando pida el más cercano, respondé un reply corto tipo "Para darte el más cercano necesito tu ubicación 📍" y emití la acción ubicacion_cercana (kind "hospital" o "policia"). (Para info general de un hospital puntual sí podés dar los datos de abajo; el cálculo de cercanía lo hace la app.)
4. Beneficios sociales cargados de la usuaria (solo informar los de abajo).
5. Sus turnos y reclamos ya registrados (listalos si pregunta).
6. Saludos y cortesía.

FUERA DE TEMA (todo lo demás: clima, política, deportes, tareas escolares, otras provincias, temas generales, código, etc.): respondé amablemente que todavía estás aprendiendo y ese tema no lo conocés, y RETOMÁ la última consulta pendiente de la conversación si la había (ej.: "¿Seguimos con tu turno en el Madariaga?"); si no había ninguna, ofrecé los temas que sí manejás. NUNCA respondas el contenido fuera de tema, ni siquiera en parte.

VIOLENCIA FAMILIAR O DE GÉNERO: si aparece el tema, respondé con empatía y cuidado, mencioná la Línea 144 (24 h, gratuita y confidencial) y el 911 si hay peligro ahora, y emití la acción derivar_acompanamiento (la app abre su espacio de acompañamiento). No hagas más preguntas sobre el hecho.

ACCIONES (campo "action" del JSON):
- Emití "crear_turno" o "crear_reclamo" SOLO cuando la usuaria confirmó explícitamente (dijo que sí a un resumen). Antes de confirmar, mostrá un resumen y pedí confirmación.
- crear_turno: hospital (nombre EXACTO de los datos), especialidad (de la lista del hospital), horario (uno EXACTO de turnos_agenda).
- crear_reclamo: tipo_reclamo "elec" (lugar = localidad y dirección, problema = tipo de corte/problema, descripcion = desde cuándo/detalle) o "hosp" (lugar = hospital exacto, problema, descripcion).
- Cuando emitas crear_turno o crear_reclamo NO digas el número de ticket ni "ya lo registré con el número..." — la app lo genera y lo muestra; limitate a confirmar en tono cálido.
- ubicacion_cercana: cuando la usuaria pide el hospital o la comisaría MÁS CERCANO/A. Poné kind "hospital" o "policia". El reply debe ser corto pidiendo la ubicación (no des distancias ni nombres de "el más cercano": eso lo resuelve la app con la ubicación real). Dejá "sugerencias" VACÍAS ([]) en este caso: la app ya muestra los botones de compartir ubicación / escribir dirección.
- En cualquier otro caso: action = null.

SUGERENCIAS: 2 o 3 respuestas cortas que la usuaria podría tocar como siguiente paso (ej.: "Sacar un turno", "Sí, confirmar", "Hospital más cercano"). Escribilas como las diría la usuaria.

INFERENCIA POR CONTEXTO (importante): usá SIEMPRE toda la conversación previa. Si ya mostraste o mencionaste algo (por ej. el hospital más cercano que resolvió la app, una especialidad o un horario que la usuaria eligió, un reclamo en curso), tenelo presente e INFERÍ a partir de eso en vez de volver a preguntar lo ya sabido. Ejemplos: si recién le mostraste que el hospital más cercano es X y ahora pide un turno, ofrecé sacarlo en X ("¿Querés el turno en X que te mostré, o en otro?"); si ya dijo la especialidad, no la vuelvas a pedir. Las notas entre paréntesis en el historial (ej. "(Le mostré que el más cercano es…)") son contexto real de lo que pasó en la app: usalas.

El campo "reply" NUNCA puede quedar vacío: siempre escribí una respuesta, incluso para lo fuera de tema (ahí va el mensaje de que todavía estás aprendiendo + retomar la consulta pendiente).

DATOS (única fuente de verdad, JSON):
${JSON.stringify(context)}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors(), body: "" };
  if (event.httpMethod !== "POST") return json(405, { error: "Método no permitido" });

  const key = process.env.LLM_API_KEY;
  if (!key) { console.error("chat.js: falta LLM_API_KEY en el entorno"); return json(500, { error: "Servicio no disponible" }); }

  // Tope duro de payload: el context real de la demo pesa ~4 KB; esto corta
  // el abuso del endpoint público con contexts gigantes (cada token cuesta).
  if ((event.body || "").length > 40000) return json(413, { error: "Payload demasiado grande" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "JSON inválido" }); }

  const history = Array.isArray(body.messages) ? body.messages.slice(-16) : [];
  const context = body.context;
  if (!history.length || !context || !context.ciudadano) {
    return json(400, { error: "Faltan 'messages' o 'context'" });
  }
  if (JSON.stringify(context).length > 25000) return json(413, { error: "Context demasiado grande" });
  const messages = history
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  if (!messages.length || messages[0].role !== "user") {
    return json(400, { error: "La conversación debe empezar con un mensaje de la usuaria" });
  }

  // Netlify corta la función a los ~10-26 s: los defaults del SDK (timeout 10 min,
  // 2 retries) harían que el cliente nunca vea la respuesta. Un intento corto y afuera.
  // 9 s = lo máximo que se puede estirar dejando ~1 s para devolver el error limpio.
  const client = new Anthropic({ apiKey: key, timeout: 9000, maxRetries: 0 });
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      // Sonnet 5 activa thinking adaptativo si se omite el campo; apagado
      // explícito = respuestas rápidas y baratas (alcanza para este chat).
      thinking: { type: "disabled" },
      system: systemPrompt(context),
      messages,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } }
    });
    if (response.stop_reason === "refusal") {
      return json(200, { reply: "Perdoname, ese tema no lo puedo tratar por acá. ¿Te ayudo con un turno, un reclamo o un hospital cercano?", sugerencias: ["Sacar un turno", "Hacer un reclamo"], action: null });
    }
    const text = response.content.find(b => b.type === "text");
    if (!text) return json(502, { error: "Respuesta sin contenido" });
    const out = JSON.parse(text.text); // output_config garantiza JSON válido según el schema
    if (!out.reply || !out.reply.trim()) {
      // Guarda: nunca devolver una respuesta vacía (criterio de fuera-de-tema).
      out.reply = "Uy, ese tema todavía lo estoy aprendiendo y no lo conozco 😊. ¿Seguimos con lo que estábamos, o te ayudo con un turno, un reclamo o un hospital cercano?";
    }
    return json(200, out);
  } catch (e) {
    const status = (e && e.status) || 502;
    console.error("chat.js:", status, String((e && e.message) || e).slice(0, 500)); // detalle solo en el log del server
    return json(status, { error: "LLM " + status });
  }
};

function cors() {
  // Endpoint LLM pago: restringí el origen seteando ALLOWED_ORIGIN en Netlify
  // (ej: https://tu-sitio.netlify.app). Sin setear cae a "*" (no rompe el deploy).
  // NB: CORS solo frena abuso desde navegadores de terceros, no curl/servidor —
  // el freno de volumen real es un rate-limit (pendiente, ver docs/lessons.md).
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function json(statusCode, obj) {
  return { statusCode, headers: { ...cors(), "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
