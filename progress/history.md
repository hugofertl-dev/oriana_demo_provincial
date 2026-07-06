# Historial de sesiones

> Una línea por sesión o ajuste directo: `AAAA-MM-DD — qué se hizo (ids si aplica)`.
> Los detalles viven en progress/archive/<id>/; esto es solo la cronología.

2026-07-06 — Feature reclamos-tickets: gestión de reclamos (luz / hospitales públicos) con tickets + pantalla "Mis reclamos". Cerrada tras review (fix bloqueante de ruteo vs línea 144). 34/34 tests.
2026-07-06 — Ajuste: naturalidad de voz TTS → EL_STABILITY 0.6→0.4 y EL_STYLE 0.15→0.10 (index.html + oriana-mobile.html). Verificado con /api/tts (200, audio/mpeg). También: .env agregado a .gitignore.
2026-07-06 — Ajuste: se eliminó el soporte de Vercel; queda solo Netlify. Borrado api/tts.js; limpiadas menciones a Vercel en COMO-PUBLICAR.md, CLAUDE.md, docs/architecture.md y docs/lessons.md. verify quick verde.
