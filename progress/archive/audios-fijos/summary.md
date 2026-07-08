# audios-fijos — FASE 5 ítem 18 (pre-generar audios fijos del acompañamiento)

**Fecha:** 2026-07-08 · **Estado:** done · **Commit:** f9a0828

## Qué se hizo
Las frases del flujo de acompañamiento (Línea 144/violencia) son texto FIJO (motor de reglas,
no LLM). Se pre-generan sus MP3 y la app los reproduce en vez de pedir `/api/tts` cada vez →
voz instantánea, sin costo por usuario y consistente en un flujo sensible.

- **Cliente** (`index.html` + espejo): `audioKey(s)` = hash FNV-1a (8 hex) de `speakable(text)`;
  `PREGEN` = Set cargado de `assets/audio/manifest.json` al arranque (fail-open a Set vacío);
  branch en `speak()`: si `PREGEN.has(audioKey(clean))` reproduce `assets/audio/<hash>.mp3` por
  `webAudioPlay` (con `fetchTimeout` → un cuelgue rechaza y activa el fallback); si falta/falla,
  cae a `/api/tts` en vivo. El chat principal (LLM) sigue en vivo.
- **Generador** `scripts/gen-audios.mjs`: reusa `speakable/audioKey/kbSpoken/ninosKB` vía jsdom,
  pide cada MP3 al `/api/tts` del deploy (mismos settings que el cliente → idéntico, sin manejar
  la key). Fuente: 9 frases de flujo (`scripts/audios-fijos.json`) + 5 derivadas de `ninosKB`.
- `kbSpoken()` extraído como fuente única cliente↔generador de las 5 frases de KB.
- 14 audios en `assets/audio/` (3.7 MB) + `manifest.json`.

## Criterios ✅
Los 6 EARS cumplidos (asset cuando hay hash · /api/tts cuando no · fail-safe a vivo si falla ·
mismo pipeline webAudioPlay · hash determinístico cliente=generador · script genera+manifest).

## Verificación
`node test/audios-fijos.test.js` 15/15 (rojo-primero) + `scripts/verify.sh full` verde. Generación
real 14/14 (audio/mpeg). Deploy: manifest + MP3 servidos con `cache-control immutable`. **Verificado
por el usuario en el celular (Safari): las frases del acompañamiento suenan bien e instantáneas.**
Reviewer en contexto fresco: APROBADO; su única observación (fetchTimeout en webAudioPlay) aplicada.

## Cómo regenerar (si se editan textos)
`node scripts/gen-audios.mjs [url]` → regenera MP3s + manifest (cuesta ~14 TTS). Editar un texto sin
regenerar NO rompe: cae solo a `/api/tts` por el hash distinto (nunca suena viejo). Ver `docs/lessons.md`.

## Archivos
`index.html`, `oriana-mobile.html`, `scripts/gen-audios.mjs`, `scripts/audios-fijos.json`,
`assets/audio/*` (14 mp3 + manifest), `test/audios-fijos.test.js`, `scripts/verify.sh`,
`test/eventos-fotos.test.js` (guard de assets/ acepta subdirectorios).
