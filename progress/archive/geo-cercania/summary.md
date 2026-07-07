# geo-cercania — Geolocalización para hospital/comisaría más cercano

**Fecha:** 2026-07-07 · **Estado:** done · **Rama:** feature/geo-cercania

## Qué se hizo
Reemplazó el flujo "más cercano" (que pedía barrio con chips y usaba coords `xy` falsas)
por **geolocalización real**:
- Al elegir hospital/policía cercano → **modal de permiso de ubicación** (clonado del patrón
  del micrófono). Permitir → `getCurrentPosition` → distancia **haversine** desde coords
  reales de Posadas (DB ahora tiene `ll:[lat,lng]`). **Híbrido:** si el usuario está a >100 km
  de Posadas, ancla a Posadas y muestra distancia plausible ("aprox."). Negar → instrucciones
  para habilitar (como el mic). Escribir dirección → reconoce barrio/localidad de Misiones o
  ancla Posadas. **Sin geocoding externo.**
- Pantalla **Cerca** consistente (usa la misma `geoRef`/haversine).

## Integración con el LLM (encontrada al validar en vivo)
- El LLM contestaba el "más cercano" desde el barrio, sin abrir el modal. Fix: chat.js emite
  `action.type: ubicacion_cercana{kind}` (no calcula la distancia el modelo) y el frontend
  (`ejecutarAccion`) abre el modal. Sugerencias vacías en ese caso (sin chips duplicados).
- **Inferencia de contexto:** `recordLLM` registra en `llmHistory` lo que resuelve el motor
  local (resultado geo + acción de la usuaria) para que el LLM infiera en el próximo turno
  (ej.: tras mostrar el más cercano, al pedir turno ofrece ese hospital). + instrucción de
  inferencia en el system prompt.
- **Privacidad:** las coords reales del usuario NO se envían al servidor; se usan client-side
  para la distancia. A `llmHistory` solo va una nota tipo "(compartí mi ubicación)".

## Manejo de error del LLM (pedido del usuario)
Antes: 1 error → caía en silencio a regex y deshabilitaba el LLM toda la sesión. Ahora:
error transitorio → aviso "problema de conexión 📡" + chip **Reintentar** (reenvía el mensaje),
SIN degradar; se resetea al responder bien; tras **3 fallos consecutivos** → modo básico (regex)
con aviso, para que la demo no quede trabada. El turno fallido se saca del historial y se reintenta limpio.

## Ajuste incluido
Texto en Inicio bajo el botón: "ORIANA usa IA y puede cometer errores" / "DEMO - MISIONES".

## Criterios (✅) y verificación
Modal de ubicación; distancia haversine real/anclada; instrucciones si niega; dirección tipeada;
no rompe turnos/reclamos/'ver todos'/911/Cerca. `verify.sh full` verde: **62 tests** (13 geo +
3 de error de conexión + los previos) + invariante + syntax. Validado en vivo (netlify dev):
delega al modal, calcula distancia real, infiere el contexto, y muestra el aviso de conexión.

## Nota
El usuario dejó 6 imágenes en `assets/` (fotos de eventos, ~10 MB) NO referenciadas aún —
quedaron untracked, fuera de este commit (feature aparte a futuro: fotos reales de eventos).
