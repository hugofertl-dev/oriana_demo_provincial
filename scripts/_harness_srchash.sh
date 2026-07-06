#!/usr/bin/env bash
# _harness_srchash.sh — helper COMPARTIDO por verify.sh y stop_verify.sh.
# NO se ejecuta solo: se sourcea. Definir SRC_DIRS antes de sourcearlo.
#
# harness_src_hash: devuelve un hash del CONTENIDO real de los fuentes bajo
# SRC_DIRS (tracked + untracked no ignorados) + el porcelain (para capturar
# altas/bajas/renames). Así la marca de verify corresponde al contenido exacto
# del código, no solo a la lista de archivos cambiados: editar de nuevo un
# archivo ya sucio tras un verify verde INVALIDA la marca y re-exige verificar.
harness_src_hash() {
  local top
  top=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "nogit"; return; }
  ( cd "$top" && {
      git status --porcelain -- $SRC_DIRS 2>/dev/null
      { git ls-files -- $SRC_DIRS 2>/dev/null
        git ls-files --others --exclude-standard -- $SRC_DIRS 2>/dev/null; } \
        | sort -u | while IFS= read -r f; do
            [ -f "$f" ] && sha1sum "$f"
          done
    } | sha1sum | cut -d' ' -f1 )
}
