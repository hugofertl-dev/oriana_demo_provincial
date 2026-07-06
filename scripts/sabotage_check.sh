#!/usr/bin/env bash
# sabotage_check.sh — antídoto contra tests decorativos (reward hacking).
#
# Idea: si el test nuevo sigue pasando SIN el fix, el test no prueba nada.
# Uso: scripts/sabotage_check.sh <comando_de_test> <archivo_fix_1> [archivo_fix_2 ...]
# Ej:  scripts/sabotage_check.sh "flutter test test/foo_test.dart" lib/bloc/foo_bloc.dart
#
# Flujo: stash SOLO de los archivos del fix → correr el test (DEBE fallar) →
# restaurar. Si algo sale mal en el stash, aborta sin tocar nada.
#
# ⚠️ Requiere working tree sin cambios sin guardar en OTROS archivos críticos.
#    Correr idealmente justo después de terminar el fix.

set -euo pipefail

[ $# -ge 2 ] || { echo "Uso: $0 <test_cmd> <archivo_fix...>" >&2; exit 64; }

TEST_CMD="$1"; shift
FIX_FILES=("$@")

for f in "${FIX_FILES[@]}"; do
  [ -f "$f" ] || { echo "❌ No existe: $f" >&2; exit 66; }
done

echo "── sabotage :: guardando el fix temporalmente (${FIX_FILES[*]})"
git stash push --quiet -- "${FIX_FILES[@]}" || {
  echo "❌ No se pudo stashear el fix (¿archivos sin cambios respecto a HEAD?)." >&2
  echo "   Si el fix ya está commiteado, usá: git revert --no-commit <hash> y re-corré." >&2
  exit 65
}

restore() { git stash pop --quiet || echo "⚠️ RESTAURAR A MANO: git stash pop" >&2; }
trap restore EXIT

echo "── sabotage :: corriendo test SIN el fix (debe FALLAR)"
if bash -c "$TEST_CMD" >/dev/null 2>&1; then
  echo ""
  echo "🔴 SABOTAGE CHECK FALLÓ: el test PASA sin el fix."
  echo "   El test es decorativo — no prueba el comportamiento arreglado."
  echo "   Reescribir el test para que dependa del fix real."
  exit 1
fi

echo ""
echo "🟢 Sabotage check OK: el test falla sin el fix y pasa con él. Test real."
exit 0
