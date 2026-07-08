#!/usr/bin/env bash
# stage_publish.sh — arma dist/ con SOLO lo publicable (lo corre Netlify como build).
# Motivo: publish="." exponía docs/, progress/, test/, CLAUDE.md, etc. por URL.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
rm -rf dist
mkdir dist
cp index.html oriana-mobile.html favicon.svg dist/
cp -R assets dist/assets
echo "dist/ listo:"
ls dist
