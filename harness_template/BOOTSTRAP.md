# BOOTSTRAP — instrucciones para el agente instalador

> **Sos un agente de código (Claude Code u otro) y un usuario te pasó esta
> carpeta para instalar el harness en su proyecto.** Este documento te dice
> exactamente QUÉ hacer, CÓMO y POR QUÉ. Seguilo en orden. No saltees pasos.

## Qué vas a instalar y por qué

Un arnés mínimo de ingeniería cuyo diseño responde a 5 problemas reales de los
agentes LLM (el detalle está en `README.md`, leelo primero):

| Problema | Pieza que lo resuelve |
|---|---|
| Pérdida de información entre agentes/sesiones (teléfono descompuesto) | Un solo agente escritor + handoffs por artefactos (`progress/current/`, diff) |
| El agente declara éxito sin verificar / tests decorativos | `scripts/verify.sh` + hook Stop bloqueante + `sabotage_check.sh` |
| Burocracia idéntica para tareas grandes y chicas | Triaje Ajuste/Fix/Feature en `CLAUDE.md` |
| El agente asume en vez de preguntar | Skill `feature-start` (entrevista obligatoria) + WIP-gate |
| Conocimiento del proyecto atrapado en memoria local de un dev | Memoria compartida en git: `feature_list.json`, `progress/`, `docs/lessons.md`, skills |

## Protocolo de instalación

> **ANTES de empezar: creá un todo (lista de tareas) por CADA paso de este
> protocolo, incluidas las 5 preguntas del paso 0 y cada verificación del
> paso 3.** No confíes en tu memoria para no saltear pasos — el contexto se
> llena y los protocolos ejecutados "de memoria" pierden pasos en el medio.
> El cierre NO depende de tu criterio: es `scripts/check_install.sh` en verde.

### Paso 0 — Entrevista mínima al usuario (NO instalar a ciegas)

Preguntá (una pregunta por mensaje, ofreciendo opciones):

1. **¿Proyecto sin arnés o reestructuración de uno existente?** → define si
   seguís la ruta A o B de `INSTALL.md`.
2. **Stack y comandos**: lint, test y build reales del proyecto (verificalos
   ejecutándolos antes de cablearlos).
3. **Ramas protegidas**: cuáles son las ramas donde NUNCA se trabaja directo.
4. **Convenciones visuales** (si el proyecto tiene UI): ¿qué apartados
   existentes considera bien diseñados? → semilla del skill `design-system`.
5. **Si es reestructuración**: dónde vive el estado actual (lista de features,
   notas, memoria del agente) para migrarlo, no perderlo.

### Paso 1 — Copiar la estructura

Según `INSTALL.md` sección A (o B si es migración). Resumen:

- `scripts/`, `.claude/`, `progress/`, `docs/` → a la raíz del proyecto.
- `CLAUDE.md.template` → `CLAUDE.md` · `AGENTS.md.template` → `AGENTS.md` ·
  `feature_list.json.template` → `feature_list.json` (borrar la entrada de ejemplo).
- `chmod +x scripts/*.sh .claude/hooks/*.sh`
- Si el proyecto YA tiene `CLAUDE.md` o `.claude/settings.json`: **mergear, no
  pisar**. Mostrale al usuario qué conservás de lo viejo y qué reemplazás.

### Paso 2 — Configurar (reemplazar TODOS los `{{PLACEHOLDER}}`)

Buscá `{{` en todo lo copiado. Quedan cero. Archivos con placeholders:
`CLAUDE.md`, `AGENTS.md`, `scripts/verify.sh`, `.claude/hooks/session_start.sh`,
`.claude/hooks/stop_verify.sh`, `.claude/skills/design-system/SKILL.md`.

### Paso 3 — Verificar la instalación (con evidencia, no de palabra)

1. **`scripts/check_install.sh` desde la raíz del proyecto → debe terminar
   VERDE.** Este script es el checklist mecánico: detecta archivos faltantes,
   placeholders sin reemplazar, hooks ausentes, JSON roto y CLAUDE.md inflado.
   Cada ❌ trae su instrucción de arreglo. Loop hasta verde.
2. `scripts/verify.sh quick` corre y termina verde en el proyecto limpio.
3. Romper algo a propósito (ej. un error de lint en un archivo temporal) →
   `verify.sh quick` debe terminar ROJO. Deshacer.
4. Probar el hook Stop: con un cambio sin verificar en src, intentar cerrar el
   turno → el hook debe bloquear (exit 2).
5. Abrir sesión nueva → el hook SessionStart debe inyectar los handoffs de
   `progress/current/` y la rama actual.
6. Mostrar al usuario la salida de `check_install.sh` + el resultado de 2-5.

### Paso 4 — Migración (solo ruta B)

Seguir `INSTALL.md` fases 1-4. Reglas críticas:

- El historial del equipo (`progress/archive/` o equivalente) se CONSERVA.
- Las features vivas del sistema viejo se migran a `feature_list.json` nuevo
  con criterios EARS (si los criterios viejos son vagos, pedile al usuario que
  los confirme — no los inventes).
- El conocimiento en memoria local del agente se migra a `docs/lessons.md` y
  skills (preguntale al usuario por su memoria local; vos no la ves).
- Lo viejo NO se borra hasta una semana de uso del nuevo (va a `attic/`).

### Paso 5 — Feature de estreno

Proponele al usuario hacer una primera tarea real de cada nivel para validar el
flujo: un Ajuste (directo), y una Feature chica (entrevista → criterios →
loop → review → cierre). Recién ahí la instalación está completa.

## Reglas para vos durante la instalación

- **No comitees nada** salvo pedido explícito del usuario.
- **No inventes configuración**: comando que no verificaste ejecutándolo, no se
  cablea.
- Si algo del proyecto contradice este template (ej. ya tienen otra convención
  de ramas), **gana el proyecto** — adaptá el template y registrá la decisión.
- Al terminar, mostrá un resumen: qué quedó instalado, qué configuraste con qué
  valores, qué falta decidir.
