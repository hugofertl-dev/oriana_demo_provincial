---
name: design-system
description: Usar SIEMPRE antes de crear o modificar UI (vistas, apartados, widgets visibles). Contiene las convenciones visuales aprobadas del proyecto, los apartados de referencia canónicos y la regla de clonado. Se actualiza con cada rechazo/aprobación visual del usuario.
---

# design-system — {{PROJECT_NAME}}

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

| Tipo de vista | Referencia (clonar de acá) | Notas |
|---|---|---|
| {{ej: Lista/admin}} | {{ej: lib/view/pre_save/...}} | {{qué la hace canónica}} |
| {{ej: Ficha/formulario}} | {{path}} | |
| {{ej: Dashboard}} | {{path}} | |

## Convenciones aprobadas

<!-- Cada línea nace de una aprobación o rechazo REAL del usuario. Con fecha. -->

- {{ej: Grid responsive 1/2/3 columnas según screenType — aprobado 2026-XX}}
- {{ej: Fondo `surface`, nunca gris hardcodeado}}
- {{ej: Acento de color por estado del registro}}

## Tokens / theming

- {{ej: Todo color/tamaño/padding sale de Theme.of(context) o ThemeExtension;
  cero literales visuales en widgets — el grep está en verify.sh}}

## Rechazos históricos (anti-patrones del usuario)

<!-- Lo que el usuario ya rechazó NO se vuelve a proponer. -->

- {{ej: ScaffoldMessenger para notificaciones → usar el sistema del proyecto}}
- {{ej: tablas densas sin jerarquía visual}}

<!-- ════════════════════════════════════════════════════════════════════ -->

## Mantenimiento

Este skill se actualiza en `feature-close`: cada aprobación/rechazo visual del
usuario se registra acá. Si una convención cambia, la vieja se borra (no
conviven dos verdades).
