#!/usr/bin/env bash
# stop_verify.sh — gate bloqueante: el agente no puede dar por terminado el
# turno con cambios en src sin verificación verde.
#
# Mecanismo: exit 2 bloquea el Stop y el stderr se le muestra al agente,
# que debe seguir trabajando (correr verify.sh y arreglar lo que falle).
#
# Anti-loop: si stop_hook_active=true (ya estamos en un ciclo de bloqueo y el
# agente volvió a intentar terminar tras correr verify), dejamos pasar si la
# marca .verify_ok coincide con el estado actual del working tree.

# ── CONFIGURACIÓN ───────────────────────────────────────────────────────────
SRC_DIRS="index.html oriana-mobile.html api netlify oriana-proxy.py"  # mismos dirs que en scripts/verify.sh
VERIFY_LEVEL="quick"        # nivel mínimo exigido para poder terminar un turno
# ────────────────────────────────────────────────────────────────────────────

INPUT=$(cat)

# Sin configurar → no molestar
[[ "$SRC_DIRS" == "{{"* ]] && exit 0

# ¿Hay cambios en src?
CHANGES=$(git status --porcelain -- $SRC_DIRS 2>/dev/null)
[ -z "$CHANGES" ] && exit 0

# ¿La última verificación verde corresponde a ESTE estado del código?
# (La marca vive en .git/ — local por máquina, no se comparte entre devs.)
# Mismo hash de CONTENIDO que verify.sh (helper compartido) → detecta ediciones
# de contenido, no solo cambios en la lista de archivos.
TOP=$(git rev-parse --show-toplevel 2>/dev/null)
# shellcheck source=/dev/null
[ -f "$TOP/scripts/_harness_srchash.sh" ] && . "$TOP/scripts/_harness_srchash.sh"
if command -v harness_src_hash >/dev/null 2>&1; then
  CURRENT_HASH=$(harness_src_hash)
else
  CURRENT_HASH=$(echo "$CHANGES" | sha1sum | cut -d' ' -f1)
fi
GITDIR=$(git rev-parse --git-dir 2>/dev/null)
MARK="$GITDIR/harness_verify_ok"
if [ -n "$GITDIR" ] && [ -f "$MARK" ] && [ "$(cat "$MARK")" = "$CURRENT_HASH" ]; then
  exit 0
fi

# Evitar loop infinito: si ya bloqueamos antes en este mismo ciclo,
# igual re-exigimos verify (el hash de arriba es la única salida verde).
echo "🔴 HARNESS GATE: hay cambios en [$SRC_DIRS] sin verificación verde." >&2
echo "Correr ahora: scripts/verify.sh $VERIFY_LEVEL (o el nivel de la tarea: fix/full)." >&2
echo "Si falla, arreglar y repetir. No declarar el trabajo terminado hasta verde." >&2
exit 2
