#!/usr/bin/env bash
# verify.sh — gate mecánico del harness. Exit 0 = verde, !=0 = rojo.
# Uso: scripts/verify.sh [quick|fix|full]   (default: quick)
#
# Niveles:
#   quick → lint + checks custom baratos. Para Ajustes y como gate del hook Stop.
#   fix   → quick + suite de tests. Para bugfixes (el sabotage check se corre
#           aparte: scripts/sabotage_check.sh).
#   full  → fix + build. Para cerrar Features.
#
# ── CONFIGURACIÓN POR PROYECTO ──────────────────────────────────────────────
LINT_CMD="bash scripts/syntax_check.sh"   # node --check + JS inline + py_compile + invariante HTML
TEST_CMD="node test/reclamos.test.js && node test/tabbar.test.js && node test/eventos-fotos.test.js && node test/speakable.test.js && node test/estabilidad-fase1.test.js && node test/estabilidad-fase2.test.js && node test/estabilidad-fase3.test.js && node test/estabilidad-fase4.test.js && node test/estabilidad-fase5.test.js && node test/dictado-doble-envio.test.js && node test/ratelimit.test.js && node test/telemetria-log.test.js && node test/reintento-chat.test.js"  # tests jsdom + serverless (requiere: npm install)
BUILD_CMD=""                              # sin paso de build (sitio estático)
SRC_DIRS="index.html oriana-mobile.html oriana-demo.html api netlify oriana-proxy.py"

# Checks custom baratos (greps de convenciones). Devuelven 0 si está OK.
custom_quick_checks() {
  # Ejemplo Flutter — cero hardcodes visuales en widgets modificados (borrar si no aplica):
  # local modified
  # modified=$(git diff --name-only HEAD -- 'lib/view' 'lib/widgets' | grep '\.dart$' || true)
  # [ -z "$modified" ] && return 0
  # ! grep -nE 'Color\(0x|Colors\.|FontWeight\.w[0-9]+|fontSize: [0-9]' $modified
  return 0
}
# ────────────────────────────────────────────────────────────────────────────

set -u
LEVEL="${1:-quick}"
FAILED=0

run_step() {
  local name="$1"; shift
  echo "── verify[$LEVEL] :: $name"
  if "$@"; then
    echo "   ✅ $name"
  else
    echo "   ❌ $name FALLÓ"
    FAILED=1
  fi
}

run_cmd_step() {
  local name="$1" cmd="$2"
  [ -z "$cmd" ] || [[ "$cmd" == "{{"* ]] && { echo "── verify :: $name (sin configurar, SKIP)"; return; }
  run_step "$name" bash -c "$cmd"
}

case "$LEVEL" in
  quick)
    run_cmd_step "lint" "$LINT_CMD"
    run_step "custom checks" custom_quick_checks
    ;;
  fix)
    run_cmd_step "lint" "$LINT_CMD"
    run_step "custom checks" custom_quick_checks
    run_cmd_step "tests" "$TEST_CMD"
    ;;
  full)
    run_cmd_step "lint" "$LINT_CMD"
    run_step "custom checks" custom_quick_checks
    run_cmd_step "tests" "$TEST_CMD"
    run_cmd_step "build" "$BUILD_CMD"
    ;;
  *)
    echo "Nivel desconocido: $LEVEL (usar quick|fix|full)" >&2
    exit 64
    ;;
esac

if [ "$FAILED" -ne 0 ]; then
  echo ""
  echo "🔴 verify[$LEVEL] EN ROJO — el trabajo NO está terminado."
  exit 1
fi

# Marca de éxito para el hook Stop (ver .claude/hooks/stop_verify.sh).
# Vive dentro de .git/ → local por máquina, nunca viaja por git (multi-dev safe).
# Hash del CONTENIDO de los fuentes (helper compartido) → editar de nuevo un
# archivo ya sucio tras el verify invalida la marca.
GITDIR=$(git rev-parse --git-dir 2>/dev/null)
if [ -n "$GITDIR" ]; then
  TOP=$(git rev-parse --show-toplevel 2>/dev/null)
  # shellcheck source=/dev/null
  [ -f "$TOP/scripts/_harness_srchash.sh" ] && . "$TOP/scripts/_harness_srchash.sh"
  if command -v harness_src_hash >/dev/null 2>&1; then
    harness_src_hash > "$GITDIR/harness_verify_ok"
  else
    git status --porcelain -- $SRC_DIRS 2>/dev/null | sha1sum | cut -d' ' -f1 > "$GITDIR/harness_verify_ok"
  fi
fi
echo ""
echo "🟢 verify[$LEVEL] verde."
exit 0
