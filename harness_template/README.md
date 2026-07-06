# Harness Template — arnés mínimo para agentes de código

Esqueleto **agnóstico de stack** para instalar un arnés de ingeniería en cualquier
proyecto (o reestructurar uno existente). Diseñado para Claude Code, compatible
con cualquier agente que lea `AGENTS.md`.

> **¿Sos un agente y te pasaron esta carpeta para instalarla en un proyecto?**
> → Leé este README completo (el porqué) y después seguí **`BOOTSTRAP.md`**
> (el qué y el cómo, paso a paso con verificaciones). `INSTALL.md` tiene el
> detalle por ruta (proyecto nuevo / migración).

> Validado contra: posts de ingeniería de Anthropic (effective harnesses, context
> engineering), superpowers (formato de skills), GSD (STATE/handoff), beads (IDs
> hash), Kiro/EARS (criterios), tdd-guard (gates bloqueantes), y el consenso
> single-writer (Cognition / Anthropic, 2026).

---

## Los 5 principios (no negociables)

1. **Un solo agente escritor.** El mismo contexto que explora es el que implementa
   y testea. Cero handoffs internos = cero teléfono descompuesto. Subagentes solo
   para: búsquedas de solo-lectura y el review final con contexto fresco.
2. **Artefactos, nunca relatos.** Los dos únicos handoffs inevitables se hacen con
   artefactos: al reviewer se le pasa `git diff` + criterios (no el relato del
   implementador); a la próxima sesión se le pasa `progress/current/<id>.md` con
   protocolo estricto.
3. **Verificación mecánica bloqueante.** Los checkpoints son scripts con exit code
   (`scripts/verify.sh`), no checklists en prosa. Un hook `Stop` impide que el
   agente dé por terminado el trabajo con la verificación en rojo. Un LLM
   validando un checklist tiende a marcar verde; un script no se autoconvence.
4. **Memoria compartida en git, podada.** Todo conocimiento del proyecto vive en
   el repo (no en memoria local del agente de cada dev). Lo vivo se separa de lo
   muerto: `feature_list.json` solo contiene trabajo activo; lo cerrado se archiva.
5. **El aprendizaje está cableado al cierre.** Cada feature termina preguntando
   "¿hay regla nueva? ¿hay regla obsoleta?" y actualizando los skills. Así el
   harness mejora con el uso en vez de pudrirse.

## Triaje — la pieza que elimina la burocracia

Todo pedido se clasifica en una línea ANTES de trabajar. El usuario puede
corregir el triaje ahí mismo.

| Nivel | Ejemplos | Proceso |
|---|---|---|
| **Ajuste** | color, dimensión, texto, renombrar, "X ahora es Y" | Directo. Sin feature, sin tests nuevos, sin review. `verify.sh quick`. Una línea en `progress/history.md`. |
| **Fix** | crash, bug, comportamiento incorrecto | Test que reproduce (rojo ANTES del fix) → fix → `verify.sh fix` (incluye sabotage check). Sin entrevista. |
| **Feature** | vista nueva, endpoint, lógica nueva | Skill `feature-start` (entrevista) → criterios EARS + comando de verificación escritos ANTES → loop autónomo hasta verde → review con agente fresco → `feature-close`. |

## Estructura

```
<proyecto>/
├── CLAUDE.md                  ← <150 líneas: reglas duras + triaje + punteros (desde CLAUDE.md.template)
├── AGENTS.md                  ← espejo corto, estándar abierto (otros agentes/IDEs)
├── feature_list.json          ← SOLO trabajo vivo (planned/in_progress/paused/blocked)
├── scripts/
│   ├── verify.sh              ← niveles quick|fix|full; configurable por variables
│   └── sabotage_check.sh      ← anti tests decorativos: sin el fix, el test DEBE fallar
├── .claude/
│   ├── settings.json          ← hooks SessionStart (contexto) + Stop (gate bloqueante)
│   ├── hooks/
│   │   ├── session_start.sh   ← inyecta current.md + alerta de rama protegida
│   │   └── stop_verify.sh     ← cambios en src sin verificar → exit 2 (no puede terminar)
│   ├── skills/
│   │   ├── feature-start/     ← entrevista de requisitos (1 pregunta por vez)
│   │   ├── handoff/           ← protocolo de current.md
│   │   ├── feature-close/     ← archivado + ciclo de aprendizaje
│   │   └── design-system/     ← convenciones visuales del proyecto (se llena con el uso)
│   └── agents/
│       └── reviewer.md        ← único subagente fijo: review fresco con diff + criterios
├── progress/
│   ├── current/               ← memoria VOLÁTIL: un handoff POR FEATURE (cupo / mañana / compañero)
│   ├── history.md             ← una línea por sesión/ajuste
│   └── archive/
│       └── INDEX.md           ← una línea por feature cerrada (greppeable)
└── docs/
    └── lessons.md             ← memoria ESTABLE: gotchas técnicos, contratos, trampas
```

## Los tres tipos de memoria (no mezclarlos)

| Tipo | Archivo | Cambia | Ejemplo |
|---|---|---|---|
| **Volátil** | `progress/current/<id>.md` | cada sesión | "quedé a mitad de X, el próximo paso es Y" |
| **Viva** | `feature_list.json` | cada feature | backlog, criterios, bloqueos |
| **Estable** | `docs/lessons.md`, skills | cuando se aprende algo | "la API envuelve la respuesta en `data`", convenciones de UI |

Regla: conocimiento del proyecto → repo (git). Preferencias personales del dev →
memoria local de su agente. Si otro dev necesitaría saberlo, NO va en memoria local.

## Mantenimiento (por qué esto no se pudre)

- Los skills describen **proceso** (estable); el **estado** vive en archivos que
  el flujo obliga a tocar en cada feature.
- `feature-close` incluye el paso de mantenimiento: regla nueva se escribe, regla
  obsoleta se borra, en el momento.
- Si cualquier documento del harness referencia algo que ya no existe, corregirlo
  es parte de la tarea en curso, no un TODO para después.

## Trabajo en equipo (2+ devs sin pisarse)

Cada dev trabaja su feature en su rama; git mergea, el harness solo necesita
archivos merge-friendly:

- `progress/current/` → **un handoff por feature**, nunca chocan.
- `feature_list.json` → solo vivas + ids únicos + campo `owner`: cada rama toca
  su entrada. El WIP-gate solo bloquea por las features **propias**.
- `progress/archive/<id>/` → carpeta por feature, sin colisión posible.
- `history.md` / `INDEX.md` → solo agregan líneas; si chocan, el conflicto es
  trivial (conservar ambas).
- La marca de verificación vive en `.git/` (local por máquina, no viaja).

## WIP-gate (nada queda a medio hacer en silencio)

Antes de arrancar trabajo nuevo, si hay features `in_progress`/`paused`, el
agente DEBE notificarlo y pedir una decisión: retomar · pausar con handoff ·
dar por terminada · `discarded` (descartada) · `someday` (para más adelante).
El usuario decide; el backlog nunca acumula zombies.

## Instalación

- **Agente instalador** → `BOOTSTRAP.md` (protocolo completo con entrevista y verificación).
- **Humano** → `INSTALL.md` (ruta A: proyecto nuevo · ruta B: migrar arnés existente).
