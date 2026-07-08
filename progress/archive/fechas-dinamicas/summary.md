# fechas-dinamicas — eventos y turnos siempre relativos a hoy

**Fecha:** 2026-07-08 · **Estado:** done · **Commit:** c30d8c6

## Qué se hizo
Las fechas de eventos y turnos estaban hardcodeadas (formato `DD/07`, julio fijo) y quedaban
atrasadas. Ahora se recalculan relativas a HOY en cada carga.

- **Motor de fechas** (antes de `const DB`): `demoBase()` (=new Date()), `addDays(d,n)`,
  `fmtTurno(d,hora)` → "Mié 8/07 · 09:30", `fmtEvento(d)` → "6/7/2026", `mkTurnosAgenda(base=hoy)`
  (5 slots en hoy/+1/+2, 2/2/1), `mkSeedTurno(base=hoy)` (turno confirmado en +2, marcado
  `seed:true`), `shiftEventos(eventos, base=hoy)` (re-fecha preservando el espaciado; el más
  temprano pasa a HOY; offsets calculados una vez, fuera de los objetos → idempotente y sin
  ensuciarlos). Todas aceptan una fecha base para testear con fecha fija.
- DB seed usa el motor; `shiftEventos(EVENTOS)` al cargar. `matchFecha` `/(\d+)\/07/` → `/(\d+)\/\d+/`.
  `speakable` ya era genérico por mes (usa MESES[mo]). Turno de acompañamiento con fecha dinámica.
- **Persistencia v:1→v:2**: el shape ahora trae flag `seed`; lo persistido viejo se descarta solo.
  El turno semilla se REGENERA fresco (nunca atrasado); las reservas del usuario (sin flag seed) se
  conservan tal cual aunque queden en el pasado (decisión del usuario).

## Criterios ✅
Los 6 EARS cumplidos (eventos desde hoy sin espaciado roto · turnos hoy/+1/+2 con weekday correcto ·
seed y acompañamiento a futuro · reservas del usuario conservadas · matchFecha/speakable de cualquier
mes · recálculo en cada carga).

## Decisiones clave (del usuario)
- Eventos: re-fechar desde HOY preservando el espaciado (mismos 6, nunca pasados).
- Turnos: hoy + 2 días (calendario, incluye finde).
- Turno reservado que quedó viejo: se DEJA como está (no se descarta); solo se re-fecha la semilla.

## Verificación
`node test/fechas-dinamicas.test.js` 14/14 (rojo-primero) + `node test/speakable.test.js` 34/34 +
`scripts/verify.sh full` verde. Visual (screenshots headless, hoy 2026-07-08): eventos 8/7→14/7 (offsets
0,0,1,2,3,6), turno confirmado Vie 10/07. Reviewer en contexto fresco: APROBADO (su nota menor sobre
`_date0` enumerable resuelta guardando los offsets fuera de los objetos).

## Archivos
`index.html`, `oriana-mobile.html` (espejo), `test/fechas-dinamicas.test.js` (nuevo),
`test/estabilidad-fase5.test.js` (shape v:2), `scripts/verify.sh`.
