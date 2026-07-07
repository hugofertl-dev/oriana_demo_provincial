# permiso-microfono — Panel de permiso de micrófono (iOS/Safari)

**Fecha:** 2026-07-06 · **Commits:** a3bcc56 (feature) · b0ca291 (fix autoplay iOS) · 39a6260 (limpieza)

## Qué se hizo
Panel/bottom-sheet (clona `.modal`) que gestiona el permiso de micrófono en iOS/Safari:
engranaje ⚙️ en el header del chat + apertura automática al tocar 🎙️ sin permiso.
Dispara `getUserMedia` con un gesto explícito y maneja los estados
prompt/concedido/bloqueado(instrucciones iOS + Reintentar)/no-soportado. Cubre ambos
micrófonos (chat y niños).

## Criterios ✅
Los 6 criterios EARS cumplidos (verificados con test funcional headless + aceptación en iPhone real).

## Decisiones / hallazgos clave
- El disparador del prompt de iOS **debe** estar separado del "abrir panel": getUserMedia
  va en el onclick de "Activar" (gesto directo), no enterrado tras un await.
- Diagnóstico en device: el permiso NO aparecía porque quedó **denegado por-sitio** en
  Safari (iOS no re-pregunta) — se resolvió reseteando datos del sitio, no con código.
- Bug adicional descubierto y arreglado: **autoplay de voz** bloqueado por iOS (ver lessons).
- Ambos gotchas iOS quedaron documentados en `docs/lessons.md`.
