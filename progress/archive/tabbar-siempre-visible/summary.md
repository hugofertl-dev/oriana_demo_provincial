# tabbar-siempre-visible — cerrada 2026-07-07

Tabbar (Actividad/Inicio/Eventos) siempre visible y funcional en toda pantalla
post-login; oculta solo en login/signup. Todos los criterios EARS ✅ (tests en
`test/tabbar.test.js`, 27 checks, rojos antes del fix).

Decisiones (entrevista): alcance = todas las pantallas post-login (incl. chat,
detalle de evento, cerca, perfil y Acompañamiento); composer del chat apilado
encima de la barra (`.composer{bottom:78px}`); ninguna pestaña activa fuera de
las 3 secciones, salvo detalle de evento que mantiene "Eventos" activa.
Review: aprobado, 1 menor aplicada (umbral del test derivado del alto real de
`#tabbar`, no hardcodeado). Hallazgo útil: `screen-ninos` es "Acompañamiento"
(violencia), no modo niños — documentado en lessons.
