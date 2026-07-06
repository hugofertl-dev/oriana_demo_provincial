---
name: feature-start
description: Usar ANTES de implementar cualquier tarea de nivel Feature (lógica nueva, vista nueva, endpoint, integración). Entrevista al usuario hasta agotar ambigüedades, define criterios EARS y el comando de verificación, y crea la entrada en feature_list.json. NO usar para Ajustes ni Fixes.
---

# feature-start — entrevista y contrato de la feature

## Iron Law

**NINGUNA línea de código antes de que el usuario apruebe criterios + verificación.**
Implementar sobre suposiciones es la causa #1 de retrabajo. Si ya empezaste a
codear sin esto, frená y volvé acá.

## Paso 0 — WIP-gate (antes que nada)

Revisar `feature_list.json`. Si hay features `in_progress` o `paused`
**del dev actual** (campo `owner`; las de un compañero solo se mencionan, no
bloquean), **notificarlo y pedir una decisión ANTES de arrancar lo nuevo**:

> Tenés trabajo a medias: `<id> — <título>` (`<status>`). ¿Qué hacemos?
> a) La retomo y lo nuevo espera · b) La pauso formalmente (handoff) y arranco
> lo nuevo · c) Dala por terminada · d) Descartala (`discarded`) · e) Va para
> más adelante (`someday`)

No arrancar lo nuevo hasta que el usuario decida. Razón: las tareas a medio
hacer sin decisión explícita son las que pudren el backlog.

## Paso 1 — Triaje confirmado

Decile al usuario en una línea: "Esto es nivel Feature porque <razón>". Si él lo
baja a Ajuste/Fix, este skill no aplica.

## Paso 2 — Entrevista (el corazón)

Reglas del formato (no negociables):

- **UNA pregunta por mensaje.** No cuestionarios de 8 preguntas juntas.
- **Opciones concretas cuando se pueda** (mejor elegir que redactar).
- Preguntar hasta cubrir: qué quiere exactamente · cómo lo imagina armado ·
  qué apartado/módulo existente tomar de referencia · casos borde · qué NO tocar.
- Si la feature involucra una librería externa o API: consultar documentación
  actual ANTES de proponer el diseño (no diseñar de memoria).
- Si la feature tiene UI: identificar el apartado de referencia visual
  (skill `design-system`) y confirmarlo con el usuario.

Cortar la entrevista cuando una pregunta más no cambiaría el diseño.

## Paso 3 — Contrato

Presentar al usuario, por secciones (aprobación incremental, no todo junto):

1. **Criterios de aceptación en notación EARS** (3-6):
   `CUANDO <condición/evento>, EL SISTEMA DEBE <comportamiento observable>.`
   Prohibido: "que funcione bien", "mejorar X" — si no lo puede verificar un
   tercero, no es un criterio.
2. **Comando de verificación** — el comando concreto que probará que está hecho
   (test específico, verify.sh full, curl, etc.). **Se escribe AHORA, antes de
   implementar.** El loop de implementación corre contra esto.
3. **Archivos estimados** y **riesgos** si los hay.

## Paso 4 — Registrar y arrancar

Con el OK del usuario:

1. Crear la entrada en `feature_list.json`:

```json
{
  "id": "<slug-corto-o-hash>",
  "titulo": "<título accionable>",
  "status": "in_progress",
  "criterios": ["CUANDO ..., EL SISTEMA DEBE ..."],
  "verification": "<comando>",
  "archivos": ["..."],
  "blockedBy": [],
  "owner": "<dev que la trabaja>",
  "creada": "<fecha>"
}
```

2. Chequear rama (si es protegida → preguntar antes de tocar código).
3. Implementar en loop: codear → `verification` + `scripts/verify.sh` → arreglar →
   repetir. **Tope: si tras ~5 iteraciones sigue en rojo, parar y consultar al
   usuario en vez de seguir forzando.**
4. Durante la implementación: decisión no cubierta por los criterios → preguntar,
   no asumir.

## Anti-racionalizaciones

| Excusa | Realidad |
|---|---|
| "El pedido es claro, no hace falta entrevistar" | Si fuera claro tendría criterios verificables. Escribilos; si salen solos, la entrevista dura 1 mensaje. |
| "Pregunto después si surge algo" | Después ya hay código construido sobre la suposición. Preguntar es barato ahora y caro después. |
| "El usuario quiere velocidad, no preguntas" | El usuario pidió explícitamente este flujo. Lo lento es retrabajar. |
| "Defino la verificación cuando termine" | Verificación definida después se amolda al código. Antes, el código se amolda a ella. |
