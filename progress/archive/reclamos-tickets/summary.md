# reclamos-tickets — Gestión de reclamos con generación de tickets

**Fecha:** 2026-07-06 · **Estado:** done · **Rama:** feature/reclamos-tickets

## Qué se hizo
Flujo de reclamos en el chat de ORIANA con 2 temas en alcance: servicio eléctrico
(corte/baja tensión) y hospitales públicos (demora/falta de atención/trato/otro).
Slot-filling clonado del flujo de turnos, generación de ticket (ELEC-/HOSP-), pantalla
"Mis reclamos" clonada de Actividad, y respuesta educada para temas fuera de alcance.

## Criterios (todos ✅, cubiertos por test/reclamos.test.js — 34/34)
1. Reclamo sin tema → ofrece los 2 temas. 2. Flujo elec (tipo → localidad → dirección →
desde; localidad y dirección de CARGA LIBRE sin chips, dentro de Misiones, calle y número;
sin ticket antes de confirmar). 3. Flujo hosp (hospital/problema/descripción). 4. Confirmar →
ticket único + estado "En gestión" + push a DB.reclamos. 5. Pantalla "Mis reclamos" con estado
vacío. 6. Fuera de alcance → mensaje educado sin ticket. 7. Cancelar → sin ticket.

## Decisiones clave
- Sin 4º tab en la barra (rompía el diseño centrado de 3 botones): acceso a "Mis reclamos"
  desde la pantalla Actividad + chips en el chat.
- Verificación: sin suite previa → se agregó test jsdom (nueva devDep jsdom en package.json).

## Hallazgos del review (resueltos, con tests de regresión)
- BLOQUEANTE: la regla de ruteo reclamo-hospital tenía `maltrat|destrat` y corría antes que
  la de violencia/144 → robaba casos de violencia con mención médica. Se quitó del trigger de
  entrada (el maltrato en hospital lo captura matchProblemaHosp dentro del flujo).
- `problema` (genérico) colisionaba con "hospital más cercano" → removido; `denunc` retenido.
- `git add` antes de terminar de editar dejó el índice con la versión vieja → re-stage.
