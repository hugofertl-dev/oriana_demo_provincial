# El arnés nuevo — guía para presentación

> Material de apoyo para exponer el rediseño del arnés de trabajo con agentes de
> IA. Pensado para leerse de corrido o usarse como guion de slides.

---

## 1. El problema en una frase

El arnés viejo trataba a la IA como un **equipo de oficina**: un jefe que reparte
tareas a 4 empleados (investigador, programador, tester, revisor) que se pasan
documentos entre sí. Eso copiaba la burocracia humana —y sus defectos— en lugar
de aprovechar cómo trabaja realmente un modelo de lenguaje.

**Tres síntomas que sufríamos:**

1. **Lento y caro** — la misma ceremonia para cambiar un color que para una
   función entera.
2. **"Teléfono descompuesto"** — en cada traspaso entre agentes se perdía
   información; el revisor nunca veía lo que el investigador había entendido.
3. **Errores que pasaban igual** — la verificación era una lista que un agente
   "leía y aprobaba", y los tests se escribían para pasar siempre.

---

## 2. La idea central del rediseño

> **Un solo agente hace todo el trabajo, y la calidad la garantizan scripts, no
> la buena voluntad del modelo.**

Tres principios:

| Principio | Qué significa |
|---|---|
| **Un solo agente escritor** | El que investiga es el que programa y prueba. Sin traspasos = sin teléfono descompuesto. La información nunca sale de su "cabeza". |
| **Verificación mecánica** | Un script (no un texto) decide si el trabajo está bien. Un script no se autoengaña ni se aprueba solo. |
| **Memoria compartida en Git** | Todo el conocimiento del proyecto vive en el repositorio, versionado. Cualquier compañero —o sesión futura— retoma sin que nadie le explique nada. |

---

## 3. La novedad clave: triaje por tamaño de tarea

Antes, **todo** pasaba por el circuito completo. Ahora el agente clasifica cada
pedido en una línea (y vos podés corregirlo):

| Nivel | Ejemplos | Proceso |
|---|---|---|
| **Ajuste** | color, texto, una variable | Directo. Sin ceremonia. |
| **Fix** | bug, crash | Primero un test que reproduce el error, después el arreglo. |
| **Feature** | vista nueva, lógica, integración | Entrevista de requisitos → trabajo autónomo → revisión → cierre. |

**Resultado:** los cambios chicos son inmediatos; la ceremonia se reserva para lo
que de verdad la necesita.

---

## 4. Qué mejora, punto por punto

| Antes | Ahora |
|---|---|
| 5 roles + 4 traspasos por tarea | 1 agente; los traspasos inevitables van por **artefactos** (el código mismo), no por relatos |
| El agente "asumía" cuando dudaba | **Entrevista obligatoria** antes de programar lógica: pregunta hasta agotar dudas |
| Verificación = lista que se aprueba sola | Verificación = **script que bloquea**: el agente no puede declarar "terminado" si está en rojo |
| Tests que nunca fallan | **Sabotage check**: si el test pasa sin el arreglo, se rechaza por decorativo |
| Memoria de 1 MB con 200+ tareas muertas | Memoria **podada**: solo lo vivo a la vista; lo cerrado, archivado |
| Conocimiento atrapado en la PC de cada dev | Conocimiento **en Git**: reglas, lecciones y diseño visible para todo el equipo |
| Diseños de UI genéricos e inconsistentes | El agente **clona** apartados existentes y **mira capturas** de su propio resultado antes de mostrarlo |
| Auditoría de seguridad con prompt genérico ("actuá de experto"), 1 pasada | **Revisor fresco por lentes OWASP** + herramientas reales (secrets/CVE/SAST); cada hallazgo verificado |

---

## 5. Qué hace de nuevo (capacidades que antes no existían)

- **Continuidad entre sesiones y personas.** Cuando se corta el trabajo (se acaba
  el cupo, termina el día, lo sigue otro), se escribe un *handoff* con protocolo
  estricto. La sesión siguiente arranca sabiendo exactamente dónde quedó todo.
- **Arranque automático.** Al abrir, el sistema le inyecta al agente el estado
  actual y le avisa si está parado en una rama protegida.
- **Aprendizaje cableado.** Cada vez que rechazás algo, la corrección se escribe
  como regla. El arnés **mejora con el uso** en vez de repetir errores.
- **Trabajo en equipo sin pisarse.** Dos personas en ramas distintas pueden
  trabajar en paralelo: los archivos del sistema están diseñados para no chocar
  al unir el trabajo.
- **Instalable en cualquier proyecto.** Existe un esqueleto genérico que se
  instala en otros repos (probado en Flutter y en un backend Dart) con
  verificación automática de que quedó bien.
- **Auditoría de seguridad en contexto fresco.** Antes de cerrar una feature que
  toca login, datos de usuario o base de datos, un revisor independiente la
  audita por categorías OWASP y corre herramientas reales (secrets, CVEs, SAST).
  El "actuá como experto con 20 años" quedó descartado: está *probado* que
  empeora la detección — lo que funciona es dividir por foco y verificar cada
  hallazgo.

---

## 6. Inspiración y respaldo

El rediseño no es una corazonada: se validó contra el estado del arte de 2026 —
las prácticas oficiales de Anthropic para agentes de larga duración, el consenso
de la industria sobre "un solo agente para código" (no comités de agentes), y
patrones probados de la comunidad (verificación bloqueante, criterios de
aceptación verificables, memoria compartida en Git).

---

## 7. Cierre — la frase para la slide final

> **Antes:** un comité de agentes que se pasaban papeles y aprobaban su propio trabajo.
> **Ahora:** un agente experto que trabaja solo, se autocorrige contra pruebas
> reales, y deja todo documentado para el que sigue.
>
> Menos ceremonia, menos errores, y el conocimiento deja de vivir en una cabeza
> para vivir en el repositorio.

---

*Diagramas de apoyo (editables, alto contraste): `harness_template/diagramas/`
— `arnes_actual.drawio` (el problema) y `arnes_nuevo.drawio` (la solución).*
