---
name: design-system
description: Usar SIEMPRE antes de crear o modificar UI (vistas, apartados, widgets visibles). Contiene las convenciones visuales aprobadas del proyecto, los apartados de referencia canónicos y la regla de clonado. Se actualiza con cada rechazo/aprobación visual del usuario.
---

# design-system — ORIANA (Healthcare Chatbot)

## Iron Law

**Ningún apartado nuevo se diseña desde página en blanco.** Se parte clonando
la estructura del apartado de referencia más parecido y se adapta. Todo color/
tamaño/radio/sombra sale de las **CSS custom properties de `:root`** en
`index.html` — cero HEX sueltos fuera de `:root`.

## Regla de verificación visual

UI nueva o modificada → **mirarla antes de presentarla**: correr la app
(`python3 oriana-proxy.py` → `http://localhost:8787/oriana-mobile.html`, o
`netlify dev` para el LLM), o screenshot headless con Chrome
(`--headless=new --window-size=480,980 --force-device-scale-factor=2`, encuadra
el teléfono de 430px), autocriticar contra las capturas del Figma, iterar.

## Sistema visual (derivado del Figma "Healthcare Chatbot", 2026-07)

Estética: **limpia, mucho aire, fondo claro, acento VERDE de salud**, cards
redondeadas con sombras muy suaves, tipografía sans redondeada.

### Tokens (`:root` en index.html)
- **Verde:** `--primary:#4EA13D` (rellenos), `--primary-ink:#2E7D32` (TEXTO verde
  sobre blanco — cumple AA 4.5:1), `--primary-strong:#3F8A33` (hover/pressed),
  `--primary-soft:#E6F2E4` (tints/badges), `--on-primary:#FFFFFF`.
- **Neutros:** `--bg:#F6F6F6` (fondo app), `--surface:#FFFFFF` (cards/header/input),
  `--surface-2:#F1F1F2` (tiles), `--border:#ECECEE`.
- **Texto:** `--ink:#1E2022` (alto), `--ink-medium:#8A8D96`, `--ink-low:#ACAFB3`.
- **Estados:** `--success` (=primary), `--warning:#F6C445`, `--error:#E5484D`, `--info:#3E8FB0`.
- **Tipografía:** `--font` (Poppins/SF Rounded → fallback `system-ui`). Escala
  `--fs-display/h1/h2/h3/body/sm/cap` (30/26/20/17/15/13.5/12). Pesos 400/500/600/700.
- **Spacing** base 4px (`--sp-1..8`, `--pad:20`). **Radios** `--r-sm/md/lg/xl/pill`
  (10/14/18/24/999). **Sombras** `--sh-sm/md/lg`.

## Apartados de referencia canónicos

Todo vive inline en `index.html` (= `oriana-mobile.html`). Clonar la estructura
HTML+CSS del apartado más parecido; preservar SIEMPRE los hooks del JS/tests.

| Tipo | Referencia (clonar) | Notas |
|---|---|---|
| **Conversación / chat** | `#screen-chat`: `.msg`/`.bubble`/`.who`/`.chips`/`.chip`/`.typing` | **Referencia canónica.** Bot a la izquierda = avatar `.who` (cuadrado, monograma "O") + **texto plano SIN burbuja**; usuario a la derecha = burbuja `--primary` con texto blanco. Chips pill. |
| **Tarjeta de dato** | `.card` + `.row` + `.badge` (g/a/r) | Superficie, borde suave, `--r-lg`, `--sh-sm`. Badge g=verde(activo), a=ámbar(pendiente), r=rojo. |
| **Lista con ícono** | `.benefit`/`.place` (ícono `--primary-soft` + info + monto) | Beneficios, hospitales/comisarías, Mis reclamos. |
| **Header** | `.hdr` (título en pill `.htitle` centrado) / `.hdr.plain` (título grande) | `.hback`/`.hgear` = círculos `--surface` con `--sh-sm`. |
| **Barra de input** | `.composer .inner` (pill) + `.iconbtn.mic` + `.iconbtn.send` | Send = círculo `--primary`. Táctil ≥44px. |
| **Navegación** | `#tabbar` `.navbtn` (centro `.cwrap` con logo) | Activo en `--primary-ink`. |
| **Pantalla completa/hero** | `#screen-login`, `#screen-home` | Fondo `--bg` claro, título `--ink`, acento/nombre en verde, CTA pill `--primary`. |

**Logo:** estrella (sparkle 4 puntas) con degradé verde `#6BC24C→#2E7D32`, **sin
gota amarilla**. En `#screen-login` (grande, id `lg`) y en el tabbar central (id `lg2`).

## Convenciones aprobadas

- Bot sin burbuja (avatar + texto plano); usuario con burbuja verde a la derecha (2026-07, del Figma).
- **Verde híbrido:** rellenos `#4EA13D` (fidelidad); texto verde sobre blanco `#2E7D32` (AA 4.5:1). Aprobado por el usuario.
- Chips = pill `--surface` + borde, texto `--primary-ink`; `.solid` = relleno verde + texto blanco.
- Español rioplatense en todo texto visible; emojis como íconos livianos de apoyo.
- Accesibilidad: `:focus-visible` (outline verde), táctil ≥44px, ARIA en icon-buttons/inputs.

## Tokens / theming

Cero literales de color nuevos fuera de `:root`. Los nombres viejos (`--teal`,
`--line`, `--muted`, `--ink-soft`, `--n1..3`) siguen como **alias** que apuntan al
sistema nuevo — el markup/JS inline que usa `var(--teal)` etc. toma la paleta nueva
sin romperse. Si falta un token, se agrega a `:root`.

## Rechazos históricos (anti-patrones del usuario)

- Verde del Figma tal cual para TEXTO chico → rechazado por contraste; se usa `--primary-ink` (AA) para texto.
- Gota amarilla en el logo estrella → removida (queda estrella con degradé verde).

## Mantenimiento

Se actualiza en `feature-close`: cada aprobación/rechazo visual se registra acá.
Si una convención cambia, la vieja se borra (no conviven dos verdades).
