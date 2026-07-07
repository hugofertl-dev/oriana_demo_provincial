# Historial de sesiones

> Una línea por sesión o ajuste directo: `AAAA-MM-DD — qué se hizo (ids si aplica)`.
> Los detalles viven en progress/archive/<id>/; esto es solo la cronología.

2026-07-06 — Feature reclamos-tickets: gestión de reclamos (luz / hospitales públicos) con tickets + pantalla "Mis reclamos". Cerrada tras review (fix bloqueante de ruteo vs línea 144). 34/34 tests. Luego: paso de dirección del reclamo eléctrico a carga libre (localidad + calle/número, Misiones).
2026-07-06 — Feature chat-llm-misiones: chat de ORIANA con Claude vía /api/chat (datos de Misiones, fallback a regex). Cerrada tras reviewer + security-auditor (contexto fresco): XSS descartado; fixes de idempotencia, action incompleta, error genérico y CORS configurable. Deuda aceptada: endpoint público sin rate-limit. 44/44 tests.
2026-07-07 — Feature ui-healthcare-redesign: rediseño de UI completo al lenguaje "Healthcare Chatbot" (paleta verde, tokens en :root, bot sin burbuja, chips pill, header pill, tabbar). CSS-first (lógica intacta). Cerrada tras reviewer APROBADO. Logo estrella con degradé verde (sin gota). LLM revalidado en vivo post-rediseño. 44/44 tests.
2026-07-06 — Ajuste: naturalidad de voz TTS → EL_STABILITY 0.6→0.4 y EL_STYLE 0.15→0.10 (index.html + oriana-mobile.html). Verificado con /api/tts (200, audio/mpeg). También: .env agregado a .gitignore.
2026-07-06 — Ajuste: se eliminó el soporte de Vercel; queda solo Netlify. Borrado api/tts.js; limpiadas menciones a Vercel en COMO-PUBLICAR.md, CLAUDE.md, docs/architecture.md y docs/lessons.md. verify quick verde.
2026-07-06 — Ajuste: voz TTS variante #4 → EL_STABILITY 0.35, EL_STYLE 0.05 (index.html + oriana-mobile.html) y similarity_boost 0.50→0.75 (netlify/functions/tts.js). Elegida por el usuario entre 5 candidatas A/B.
2026-07-06 — Feature permiso-microfono: panel de permiso de micrófono (iOS/Safari) con engranaje + apertura al tocar 🎙️. Cerrada tras reviewer + aceptación en iPhone real. En el camino se arregló el autoplay de voz en iOS y se documentaron 2 gotchas iOS en lessons. Deploy en Netlify (pre_produccion, auto-deploy desde GitHub).
2026-07-06 — Feature login-cuentas: login + crear cuenta + persistencia en localStorage, cerrar sesión en Perfil, datos de la cuenta en Perfil/Inicio. Cerrada tras reviewer (2 fixes menores aplicados: escape XSS + sesión huérfana). Incluyó fix de bug pre-existente (.screen.hidden vs display por ID).
