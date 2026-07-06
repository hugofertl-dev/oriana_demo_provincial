---
name: handoff
description: Usar al cerrar una sesión con trabajo a medias, cuando el contexto/cupo está por agotarse, o cuando el usuario dice que sigue otro día u otra persona. Escribe progress/current/<feature_id>.md con el protocolo estricto para que la próxima sesión (propia o de un compañero) retome sin pérdida.
---

# handoff — pasar el trabajo a quien sigue (incluido tu yo futuro)

## Iron Law

**La próxima sesión no estuvo acá.** No vio lo que probaste, no sabe qué
descartaste ni por qué. Todo lo que no quede escrito en
`progress/current/<feature_id>.md` se pierde. Escribir "seguir con X" no es
un handoff, es una adivinanza.

> Un archivo por feature (no uno global): así dos devs con trabajo a medias
> en ramas distintas nunca se pisan el handoff en el merge.

## Cuándo

- Fin de sesión con trabajo a medias (feature `in_progress` → pasarla a `paused`).
- Cupo/contexto por agotarse (escribir ANTES de quedarse sin espacio).
- El usuario indica que retoma otra persona.

## Protocolo de `progress/current/<feature_id>.md` (todas las secciones, sin excepción)

```markdown
# Handoff — <feature_id o tarea> · <fecha>

## Estado exacto
Qué está hecho y qué falta, por criterio de aceptación (✅/⏳/❌).

## Decisiones tomadas y POR QUÉ
Las que un recién llegado no deduciría del código. Incluir caminos DESCARTADOS
y la razón (evita que el siguiente los re-intente).

## Archivos tocados
Lista con una línea de qué se hizo en cada uno. Estado git (commiteado o no).

## Próximo paso CONCRETO
La primera acción de la próxima sesión, ejecutable sin pensar.
Mal: "seguir con la vista". Bien: "implementar el onChanged de X en <archivo>,
el patrón a copiar está en <referencia>".

## Verificación
El comando que dice si está terminado (el `verification` de la feature) y el
último resultado conocido (verde/rojo + qué falla).

## Trampas descubiertas
Lo que te sorprendió y le va a costar una hora al siguiente si no lo lee.
(Si es permanente, va TAMBIÉN a docs/lessons.md.)
```

## Después de escribirlo

1. `feature_list.json`: status → `paused` (si corresponde) con fecha.
2. Si hubo muchos cambios sin commitear: PROPONER commit al usuario (nunca
   commitear solo).

## Anti-racionalizaciones

| Excusa | Realidad |
|---|---|
| "Me acuerdo mañana" | Mañana sos un contexto vacío. No te acordás de nada. |
| "Está todo en el chat" | El chat no se carga en la próxima sesión. Los handoffs de `current/` sí (hook SessionStart). |
| "Lo escribo rápido en dos líneas" | Dos líneas = el siguiente re-explora todo. El protocolo completo toma 5 minutos y ahorra horas. |
