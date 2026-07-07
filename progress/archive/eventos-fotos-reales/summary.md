# eventos-fotos-reales — cerrada 2026-07-07

Eventos con fotos reales: los 6 gradientes placeholder se reemplazaron por las
fotos de `assets/` en el mosaico (`evCard`) y el hero del detalle
(`renderEvento`). Criterios EARS ✅ (test `test/eventos-fotos.test.js`, 40
checks, rojos antes de implementar; umbral de peso ≤155 KB).

Decisiones (entrevista): foto en mosaico + detalle; emoji decorativo eliminado
(chip de categoría se mantiene); originales (~12 MB) reemplazados por
optimizadas url-safe (sips, ~1000px, 79–141 KB); sin lazy-load.
Nota del review: `maraton-costanera.jpg` quedó en 639px porque el ORIGINAL ya
medía eso (upscalear empeora) — excepción aceptada al "~1000px" del criterio.
Reviewer aprobado (2 menores, ambas resueltas/documentadas).
