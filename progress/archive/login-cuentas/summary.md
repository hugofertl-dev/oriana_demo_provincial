# login-cuentas — Login con cuentas y persistencia

**Fecha:** 2026-07-06 · **Commit:** b81a82f

## Qué se hizo
Login funcional (email + contraseña) que reemplaza el mockup deshabilitado; pantalla
"Crear cuenta" (email, nombre, apellido, contraseña + repetir) con validaciones;
cuentas y sesión persistidas en localStorage (reabrir entra directo a Inicio);
"Cerrar sesión" en Perfil; Perfil e Inicio muestran nombre/apellido/email e iniciales
de la cuenta; atajo "Iniciar demo como María" con sesión demo persistente.

## Criterios ✅
Los 7 criterios EARS verificados (test funcional headless 11/11 vía http + localStorage real).

## Decisiones / hallazgos clave
- Login SIMULADO (demo): contraseñas en texto plano en localStorage, sin backend — aceptado por el usuario.
- Perfil "híbrido" intencional: nombre/apellido/email de la cuenta; DNI/beneficios/documentos quedan demo.
- FIX de bug pre-existente: `.screen.hidden` no ocultaba `#screen-home`/`#screen-login`
  (display:flex por ID ganaba a la clase) → `display:none!important`.
- Hardening post-review: email sin `<>`, nombre/apellido sin tags, `esc()` en Perfil,
  sesión huérfana vuelve al login.
