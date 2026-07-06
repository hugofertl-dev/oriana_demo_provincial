---
name: security-audit
description: Auditoría de seguridad de código probada en producción (estado 2025-2026) para dos stacks — Node.js/JS (Express + MongoDB + JWT/auth) y Dart/Flutter. Cubre SAST, secrets scanning, CVEs de dependencias, NoSQL injection/JWT, e integración pre-commit vs CI. Usar al armar/revisar gates de seguridad, configurar hooks o decidir qué herramienta correr. Distingue estándar de industria vs nicho y marca los HUECOS reales (Dart SAST). Datos con fuentes primarias.
---

# security-audit — herramientas REALES (2025-2026)

> Hechos verificables, no teoría. Cada tool: madurez, comando, y si es
> **estándar** o **nicho**. Los HUECOS están marcados con `[HUECO]`.
> Fuentes primarias al final.

## Regla de oro: dos capas

- **pre-commit** = rápido (< 2 s), bloqueante, solo sobre archivos staged.
  Va acá: secrets scanning, lint de seguridad sobre el diff.
- **CI** = lento, profundo, sobre todo el repo/historial. Va acá: SAST full,
  CVEs de dependencias, verificación de secretos (live API), container scan.
- Anti-patrón: meter el scan pesado en pre-commit → el dev lo desactiva.

---

## STACK A — Node.js / JavaScript (Express + MongoDB + JWT)

### A1. SAST

| Tool | Madurez 2026 | Estándar/Nicho |
|---|---|---|
| **Semgrep CE** | Maduro, el más usado. Motor OSS (LGPL). | **Estándar** |
| **njsscan** | Maduro (2.5k★), Node-específico, motor semgrep/libsast. | Estándar (Node) |
| **eslint-plugin-security** | Mantenido (v4.0.0 feb-2026), pero **solo piso**. | Estándar como piso |
| **CodeQL** | Muy potente, semántico, pero NO libre en repos privados. | Estándar (enterprise) |

**Semgrep CE — el estándar real, con UNA trampa grande:**
- Comando: `pipx install semgrep` o `brew install semgrep`. Scan:
  `semgrep scan --config p/javascript --config p/owasp-top-ten --error`.
- Rápido (segundos en repos chicos), reglas en YAML legible, SARIF nativo.
- **TRAMPA (diciembre 2024):** Semgrep cambió la licencia de las reglas
  (`p/...`) a *Semgrep Rules License v1.0* — uso interno OK, pero las features
  potentes (cross-file/cross-function dataflow, taint reachability) y muchas
  reglas framework-specific quedaron detrás del plan **Pro (pago)**. La CE sola
  tiene tasa de detección notablemente menor: research 2025 de Semgrep midió
  CE **44-48% true-positive** vs Pro **72-75%** en los mismos sets.
- **Reacción de la industria (enero 2025):** +10 vendors de seguridad forkearon
  el motor en **Opengrep** (drop-in, mismas reglas YAML) por el clampdown. Si el
  uso es comercial/SaaS o se quiere evitar el riesgo de licencia → evaluar
  Opengrep. Para un harness interno, Semgrep CE es legalmente OK.
- **Veredicto:** Semgrep CE para el gate gratis; saber que las reglas de auth
  cross-file (las que más importan para JWT/Mongo) rinden mejor en Pro/CodeQL.

**njsscan — el complemento Node-específico (recomendado en CI):**
- Comando: `pip install njsscan` → `njsscan --sarif -o out.sarif .`.
- Detecta NoSQL injection, command/code injection, XSS, SSRF, crypto inseguro,
  hardcoded secrets, deserialización insegura, falta de CSRF/rate-limiting.
- Action oficial: `ajinabraham/njsscan-action@master`. Buen costo/beneficio.

**eslint-plugin-security — solo piso, no techo:**
- `npm i -D eslint-plugin-security` (flat config: `security.configs.recommended`).
- Solo **14 reglas genéricas**. Benchmark independiente: marcó 21 issues sobre
  12 clases de vuln Node mientras plugins de dominio marcaron 46, **y tiró 5
  falsos positivos** sobre código validado-seguro. Útil porque ya está en el
  pipeline de lint, pero NO da profundidad en SQL/JWT/crypto. No depender de él.

**CodeQL — el más potente, pero ojo con la licencia:**
- CLI gratis SOLO en repos públicos y academia. En repos **privados** exige
  **GitHub Advanced Security (GHAS)** o licencia comercial. Soporta JS/TS.
- Para proyecto privado en GitHub: viable vía Actions si hay GHAS. Standalone
  comercial = caro. No es el gate por defecto de un harness gratis.

### A2. Secrets scanning — `gitleaks` (pre-commit) + `trufflehog` (CI)

Consenso 2025-2026: **correr los dos**, en capas distintas.

| | gitleaks | trufflehog |
|---|---|---|
| Velocidad | **milisegundos** (regex + entropía) | lento (verifica con API calls) |
| Killer feature | velocidad | **verificación**: prueba si el secreto sigue vivo |
| Lugar | **pre-commit** | **CI** (full history) |

- **gitleaks** (estándar pre-commit): `brew install gitleaks`. Hook nativo:
  `gitleaks git --pre-commit --staged` o vía pre-commit framework
  (`repo: https://github.com/gitleaks/gitleaks`). Bypass de emergencia:
  `SKIP=gitleaks git commit`. Bloquea el commit si matchea.
- **trufflehog** (estándar CI verificación): la fase de verificación hace
  llamadas API salientes — en full-history tarda mucho y puede pegar contra
  rate-limits del proveedor. **No** ponerlo en pre-commit de repos grandes.
  CI: `trufflehog git file://. --only-verified`.

### A3. Dependencias / CVEs — `osv-scanner` (Google) + `npm audit` (complemento)

| Tool | Estado | Estándar/Nicho |
|---|---|---|
| **osv-scanner v2** (Google) | Maduro (mar-2025 GA v2), multi-ecosistema. | **Estándar emergente** |
| **npm audit** | Built-in, pero con límites reales. | Estándar (con reservas) |
| **snyk** | Potente, pero free tier muy recortado. | Estándar comercial |

- **osv-scanner** (recomendado, gratis, también sirve para Dart):
  `osv-scanner scan -r .`. v2.0 (marzo 2025) agregó remediación guiada,
  scan de imágenes de contenedor y reportes HTML. Usa la OSV DB (la mayor DB
  open-source: NVD + GitHub + ecosistemas). **Límite:** la remediación guiada
  depende de deps.dev → no resuelve paquetes **privados**.
- **npm audit — límites reales conocidos:** mismos datos OSV/NVD que el resto,
  pero famoso por **sobre-reportar transitivas no explotables** y por
  `npm audit fix` que rompe builds o no puede resolver sin breaking change.
  Útil como red rápida (`npm audit --audit-level=high --omit=dev`), no como
  fuente única de verdad. Preferir osv-scanner para el veredicto.
- **snyk:** soporta npm bien, pero **free tier recortado**: ~100 tests/mes para
  Code (SAST), válido de hecho solo para 1-2 codebases; repos públicos no
  cuentan. Pago ~$25-98/dev/mes. No es base de un gate gratis.

### A4. Específico Express / Mongo / JWT

**NoSQL injection (Mongo):** el riesgo nº1 es input de usuario sin sanitizar
que llega a `findOne`/`find` permitiendo operadores `$gt`/`$ne`/`$regex`/`$where`
(bypass de auth, RCE con `$where` + JS server-side).
- **Detección:** Semgrep (regla `mongodb-nosqli`) + njsscan (clase NoSQL).
- **Prevención (lo que el código DEBE tener):** validación de schema con
  `zod`/`joi` (rechazar claves no esperadas), `express-mongo-sanitize` (quita
  claves que arrancan con `$`/`.`), y **prohibir** `$where`/JS server-side.

**JWT / auth:**
- Riesgo clásico: **secret JWT hardcodeado** → cualquiera forja tokens.
  njsscan + gitleaks lo detectan. Regla: secreto SIEMPRE en env var, nunca en
  código. Verificar también `algorithm` fijado (no `none`, no confusión
  RS256↔HS256) — esto lo pillan reglas semgrep de auth (mejores en Pro).

### A5. Integración (Node)

- **pre-commit:** dos caminos válidos —
  - **husky + lint-staged** (estándar Node-first): hook en `.husky/pre-commit`,
    filtro de staged en la key `lint-staged` de `package.json`. ESLint +
    Prettier solo sobre staged ≈ **1.2 s** en repo de 10k+ líneas (vs >5 s full).
  - **pre-commit framework** (Python, multi-lenguaje): mejor si el monorepo
    mezcla lenguajes; gitleaks tiene hook oficial ahí.
- **En pre-commit (rápido, bloqueante):** gitleaks + eslint(+security) sobre el
  diff. **En CI (lento):** semgrep full + njsscan + osv-scanner + trufflehog
  `--only-verified` + tests. Alinear versiones local↔CI para evitar
  "works locally, fails in CI".

---

## STACK B — Dart / Flutter

### B1. SAST — `[HUECO]` GRANDE, sé honesto

**No existe un SAST de seguridad serio y maduro para Dart.** Es un hueco real
del ecosistema en 2026.

- **`dart analyze` + `custom_lint`** (estándar, pero NO es seguridad): el
  analyzer es excelente para correctitud/estilo vía `analysis_options.yaml`, y
  `custom_lint` permite reglas propias. Pero NO trae reglas de seguridad
  (taint, injection, crypto) listas. Hay que escribirlas a mano.
- **`dart_shield`** (`[NICHO/inmaduro]`): único SAST etiquetado "security" para
  Dart. CLI con reglas tipo `avoid_hardcoded_secrets`. **~5★ en GitHub, 18
  commits** → proyecto experimental, sin tracción ni respaldo. No apto como gate
  bloqueante serio; sí útil como detector extra de secretos hardcodeados.
- **DCM (dcm.dev)** (comercial): el linter más completo de Flutter, pero su foco
  es calidad/complejidad, no vulnerabilidades. No llena el hueco de seguridad.
- **Qué hacer con el hueco:** (1) reglas `custom_lint` propias para los patrones
  que importan (uso de `dart:io` con paths de usuario, `eval`/reflection,
  secretos), (2) apoyarse fuerte en secrets scanning + CVE scanning (que SÍ
  funcionan en Dart), (3) seguir **OWASP MASVS / OWASP Top 10 for Flutter**
  como checklist manual (supply chain M2, almacenamiento inseguro, etc.).

### B2. Secrets scanning — IGUAL que Stack A

gitleaks/trufflehog son agnósticos del lenguaje (escanean texto/git), así que
aplican idénticos al repo Dart/Flutter. Mismo esquema: gitleaks pre-commit,
trufflehog CI. Es la capa que MEJOR funciona para Dart.

### B3. Dependencias / CVEs — `osv-scanner` (única opción real) + `dart pub outdated`

- **`dart pub outdated`** (built-in): solo dice qué está **desactualizado**,
  **NO** es scanner de CVEs. Útil para higiene, no para seguridad.
- **`osv-scanner`** (la opción real, y es buena): soporta el ecosistema **Pub**.
  `osv-scanner scan --lockfile pubspec.lock` o `osv-scanner scan -r .`. Usa OSV
  DB. **Caveat Dart:** el equipo Dart **recomienda NO commitear `pubspec.lock`
  en packages** (sí en apps) — sin lockfile no hay scan; para un package usar
  `--lockfile` apuntando a uno generado en CI. Soporta SARIF.
- GitHub Dependabot/supply-chain **soporta Dart desde oct-2022** → si el repo
  está en GitHub, Dependabot alerts es complemento gratis y automático.
- **snyk** soporta Dart/Flutter para SCA (dependencias). Su **SAST (Snyk Code)
  para Dart está en Early Access y solo en plan Enterprise** → no sirve para el
  hueco SAST gratis.

### B4. Integración (Dart/Flutter)

- pre-commit: hook que corre `dart format --set-exit-if-changed`,
  `dart analyze --fatal-infos`, y **gitleaks** sobre staged. Rápido.
- CI: lo anterior + `osv-scanner scan -r .` (con lockfile) + trufflehog
  `--only-verified` + `dart test`. Usar el **pre-commit framework** (Python) o
  hooks git nativos — husky/lint-staged es Node-first y acá no hay `package.json`.

---

## Tabla resumen (qué correr y dónde)

| Necesidad | Node/JS | Dart/Flutter | pre-commit | CI |
|---|---|---|---|---|
| SAST | Semgrep CE + njsscan | `[HUECO]` custom_lint + MASVS manual | eslint-security (diff) | semgrep/njsscan full |
| Secrets | gitleaks + trufflehog | gitleaks + trufflehog | **gitleaks** | **trufflehog --only-verified** |
| CVEs deps | osv-scanner (+ npm audit) | **osv-scanner** (+ pub outdated) | — | **osv-scanner** |
| Mongo/JWT | semgrep + njsscan + mongo-sanitize | n/a | — | semgrep auth rules |

## Huecos confirmados (no inventar que existen tools que no existen)

1. **`[HUECO]` SAST de seguridad para Dart** — no hay nada maduro. `dart_shield`
   es experimental (~5★). Suplir con custom_lint + secrets/CVE scanning + MASVS.
2. **Snyk Code (SAST) en Dart** = Early Access, solo Enterprise.
3. **Semgrep CE** dejó features clave (dataflow cross-file, reglas auth
   framework) detrás del plan Pro desde dic-2024; alternativa OSS = **Opengrep**.
4. **`npm audit`** sobre-reporta transitivas no explotables; no es fuente única.
5. **`dart pub outdated`** NO es scanner de CVEs (solo versiones).

---

## Fuentes primarias

- Semgrep CE vs Code (research 2025, true-positive rates):
  https://semgrep.dev/blog/2025/security-research-comparing-semgrep-community-edition-and-semgrep-code-for-static-analysis/
- Semgrep cambio de licencia OSS (dic-2024):
  https://semgrep.dev/blog/2024/important-updates-to-semgrep-oss/ ·
  https://semgrep.dev/docs/licensing
- Opengrep (fork, ene-2025):
  https://www.kodemsecurity.com/resources/press-release-security-rivals-unite-to-launch-opengrep-following-semgrep-clampdown
- njsscan (repo): https://github.com/ajinabraham/njsscan
- eslint-plugin-security (repo): https://github.com/eslint-community/eslint-plugin-security
- CodeQL CLI licencia: https://docs.github.com/en/code-security/concepts/code-scanning/codeql/about-the-codeql-cli ·
  https://github.com/github/codeql
- gitleaks (repo): https://github.com/gitleaks/gitleaks
- trufflehog (repo): https://github.com/trufflesecurity/trufflehog
- osv-scanner v2 (anuncio Google, mar-2025):
  https://security.googleblog.com/2025/03/announcing-osv-scanner-v2-vulnerability.html ·
  repo: https://github.com/google/osv-scanner
- osv-scanner para Flutter/Dart (pubspec.lock):
  https://medium.com/@yshean/scan-your-dart-and-flutter-dependencies-for-vulnerabilities-with-osv-scanner-7f58b08c46f1
- GitHub supply-chain soporta Dart (oct-2022):
  https://github.blog/2022-10-06-githubs-supply-chain-security-features-now-support-dart/
- Snyk soporte Dart/Flutter + free tier:
  https://docs.snyk.io/supported-languages/supported-languages-list/dart-and-flutter
- dart_shield (SAST Dart, experimental): https://github.com/yardexx/dart_shield
- dart analyze / custom analysis: https://dart.dev/tools/analysis
- OWASP Top 10 for Flutter (M2 supply chain):
  https://docs.talsec.app/appsec-articles/articles/owasp-top-10-for-flutter-m2-inadequate-supply-chain-security-in-flutter
- NoSQL injection Mongo/Express (prevención):
  https://brightsec.com/blog/nosql-injection-explained-what-it-is-and-how-to-prevent-it/
- pre-commit vs husky/lint-staged (tiempos):
  https://gatlenculp.medium.com/effortless-code-quality-the-ultimate-pre-commit-hooks-guide-for-2025-57ca501d9835
