# CLAUDE.md — ORIANA (demo provincial)

> Mantener este archivo < 150 líneas. Lo enciclopédico va en `.claude/skills/` y `docs/`.
> Estado del trabajo: `feature_list.json` (vivo) · `progress/current/` (handoffs,
> uno por feature) · `progress/archive/INDEX.md` (historial) · `docs/lessons.md`
> (gotchas técnicos).

## Proyecto

- **Stack:** demo front-end estática (HTML + CSS + JS inline, sin framework/build) +
  función serverless Node (`netlify/functions/tts.js`) + proxy local Python.
- **Comandos:** ver `scripts/verify.sh` (lint/test/build centralizados ahí).
- **Arquitectura:** ver `docs/architecture.md` (motor de intenciones por regex, `DB` simulado,
  máquina de estados de flujo, voz STT/TTS). No copiar ese detalle acá.

## Triaje (OBLIGATORIO antes de trabajar)

Clasificar todo pedido en UNA línea y decirla al usuario (puede corregirla):

| Nivel | Qué es | Proceso |
|---|---|---|
| **Ajuste** | color, dimensión, texto, rename, valor | Directo → `scripts/verify.sh quick` → 1 línea en `progress/history.md` |
| **Fix** | crash, bug | Test que reproduce (ROJO antes del fix) → fix → `scripts/verify.sh fix` |
| **Feature** | lógica/vista/endpoint nuevo | Skill `feature-start` → loop hasta `verify.sh full` verde → reviewer → skill `feature-close` |

## Reglas duras

1. **Un solo agente escritor.** No despachar subagentes para implementar.
   Subagentes solo para: búsquedas de solo-lectura (devuelven resumen corto) y
   el review final (`.claude/agents/reviewer.md`).
2. **Preguntar, no asumir.** En nivel Feature, la entrevista de `feature-start`
   es obligatoria. Durante la implementación: decisión no cubierta por los
   criterios → preguntar al usuario. Una pregunta del usuario NO es un pedido
   de cambio.
3. **Tests reales.** Un test que nunca estuvo rojo no existe. Para fixes corre
   `scripts/sabotage_check.sh`. Prohibido: asserts triviales, tests que
   verifican mocks, tests que duplican la implementación. (Ojo: hoy no hay suite
   de tests automatizada; un Fix con test requiere montar el andamiaje mínimo o
   acordar verificación manual con el usuario.)
4. **Verificación antes de declarar éxito.** Nada está "listo" sin
   `verify.sh` verde del nivel correspondiente (el hook Stop lo exige igual).
5. **UI: nunca desde página en blanco.** Apartado nuevo = clonar el apartado de
   referencia más parecido (skill `design-system`; la referencia canónica es el
   Chat de ORIANA). Si hay UI nueva: verificación visual con la app corriendo
   (`python3 oriana-proxy.py`) antes de presentar.
6. **Tocar solo lo pedido — pero avisar lo que veas.** EJECUTAR: cambios
   quirúrgicos; sin features especulativas, sin abstracciones single-use, sin
   retrocompatibilidad defensiva inventada. Duda sobre el shape de un dato: log
   temporal y preguntar, no inventar. PROPONER: sí señalar en 1-2 líneas
   oportunidades o riesgos adyacentes que detectes, SIN implementarlos. Avisar
   ≠ hacer; el usuario decide.
7. **WIP-gate.** Antes de arrancar trabajo nuevo (Fix o Feature), si hay
   features `in_progress` o `paused` en `feature_list.json`: notificarlo y
   pedir decisión sobre cada una (retomar / pausar con handoff / dar por
   terminada / `discarded` / `someday`). No se arranca lo nuevo sin esa
   decisión — nada queda a medio hacer en silencio.

## Git

- **Ramas protegidas:** `main` (y `master`). Si la rama actual es protegida →
  frenar y preguntar antes de tocar código. Cualquier otra rama → trabajar directo.
- **Nombres de rama nueva:** SIEMPRE empiezan con `feature/`, `fix/` o `bug/`
  + slug corto en kebab-case. Antes de crearla, preguntar al usuario si hay un
  issue asociado; si lo hay, pedir el número y terminar el nombre con
  `#<numero>` (ej: `fix/crash-guardado#42`, `feature/logs-viewer#21`).
- **Commits: NUNCA automáticos.** Todo queda sin commitear para revisión del
  usuario. Excepción: con muchos cambios acumulados se puede PROPONER un commit
  (decide el usuario).

## Memoria compartida (regla de oro)

Si otro dev necesitaría saberlo → va al repo, no a memoria local del agente:

- Gotcha técnico / contrato / trampa → `docs/lessons.md`
- Convención visual aprobada → skill `design-system`
- Regla de proceso → este archivo (si es dura) o el skill correspondiente

## Skills del proyecto

- `design-system`: convenciones visuales, referencia canónica (Chat de ORIANA), regla de clonado.
- `feature-start` / `handoff` / `feature-close`: ciclo de trabajo por feature.
- `security-audit`: gates de seguridad (Node/JS y otros stacks).
