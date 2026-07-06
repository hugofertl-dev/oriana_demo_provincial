#!/usr/bin/env bash
# syntax_check.sh — lint mecánico para un proyecto HTML+JS estático (sin build).
# Lo usa verify.sh como LINT_CMD. Exit 0 = verde.
#
# Chequea:
#   1. node --check sobre las funciones serverless (api/, netlify/functions/).
#   2. Sintaxis del JS embebido en cada archivo .html (bloques <script>).
#   3. py_compile sobre el proxy local de Python.
#   4. Invariante del proyecto: index.html === oriana-mobile.html (ver docs/lessons.md).
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
FAIL=0
say() { echo "   · $1"; }

# 1) Funciones serverless
for f in api/*.js netlify/functions/*.js; do
  [ -f "$f" ] || continue
  if node --check "$f" 2>/dev/null; then say "node --check $f OK"
  else say "❌ $f error de sintaxis"; node --check "$f"; FAIL=1; fi
done

# 2) JS embebido en los HTML
for h in *.html; do
  [ -f "$h" ] || continue
  if node -e '
    const fs=require("fs"); const html=fs.readFileSync(process.argv[1],"utf8");
    const re=/<script>([\s\S]*?)<\/script>/g; let m,bad=0,i=0;
    while((m=re.exec(html))){ i++; try{ new Function(m[1]); }catch(e){ bad++; console.error("  script #"+i+": "+e.message);} }
    process.exit(bad?1:0);
  ' "$h" 2>&1; then say "JS inline de $h OK"
  else say "❌ JS inline de $h con error"; FAIL=1; fi
done

# 3) Proxy Python
if [ -f oriana-proxy.py ] && command -v python3 >/dev/null 2>&1; then
  if python3 -m py_compile oriana-proxy.py 2>/dev/null; then say "py_compile oriana-proxy.py OK"
  else say "❌ oriana-proxy.py error de sintaxis"; python3 -m py_compile oriana-proxy.py; FAIL=1; fi
fi

# 4) Invariante: index.html y oriana-mobile.html deben ser idénticos
if [ -f index.html ] && [ -f oriana-mobile.html ]; then
  if diff -q index.html oriana-mobile.html >/dev/null; then say "index.html === oriana-mobile.html OK"
  else say "❌ index.html y oriana-mobile.html difieren (deben ser idénticos — cp index.html oriana-mobile.html)"; FAIL=1; fi
fi

exit $FAIL
