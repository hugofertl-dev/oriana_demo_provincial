# ui-healthcare-redesign — Rediseño de UI al lenguaje "Healthcare Chatbot"

**Fecha:** 2026-07-07 · **Estado:** done · **Rama:** feature/ui-healthcare-redesign

## Qué se hizo
Rediseño visual completo de la demo ORIANA (todo inline en `index.html`) adoptando
el lenguaje del Figma "Healthcare Chatbot": paleta **verde** (derivada por cuentagotas
de las capturas), fondo claro `#F6F6F6`, cards redondeadas con sombras suaves,
tipografía sans redondeada. Enfoque en 2 fases: (1) design system en tokens `:root`;
(2) aplicar a todas las pantallas consumiendo esos tokens.

## Sistema (tokens `:root`)
Verde `--primary:#4EA13D` (fills) + `--primary-ink:#2E7D32` (texto AA) + `--primary-soft`
+ neutros (`--bg/--surface/--surface-2/--border`) + texto (`--ink/--ink-medium/--ink-low`)
+ estados + tipografía/spacing/radios/sombras. Los nombres viejos (`--teal`, `--line`,
`--muted`, `--n1..3`, `--ink-soft`) quedaron como **alias** apuntando al sistema nuevo,
así el `var()` inline del markup/JS tomó la paleta sin romperse (gran palanca del rediseño).

## Componentes rediseñados
Header (título en pill), **chat** (bot sin burbuja + avatar, usuario en burbuja verde,
chips pill, typing, cards, badges), composer (enviar circular verde), tabbar, home,
login, perfil, benefit/place, turnos, Mis reclamos, eventos/detalle, modales. Logo
estrella con degradé verde `#6BC24C→#2E7D32` (sin gota amarilla).

## Criterios (✅)
Tokens en `:root` sin HEX sueltos; chat replica la composición del Figma; toda la
lógica previa funciona (IDs/handlers preservados, **CSS-first**); `verify.sh full`
verde (44 tests + invariante + syntax); responsive 375/desktop; contraste AA
(`--primary-ink` para texto).

## Decisiones / sustituciones
- Bot sin burbuja (fidelidad al Figma). Verde **híbrido**: fills `#4EA13D` / texto `#2E7D32` (AA).
- Fuente `system-ui` redondeada (sin CDN; Poppins requiere `.woff2` embebido).
- Timestamps no agregados (evitar tocar el JS de render). Avatares con iniciales.
- No 1:1: chips/nav/adjuntar no estaban en las capturas → diseñados consistentes;
  texto blanco sobre verde en fills ~3.2:1 (AA solo texto grande, igual que la referencia);
  fotos de eventos = gradientes placeholder.

## Validación extra
Post-rediseño se validó en vivo (`netlify dev`) que el **chat-LLM sigue funcionando**
(el rediseño solo tocó CSS + SVG del logo + aria-labels; la lógica quedó intacta):
turno en tema, fuera de tema, `action` crear_turno con campos exactos, mandato
territorial Misiones, y derivación 144 por violencia — todos OK.
