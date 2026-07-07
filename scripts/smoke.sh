#!/usr/bin/env bash
# smoke.sh — verificación post-deploy de la demo ORIANA (ítem 7 del PLAN_PRODUCCION).
# Corré esto a mano tras cada push (o engancharlo a las deploy notifications de Netlify)
# para cazar un deploy roto o una env var faltante ANTES de descubrirlo en el celular.
#
# Uso: scripts/smoke.sh <url> [--light]
#   (default)  chequeo COMPLETO: home + POST real a /api/chat y /api/tts.
#              Cuesta ~1 request a Claude + 1 a ElevenLabs por corrida (centavos),
#              pero detecta LLM_API_KEY / ELEVENLABS_* faltantes (solo salen en un POST real).
#   --light    SIN llamadas pagas: home + OPTIONS de routing (gratis y rápido).
#
# Exit 0 = todo verde.  Ej: scripts/smoke.sh https://incomparable-puffpuff-76e538.netlify.app

set -u
URL="${1:-}"
[ -n "$URL" ] || { echo "Uso: $0 <url> [--light]" >&2; exit 64; }
[ "${2:-}" = "--light" ] && MODE="light" || MODE="full"
URL="${URL%/}"   # sin barra final: el origen no la lleva

FAIL=0
ok(){ echo "   ✅ $1"; }
bad(){ echo "   ❌ $1"; FAIL=1; }

echo "── smoke[$MODE] :: $URL"
[ "$MODE" = "full" ] && echo "   (modo completo: 1 request a Claude + 1 a ElevenLabs — cuesta centavos; usá --light para evitarlo)"

# ── 1. Home: 200 y contiene "ORIANA" ────────────────────────────────────────
tmp="$(mktemp)"
code=$(curl -sS -L -o "$tmp" -w "%{http_code}" --max-time 20 "$URL/" 2>/dev/null || echo "000")
if [ "$code" = "200" ] && grep -qi "ORIANA" "$tmp"; then ok "home 200 y contiene 'ORIANA'"
else bad "home falló (HTTP $code o sin 'ORIANA' en el body)"; fi
rm -f "$tmp"

# ── 2. /api/chat ────────────────────────────────────────────────────────────
if [ "$MODE" = "light" ]; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 -X OPTIONS "$URL/api/chat" 2>/dev/null || echo "000")
  [ "$code" = "204" ] && ok "/api/chat OPTIONS 204 (routing vivo)" || bad "/api/chat OPTIONS dio $code (¿redirect mal en netlify.toml?)"
else
  body=$(curl -sS --max-time 25 -X POST "$URL/api/chat" -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"hola"}],"context":{"ciudadano":{"nombre":"Test","barrio":"Centro"}}}' 2>/dev/null || echo "")
  if printf '%s' "$body" | grep -q '"reply"'; then ok "/api/chat responde con {reply} (LLM + LLM_API_KEY OK)"
  else bad "/api/chat sin 'reply' — ¿falta LLM_API_KEY? resp: $(printf '%s' "$body" | head -c 200)"; fi
fi

# ── 3. /api/tts ─────────────────────────────────────────────────────────────
if [ "$MODE" = "light" ]; then
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 -X OPTIONS "$URL/api/tts" 2>/dev/null || echo "000")
  [ "$code" = "204" ] && ok "/api/tts OPTIONS 204 (routing vivo)" || bad "/api/tts OPTIONS dio $code (¿redirect mal en netlify.toml?)"
else
  res=$(curl -sS -o /dev/null -w "%{http_code} %{content_type}" --max-time 25 -X POST "$URL/api/tts" \
    -H "Content-Type: application/json" -d '{"text":"hola"}' 2>/dev/null || echo "000 -")
  case "$res" in
    "200 audio/mpeg"*) ok "/api/tts devuelve audio/mpeg (ElevenLabs + keys OK)";;
    *) bad "/api/tts no devolvió audio — ¿faltan ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID? ($res)";;
  esac
fi

echo ""
if [ "$FAIL" = 0 ]; then echo "🟢 smoke[$MODE] verde."; else echo "🔴 smoke[$MODE] EN ROJO — revisar arriba."; fi
exit $FAIL
