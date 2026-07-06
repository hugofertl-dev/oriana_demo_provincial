#!/usr/bin/env bash
# session_start.sh — inyecta contexto de arranque en cada sesión nueva.
# El stdout de este hook se agrega al contexto del agente (SessionStart).

# ── CONFIGURACIÓN ───────────────────────────────────────────────────────────
PROTECTED_BRANCHES_REGEX="^(main|master)$"  # ramas donde NO se trabaja directo
# ────────────────────────────────────────────────────────────────────────────

echo "=== HARNESS: contexto de arranque ==="

# 1) Rama actual + alerta de rama protegida
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
  echo "Rama actual: $BRANCH"
  if [[ -n "$PROTECTED_BRANCHES_REGEX" && ! "$PROTECTED_BRANCHES_REGEX" == "{{"* ]] \
     && [[ "$BRANCH" =~ $PROTECTED_BRANCHES_REGEX ]]; then
    echo "⚠️ RAMA PROTEGIDA: antes de modificar código, preguntar al usuario y/o crear rama de trabajo."
  fi
else
  echo "⚠️ HEAD detached o sin rama: confirmar con el usuario dónde trabajar antes de tocar código."
fi

# 2) Handoffs pendientes (uno por feature; multi-dev safe)
HANDOFFS=$(ls progress/current/*.md 2>/dev/null | grep -v '_leeme' || true)
if [ -n "$HANDOFFS" ]; then
  for h in $HANDOFFS; do
    echo ""
    echo "--- $h (handoff de trabajo a medias) ---"
    cat "$h"
    echo "--- fin $h ---"
  done
elif [ -s progress/current.md ]; then
  # compat con instalaciones que usan el archivo único
  echo ""
  echo "--- progress/current.md (handoff de la última sesión) ---"
  cat progress/current.md
  echo "--- fin handoff ---"
else
  echo "(sin handoffs en progress/current/: no hay trabajo a medias registrado)"
fi

# 3) Trabajo vivo (resumen mínimo, no el archivo entero)
if [ -f feature_list.json ] && command -v jq >/dev/null 2>&1; then
  echo ""
  echo "Trabajo vivo (feature_list.json):"
  jq -r '.features[] | select(.status != "done") | "  [\(.status)] \(.id) — \(.titulo // .title)"' feature_list.json 2>/dev/null | head -15
fi

exit 0
