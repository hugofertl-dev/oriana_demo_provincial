# Historial de sesiones

> Una línea por sesión o ajuste directo: `AAAA-MM-DD — qué se hizo (ids si aplica)`.
> Los detalles viven en progress/archive/<id>/; esto es solo la cronología.

2026-07-06 — Feature reclamos-tickets: gestión de reclamos (luz / hospitales públicos) con tickets + pantalla "Mis reclamos". Cerrada tras review (fix bloqueante de ruteo vs línea 144). 34/34 tests.
2026-07-06 — Ajuste: naturalidad de voz TTS → EL_STABILITY 0.6→0.4 y EL_STYLE 0.15→0.10 (index.html + oriana-mobile.html). Verificado con /api/tts (200, audio/mpeg). También: .env agregado a .gitignore.
2026-07-06 — Ajuste: se eliminó el soporte de Vercel; queda solo Netlify. Borrado api/tts.js; limpiadas menciones a Vercel en COMO-PUBLICAR.md, CLAUDE.md, docs/architecture.md y docs/lessons.md. verify quick verde.
2026-07-06 — Ajuste: voz TTS variante #4 → EL_STABILITY 0.35, EL_STYLE 0.05 (index.html + oriana-mobile.html) y similarity_boost 0.50→0.75 (netlify/functions/tts.js). Elegida por el usuario entre 5 candidatas A/B.
2026-07-06 — Feature permiso-microfono: panel de permiso de micrófono (iOS/Safari) con engranaje + apertura al tocar 🎙️. Cerrada tras reviewer + aceptación en iPhone real. En el camino se arregló el autoplay de voz en iOS y se documentaron 2 gotchas iOS en lessons. Deploy en Netlify (pre_produccion, auto-deploy desde GitHub).
