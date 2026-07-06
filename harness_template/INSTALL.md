# Instalación del harness

Dos caminos: **A** proyecto sin arnés, **B** reestructurar un arnés existente.
En ambos, el resultado final es la estructura del `README.md`.

---

## A. Proyecto nuevo (sin arnés previo)

### 1. Copiar el esqueleto

```bash
cp -r harness_template/{scripts,.claude,progress,docs} <proyecto>/
cp harness_template/feature_list.json.template <proyecto>/feature_list.json
cp harness_template/CLAUDE.md.template <proyecto>/CLAUDE.md
cp harness_template/AGENTS.md.template <proyecto>/AGENTS.md
chmod +x <proyecto>/scripts/*.sh <proyecto>/.claude/hooks/*.sh
```

### 2. Configurar `scripts/verify.sh`

Editar el bloque de variables al inicio. Ejemplos por stack:

| Variable | Flutter | Node | Python |
|---|---|---|---|
| `LINT_CMD` | `flutter analyze` | `npx eslint .` | `ruff check .` |
| `TEST_CMD` | `flutter test` | `npm test` | `pytest` |
| `BUILD_CMD` | `flutter build web` | `npm run build` | `python -m build` |
| `SRC_DIRS` | `lib test` | `src test` | `src tests` |
| `CUSTOM_QUICK` | grep de hardcodes de theme | — | — |

### 3. Completar los placeholders

Buscar `{{` en `CLAUDE.md`, `AGENTS.md` y `.claude/skills/design-system/SKILL.md`
y reemplazar: nombre del proyecto, stack, comandos, ramas protegidas, apartados
de referencia visual.

### 4. Verificar los hooks

```bash
# El gate debe bloquear: ensuciar un archivo de src y pedirle al agente que termine.
# Esperado: el hook Stop corre verify.sh y el agente NO puede cerrar hasta verde.
```

`.claude/settings.json` se versiona en git → todo el equipo hereda los hooks.

### 5. Primera feature de prueba

Pedir algo pequeño de nivel Feature para validar el ciclo completo:
entrevista → criterios → loop → review → cierre → archivo en `progress/archive/`.

---

## B. Reestructurar un arnés existente (pipeline de agentes, checklists, etc.)

> Principio: primero construir lo nuevo al lado, después desmontar lo viejo.
> Nunca al revés.

### Fase 1 — Lo mecánico (sin riesgo, alivio inmediato)

1. Instalar `scripts/verify.sh` + `sabotage_check.sh` y los hooks (pasos A.1–A.4).
2. **Podar la memoria viva**: las entradas cerradas/done salen del
   `feature_list.json` activo hacia `progress/archive/` (un `summary.md` ≤10
   líneas por feature si no existe) + generar `progress/archive/INDEX.md`
   (una línea por feature: id, título, fecha, commit).
3. Conservar `progress/archive/` histórico tal como esté: es la memoria del equipo.

### Fase 2 — Los skills

4. Copiar los 4 skills. Llenar `design-system` con las convenciones visuales YA
   aprobadas del proyecto (rechazos pasados del usuario = primer contenido).
5. Migrar el conocimiento enciclopédico del `CLAUDE.md` viejo a skills
   (un skill por tema: theme, patrones de arquitectura, etc.). El modelo solo
   carga nombre+descripción hasta que lo necesita (progressive disclosure);
   un CLAUDE.md >500 líneas se ignora parcialmente.
6. Reescribir `CLAUDE.md` desde el template: <150 líneas, solo reglas duras +
   triaje + punteros.

### Fase 3 — Memoria compartida

7. Migrar al repo todo conocimiento de proyecto que viva en memorias locales de
   los agentes de cada dev (gotchas → `docs/lessons.md`; convenciones → skills).
8. Establecer `progress/current/<feature_id>.md` como mecanismo único de
   handoff (un archivo por feature; reemplaza notas ad-hoc).

### Fase 4 — Desmontar lo viejo

9. Quitar el binding del pipeline (leader/explorer/implementer/tester o
   equivalentes) del CLAUDE.md. Los agentes de pipeline se borran; los
   specialists de dominio pueden quedar como material de consulta o migrarse
   a skills de referencia.
   **Y barrer lo que se CONSERVA:** los archivos que sobreviven (specialists,
   docs, scripts) suelen referenciar internamente a los roles viejos
   (addendums, "cuando te invoca el Leader", protocolos de I/O). Greppear los
   nombres de los roles viejos sobre todo lo conservado y remover/adaptar esas
   secciones — un specialist que le habla a un leader inexistente confunde a
   las sesiones futuras:
   ```bash
   grep -rli 'leader\|implementer\|explorer' CLAUDE.md .claude/ scripts/ docs/ | grep -v attic
   ```
10. Borrar checklists en prosa que `verify.sh` ya cubre. Lo que el script no
    cubre y sigue importando → o se automatiza, o se agrega como pregunta del
    reviewer, o se descarta conscientemente.
11. Una semana de uso real antes de borrar definitivamente: lo viejo se mueve a
    `attic/` (fuera del contexto del agente) y se elimina cuando lo nuevo probó
    cubrir todos los casos.

### Mapping típico viejo → nuevo

| Arnés viejo | Harness nuevo |
|---|---|
| Leader (orquestador) | Triaje en CLAUDE.md + skills de apertura/cierre |
| Explorer (subagente) | El agente principal explora; subagente Explore solo para búsquedas masivas |
| Implementer (subagente) | El agente principal implementa (puede preguntar al usuario) |
| Tester (subagente) | Tests del propio agente + `sabotage_check.sh` |
| Reviewer dos etapas + veredictos JSON | `reviewer.md` fresco, una pasada, diff + criterios |
| Checkpoints C1–C9 en prosa | `verify.sh` (exit code) + hook Stop bloqueante |
| feature_list.json gigante | feature_list.json vivo + archive/INDEX.md |
| "Pasar outputs literales" | Artefactos: diff, current.md, paths |

---

## Checklist de instalación completada

**Primero lo mecánico:** `scripts/check_install.sh` desde la raíz del proyecto
→ verde (verifica archivos, placeholders, hooks, JSON, tamaño de CLAUDE.md).

Después lo que solo se prueba usando:

- [ ] `verify.sh quick|fix|full` corre y falla cuando debe fallar
- [ ] Hook Stop bloquea el cierre con verificación en rojo (probado)
- [ ] Hook SessionStart inyecta los handoffs de `progress/current/` (probado abriendo sesión nueva)
- [ ] `design-system` tiene al menos los apartados de referencia
- [ ] Un dev distinto clonó el repo y su agente retomó el trabajo sin explicación verbal
