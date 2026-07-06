#!/usr/bin/env bash
# check_install.sh — verificador mecánico de la instalación del harness.
#
# Correr desde la RAÍZ del proyecto destino después de instalar.
# El agente instalador NO puede declarar la instalación terminada con esto en
# rojo: cada ítem omitido aparece como ❌ con instrucción de arreglo.
# (La instalación tampoco depende de la memoria del modelo: este script ES el checklist.)

set -u
FAILED=0

ok()   { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; echo "     → $2"; FAILED=1; }

echo "═══ check_install :: verificación mecánica del harness ═══"

# ── 1. Archivos requeridos ──────────────────────────────────────────────────
echo "── [1/6] Archivos requeridos"
REQUIRED="CLAUDE.md AGENTS.md feature_list.json \
scripts/verify.sh scripts/sabotage_check.sh scripts/check_install.sh \
.claude/settings.json .claude/hooks/session_start.sh .claude/hooks/stop_verify.sh \
.claude/skills/feature-start/SKILL.md .claude/skills/handoff/SKILL.md \
.claude/skills/feature-close/SKILL.md .claude/skills/design-system/SKILL.md \
.claude/agents/reviewer.md \
progress/history.md progress/archive/INDEX.md docs/lessons.md"

for f in $REQUIRED; do
  [ -f "$f" ] && ok "$f" || fail "$f FALTA" "copiarlo desde harness_template/ (ver INSTALL.md paso 1)"
done

# Handoffs: directorio por feature (nuevo) o archivo único (compat)
if [ -d progress/current ] || [ -f progress/current.md ]; then
  ok "progress/current/ (o current.md compat)"
else
  fail "progress/current/ FALTA" "crear el directorio de handoffs (cp -r harness_template/progress/current)"
fi

# ── 2. Cero placeholders sin reemplazar ─────────────────────────────────────
echo "── [2/6] Placeholders {{...}} reemplazados"
# Solo placeholders reales (llaves dobles + NOMBRE_EN_MAYUSCULAS) — los guards de los scripts ([[ "$x" == "{{"* ]]) no cuentan.
LEFT=$(grep -rlnE '\{\{[A-Z_]+\}\}' CLAUDE.md AGENTS.md scripts/ .claude/ 2>/dev/null | grep -v harness_template || true)
if [ -z "$LEFT" ]; then
  ok "cero placeholders pendientes"
else
  fail "quedan placeholders en: $(echo $LEFT | tr '\n' ' ')" "reemplazar cada {{...}} con el valor real del proyecto (BOOTSTRAP paso 2)"
fi

# ── 3. Scripts ejecutables y con sintaxis válida ────────────────────────────
echo "── [3/6] Scripts"
for s in scripts/verify.sh scripts/sabotage_check.sh .claude/hooks/session_start.sh .claude/hooks/stop_verify.sh; do
  [ -f "$s" ] || continue
  [ -x "$s" ] && ok "$s ejecutable" || fail "$s sin permiso de ejecución" "chmod +x $s"
  bash -n "$s" 2>/dev/null && ok "$s sintaxis OK" || fail "$s con error de sintaxis" "revisar la edición hecha al configurarlo"
done

# ── 4. settings.json válido y con los dos hooks ─────────────────────────────
echo "── [4/6] Hooks en .claude/settings.json"
if [ -f .claude/settings.json ]; then
  if command -v jq >/dev/null 2>&1; then
    jq empty .claude/settings.json 2>/dev/null && ok "JSON válido" || fail "JSON inválido" "corregir .claude/settings.json (¿coma extra al mergear?)"
    jq -e '.hooks.SessionStart' .claude/settings.json >/dev/null 2>&1 && ok "hook SessionStart presente" || fail "falta hook SessionStart" "ver harness_template/.claude/settings.json"
    jq -e '.hooks.Stop' .claude/settings.json >/dev/null 2>&1 && ok "hook Stop presente" || fail "falta hook Stop (el gate bloqueante)" "ver harness_template/.claude/settings.json"
  else
    grep -q 'SessionStart' .claude/settings.json && grep -q '"Stop"' .claude/settings.json \
      && ok "hooks presentes (sin jq, chequeo por grep)" \
      || fail "hooks incompletos" "instalar jq para chequeo completo o comparar con el template"
  fi
fi

# ── 5. feature_list.json sano ───────────────────────────────────────────────
echo "── [5/6] feature_list.json"
if [ -f feature_list.json ]; then
  if command -v jq >/dev/null 2>&1; then
    jq empty feature_list.json 2>/dev/null && ok "JSON válido" || fail "JSON inválido" "corregir feature_list.json"
    DONE_COUNT=$(jq '[.features[]? | select(.status == "done")] | length' feature_list.json 2>/dev/null || echo 0)
    [ "${DONE_COUNT:-0}" -eq 0 ] && ok "sin features done (lo cerrado vive en archive)" \
      || fail "$DONE_COUNT features 'done' adentro" "moverlas a progress/archive/<id>/summary.md + INDEX.md y eliminarlas del JSON"
  fi
  grep -q '"ejemplo-001"' feature_list.json \
    && fail "la entrada de ejemplo sigue presente" "borrar la feature ejemplo-001 del template" \
    || ok "entrada de ejemplo eliminada"
fi

# ── 6. CLAUDE.md corto (si supera ~500 líneas el modelo lo ignora parcialmente) ─
echo "── [6/6] CLAUDE.md compacto"
if [ -f CLAUDE.md ]; then
  LINES=$(wc -l < CLAUDE.md)
  if [ "$LINES" -le 150 ]; then
    ok "CLAUDE.md: $LINES líneas (≤150)"
  elif [ "$LINES" -le 300 ]; then
    fail "CLAUDE.md: $LINES líneas (>150)" "migrar lo enciclopédico a .claude/skills/ (INSTALL.md fase 2)"
  else
    fail "CLAUDE.md: $LINES líneas (MUY largo, riesgo de ignorado parcial)" "migrar urgente a skills; dejar solo reglas duras + triaje + punteros"
  fi
fi

echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "🔴 INSTALACIÓN INCOMPLETA — arreglar los ❌ de arriba y volver a correr."
  exit 1
fi
echo "🟢 Instalación verificada. Quedan los chequeos VIVOS (no automatizables acá):"
echo "   1. Probar que verify.sh falla cuando debe (romper algo a propósito y deshacer)."
echo "   2. Probar el hook Stop: cambio en src sin verificar → intentar terminar → debe bloquear."
echo "   3. Sesión nueva → SessionStart debe inyectar current.md y la rama."
exit 0
