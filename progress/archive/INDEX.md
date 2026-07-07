# Índice de features cerradas

> Una línea por feature. Para buscar: greppear este índice primero (barato),
> abrir el summary de la feature relevante después.

| id | título | fecha | commit |
|---|---|---|---|
| reclamos-tickets | Gestión de reclamos con generación de tickets (luz / hospitales) | 2026-07-06 | (pendiente) |
| chat-llm-misiones | Chat de ORIANA con Claude (Anthropic) + datos de Misiones + fallback regex | 2026-07-06 | 04faf0a |
| ui-healthcare-redesign | Rediseño de UI al lenguaje "Healthcare Chatbot" (design system en tokens, verde) | 2026-07-07 | (pendiente) |
| geo-cercania | Geolocalización hospital/comisaría más cercano (permiso + haversine real / dirección) + integración LLM + manejo de error | 2026-07-07 | (pendiente) |
| tabbar-siempre-visible | Tabbar (Actividad/Inicio/Eventos) siempre visible en toda pantalla post-login | 2026-07-07 | 0b54235 |
| eventos-fotos-reales | Eventos con fotos reales en mosaico y detalle (assets optimizados url-safe) | 2026-07-07 | 311003f |
| permiso-microfono | Panel de permiso de micrófono (iOS/Safari) | 2026-07-06 | 39a6260 |
| login-cuentas | Login con cuentas y persistencia (localStorage) | 2026-07-06 | b81a82f |
| estabilidad-movil | Estabilidad de la demo en celulares iOS/Android — 5 fases (red, voz, races, performance, deuda) | 2026-07-07 | 78ccb3e |
| rate-limit-apis | Rate-limit por IP (Upstash) en /api/chat y /api/tts + CORS unificado a ALLOWED_ORIGIN (FASE 1 blindaje de APIs) | 2026-07-07 | f0529c4 |
| telemetria-log | Captura global de errores del cliente → /api/log (persistido en Upstash, GET con token por header) (FASE 2 telemetría) | 2026-07-07 | (pendiente) |
