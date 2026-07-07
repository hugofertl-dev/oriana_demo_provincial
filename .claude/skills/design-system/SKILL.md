---
name: design-system
description: Usar SIEMPRE antes de crear o modificar UI (vistas, apartados, widgets visibles). Contiene las convenciones visuales aprobadas del proyecto, los apartados de referencia canónicos y la regla de clonado. Se actualiza con cada rechazo/aprobación visual del usuario.
---

# design-system — ORIANA (demo provincial)

## Iron Law

**Ningún apartado nuevo se diseña desde página en blanco.** Se parte clonando
la estructura del apartado de referencia más parecido y se adapta. La
inconsistencia visual nace de diseñar de cero cada vez.

## Regla de verificación visual

UI nueva o modificada → **mirarla antes de presentarla**: correr la app,
capturar pantalla, autocriticar (alineación, espaciado, jerarquía, consistencia
con el apartado de referencia), iterar. Recién después mostrar al usuario.
Diseñar a ciegas produce UI burda; nadie diseña bien sin mirar.

<!-- ════════ COMPLETAR POR PROYECTO (y mantener con feature-close) ════════ -->

## Apartados de referencia canónicos

Todo vive inline en `index.html` (= `oriana-mobile.html`). Clonar la estructura HTML+CSS
del apartado más parecido; no inventar clases nuevas si ya existe una.

| Tipo de vista | Referencia (clonar de acá) | Notas |
|---|---|---|
| **Conversación / chat** | `#screen-chat` + clases `.msg`/`.bubble`/`.who`/`.chips`/`.chip`/`.typing` | Referencia canónica del proyecto (elegida por el usuario). Burbuja bot vs. usuario, fila de chips de acción, indicador de tipeo. Cualquier interacción conversacional nueva se clona de acá. |
| Tarjeta de dato | `.card` + `.row` + `.badge` (g/a) | Beneficios, turnos, perfil. Badge verde = activo, ámbar = pendiente. |
| Navegación inferior | `.navbtn[data-screen]` | Una pantalla por botón; registrar la screen en `const screens`. |
| **Modal / bottom-sheet** | `.modal-bg` + `.modal` + `.modal-h`/`.modal-lead`/`.modal-foot` + `.btn-ghost`/`.btn-solid` + `.modal-note`(`.ok`/`.err`) | Instancia de referencia: `#micModal` (panel de permiso de micrófono). Abrir con `.open` en `.modal-bg`; cerrar tocando el fondo. Poner `role="dialog"` + `aria-modal` en `.modal`. |
| **Formulario de auth / pantalla completa con card** | `.login-wrap` + `.login-card` + `.login-fld` + `.login-btn.solid` + `.login-note.err` + `.login-links .link` | Instancias de referencia: `#screen-login` y `#screen-signup`. Errores en `.login-note.err` (texto corto), links de navegación en `.login-links`. |

## Convenciones aprobadas

<!-- Cada línea nace de una aprobación o rechazo REAL del usuario. Con fecha. -->

- Paleta institucional teal/mint sobre fondo claro — definida en `:root` de `index.html`
  (`--teal`, `--mint`, `--ink`, `--bg`, `--yellow`, `--green/--amber/--red` para estados).
- Bordes redondeados `--radius:16px` y sombra `--shadow` en tarjetas y burbujas.
- Español rioplatense (voseo: "contame", "elegí", "tocá") en todo texto visible y hablado.
- Emojis como íconos livianos de apoyo (🗓️ 🏥 🚓 💜), no como decoración recargada.

## Tokens / theming

- Todo color/tamaño sale de las CSS custom properties de `:root` (`var(--...)`).
  Cero literales de color nuevos (`#hex`) fuera de `:root`. Si falta un token, se agrega a `:root`.

## Rechazos históricos (anti-patrones del usuario)

<!-- Lo que el usuario ya rechazó NO se vuelve a proponer. Vacío hasta el primer rechazo real. -->

- (aún sin rechazos registrados — se completa en cada `feature-close`)

<!-- ════════════════════════════════════════════════════════════════════ -->

## Mantenimiento

Este skill se actualiza en `feature-close`: cada aprobación/rechazo visual del
usuario se registra acá. Si una convención cambia, la vieja se borra (no
conviven dos verdades).
