#!/usr/bin/env bash
# security_scan.sh — capa MECÁNICA de seguridad (herramientas, no opinión).
# Uso: scripts/security_scan.sh [secrets|full]   (default: secrets)
#
#   secrets → rápido, para pre-commit. Solo secrets scanning. BLOQUEA si encuentra.
#   full    → secrets + CVEs de dependencias + SAST. Para CI / cierre de feature.
#             CVEs y SAST son INFORMATIVOS (requieren triaje, pueden tener FP).
#
# Herramientas (estándar 2025-2026, ver skill security-audit):
#   - gitleaks      secrets (rápido, regex+entropía)
#   - osv-scanner   CVEs de deps (Google, multi-ecosistema, sirve hasta para Dart)
#   - SAST_CMD      configurable por stack (Node: semgrep/njsscan; Dart: [HUECO])
#
# Si una herramienta NO está instalada → avisa y SKIP (no rompe el script).
#
# ── CONFIGURACIÓN POR PROYECTO ──────────────────────────────────────────────
SECRETS_CMD="gitleaks git --staged --no-banner --redact"   # pre-commit; full usa --no-git
CVE_CMD="osv-scanner scan -r ."                            # CVEs de dependencias
SAST_CMD="semgrep scan --config p/owasp-top-ten --error -q"   # Node/JS; SKIP si semgrep no está instalado
                          # (proyecto JS: si algún día se agrega backend, este es el gate SAST)
# ────────────────────────────────────────────────────────────────────────────

set -u
MODE="${1:-secrets}"
HARD_FAIL=0

have() { command -v "$1" >/dev/null 2>&1; }
hdr()  { echo ""; echo "── security_scan[$MODE] :: $1"; }

# 1) SECRETS (siempre; bloqueante)
hdr "secrets (gitleaks)"
if have gitleaks; then
  if [ "$MODE" = "full" ]; then
    gitleaks git --no-banner --redact && echo "   ✅ sin secrets" || { echo "   ❌ SECRETS detectados"; HARD_FAIL=1; }
  else
    gitleaks git --staged --no-banner --redact && echo "   ✅ sin secrets en staged" || { echo "   ❌ SECRETS en staged"; HARD_FAIL=1; }
  fi
else
  echo "   ⚠️ gitleaks no instalado — SKIP (instalar: brew/apt install gitleaks)"
fi

if [ "$MODE" = "full" ]; then
  # 2) CVEs de dependencias (informativo)
  hdr "CVEs de dependencias (osv-scanner)"
  if have osv-scanner; then
    osv-scanner scan -r . || echo "   ⚠️ osv-scanner reportó hallazgos (revisar arriba; triaje requerido)"
  else
    echo "   ⚠️ osv-scanner no instalado — SKIP (https://github.com/google/osv-scanner)"
  fi

  # 3) SAST (informativo; configurable por stack)
  hdr "SAST"
  SAST_BIN="${SAST_CMD%% *}"   # primer token = binario
  if [ -z "$SAST_CMD" ] || [[ "$SAST_CMD" == "{{"* ]]; then
    echo "   ⚠️ SAST_CMD sin configurar (o stack sin SAST maduro, ej. Dart) — SKIP"
  elif ! have "$SAST_BIN"; then
    echo "   ⚠️ $SAST_BIN no instalado — SKIP"
  else
    bash -c "$SAST_CMD" || echo "   ⚠️ SAST reportó hallazgos (revisar; triaje requerido)"
  fi
fi

echo ""
if [ "$HARD_FAIL" -ne 0 ]; then
  echo "🔴 BLOQUEANTE: hay secrets en el código. No commitear hasta removerlos."
  echo "   (bypass de emergencia solo si es falso positivo: revisar a mano)"
  exit 1
fi
echo "🟢 security_scan[$MODE]: sin bloqueantes."
echo "   (los hallazgos informativos de CVE/SAST requieren triaje — no son gate)"
exit 0
