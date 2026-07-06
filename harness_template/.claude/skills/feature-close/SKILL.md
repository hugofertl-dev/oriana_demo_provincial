---
name: feature-close
description: Usar cuando una Feature pasó el review y la verificación está verde, para cerrarla formalmente - archiva los artefactos, actualiza feature_list.json e INDEX, y ejecuta el ciclo de aprendizaje (reglas nuevas/obsoletas). También usar para cerrar una feature como discarded o someday por decisión del usuario.
---

# feature-close — cierre formal + aprendizaje

## Iron Law

**Una feature sin cerrar formalmente no terminó.** "El código ya está" no es
cierre: sin archivado no hay historial para el equipo, y sin el paso de
aprendizaje el harness repite los mismos errores para siempre.

## Precondiciones (cierre como `done`)

1. `verification` de la feature en verde + `scripts/verify.sh full` verde.
2. Review del agente fresco (`.claude/agents/reviewer.md`) sin observaciones
   bloqueantes.
3. Si la feature tiene UI: el usuario vio el resultado (captura o demo) y lo
   aprobó. El reviewer valida código; lo visual lo aprueba el usuario.
4. **Si tocó código sensible** (auth, input de usuario, queries/DB, secrets,
   endpoints): auditoría de seguridad ANTES de proponer el commit:
   - `scripts/security_scan.sh full` (capa mecánica) sin bloqueantes.
   - Lanzar el agente `security-auditor` en **contexto fresco** con el diff.
     Sus hallazgos confirmados se arreglan (con OK del usuario) antes de cerrar;
     los "a verificar" se reportan al usuario. Ver skill `security-audit`.

## Pasos

### 1. Archivar

```
progress/archive/<id>/summary.md   ← ≤10 líneas: qué se hizo, criterios ✅,
                                      decisiones clave, hallazgos útiles
```

Agregar UNA línea a `progress/archive/INDEX.md`:
`| <id> | <título> | <fecha> | <commit si existe> |`

### 2. Actualizar memoria viva

- `feature_list.json`: la entrada **se elimina** del archivo (queda en archive).
  Si el cierre es `discarded` o `someday`: mover la entrada a la sección
  correspondiente del archivo con una línea de razón.
- `progress/current/<id>.md`: borrarlo si existe (el handoff ya no aplica).
- `progress/history.md`: una línea de sesión.

### 3. Ciclo de aprendizaje (lo que mantiene vivo el harness)

Preguntarse — y preguntar al usuario si hay material:

| Pregunta | Si la respuesta es sí |
|---|---|
| ¿El usuario rechazó/corrigió algo durante la feature? | La corrección se escribe como regla en el skill correspondiente (`design-system` si es visual, `docs/lessons.md` si es técnico, `CLAUDE.md` si es de proceso). |
| ¿Descubrimos un gotcha técnico (contrato, shape, trampa)? | → `docs/lessons.md` con fecha. |
| ¿Alguna regla/doc existente resultó obsoleta o falsa? | **Borrarla o corregirla AHORA.** Docs podridas son peores que ninguna. |
| ¿Se creó un patrón/widget reutilizable? | Registrarlo donde el próximo lo encuentre (lessons o skill del tema). |

### 4. Commit

NO commitear. Informar al usuario que está listo para su revisión y commit.
(Excepción: con muchos cambios acumulados, PROPONER el commit.)

## Anti-racionalizaciones

| Excusa | Realidad |
|---|---|
| "Archivo después, ahora sigo con lo nuevo" | Después no existe. El WIP-gate de feature-start te lo va a cobrar. |
| "No hay nada que aprender de esta" | Si el usuario corrigió UNA cosa, hay algo que aprender. Revisá la conversación. |
| "La regla obsoleta la dejo por las dudas" | Una regla falsa que el agente obedece causa errores invisibles. Se borra. |
