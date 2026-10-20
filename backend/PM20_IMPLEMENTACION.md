# ProjectMind PM-20 — Metodologías e inteligencia con permisos

## Qué incluye

**Integración sobre PM-19, no proyecto nuevo.** Se incorpora metodología en cada proyecto (`scrum`, `traditional`, `hybrid`); dependencias `informational` o `strict`, con verificación en `start`, `finish` o `both`; impedimentos informativos o bloqueantes; protección en FastAPI y triggers de PostgreSQL. Los tipos de relación admitidos son fin-inicio, inicio-inicio, fin-fin e inicio-fin. Se preserva la prevención de ciclos PM-18.

**Capacidades inteligentes reales incluidas:** análisis contextual de tareas, fechas, dependencias, impedimentos y actividad; motor determinista de recomendaciones; análisis narrativo opcional OpenAI / LM Studio usando contexto autorizado; propuestas de cambio tipadas; aprobación/rechazo humana; ejecución backend con JWT del usuario, revalidación de RLS y auditoría; delegación autónoma opt-in, únicamente para re-priorización y reprogramación, y desactivada de forma predeterminada. Acciones de cambio de metodología o restricciones siempre requieren aprobación de un administrador. El LLM no ejecuta SQL ni recibe credenciales administrativas.

**No constituye aún una IA de vigilancia continua o un sistema completo de Sprints.** Para siguientes etapas faltan planificación de Sprint, Product Backlog/Sprint Backlog, hitos, métricas predictivas, motor de eventos programado, herramientas adicionales y estrategias de recuperación/rollback de acciones. El esquema actual deja la estructura para ampliar las acciones sin saltarse las reglas.

## Archivos

- `backend/app/schemas/projects.py`, `dependencies.py`, `blockers.py`: contratos ampliados.
- `backend/app/schemas/intelligence.py`: lista permitida de acciones/parametrización validada.
- `backend/app/api/routes/{projects,dependencies,tasks,blockers,assistant,intelligence}.py`: API segura.
- `backend/app/services/{blocker_service,task_service}.py`: validación previa, coincidencia con el SQL y códigos HTTP.
- `backend/app/main.py`: nueva ruta `/api/v1/projects/{project_id}/intelligence`.
- `backend/sql/PM20_METODOLOGIAS_Y_CONTROL_IA.sql`: copia consolidada del esquema migrado.
- `frontend/src/components/{ProjectsPage,TasksPage,DependencyManager,BlockersPage,IntelligencePage}.jsx` y CSS correspondientes.
- `frontend/src/utils/{blockers,dependencies}.js`, `frontend/src/api/client.js`, `frontend/src/App.jsx`.
- Pruebas de Python y Node añadidas/actualizadas.

## Base de datos

Migraciones realizadas **en Supabase ProjectMind**; no vuelvas a importar SQL para ese proyecto. Se añadieron `projects.methodology`, `task_dependencies.enforcement`, `task_dependencies.gate_on`, `blockers.is_blocking`, `ai_project_policies`, `ai_action_requests`, políticas RLS y seis triggers de auditoría. Se modificó la validación de avance en la función `private.pm19_guard_task_progress()`.

**Compatibilidad:** los proyectos que ya existían reciben `hybrid` como valor inicial, sin inferir que ese fuera su método anterior. **Las dependencias existentes siguen `strict` / `both`**, evitando reducir silenciosamente controles ya activos. Los impedimentos anteriores siguen siendo bloqueantes. Para cambiar una relación antigua, entra como propietario o administrador a Dependencias y edítala. Ninguna fila de tareas ni de dependencias se eliminó.

## Instalación en VS Code (Windows)

1. Haz respaldo o commit del estado actual de tu repositorio. Descarga el ZIP combinado `ProjectMind_PM20_ajuste_completo.zip` y extráelo en la **raíz** de `ProjectMind`, conservando la estructura `backend/` y `frontend/`; confirma el reemplazo de archivos homónimos. Los ZIP por carpeta son una alternativa, **no se deben instalar ambos y el combinado a la vez**.
2. No copies archivos `.env`, `.venv`, `node_modules`, `dist`, claves Supabase ni otras credenciales: no están incluidos en estos ZIP.
3. Verifica y publica **primero el backend**. Desde la raíz de ProjectMind:

```powershell
cd backend
python -m pytest -q
cd ..
git status
git add backend
git commit -m "feat(pm20-backend): habilitar metodologias y ejecucion de IA con permisos"
git push
```

4. En Render, espera a que termine el deploy de `projectmind-api`. Abre `https://projectmind-api.onrender.com/openapi.json` para verificar que aparecen los endpoints `/api/v1/projects/{project_id}/intelligence`. No despliegues el frontend hasta confirmarlo.
5. Prueba y publica el **frontend**:

```powershell
cd frontend
npm ci
npm test
npm run build
cd ..
git add frontend
git commit -m "feat(pm20-frontend): conectar metodologias bloqueos e inteligencia contextual"
git push
```

6. Comprueba que Render termine el deploy del frontend después del backend. Si el servicio no se actualiza automáticamente, utiliza `Manual Deploy > Deploy latest commit`. Las variables existentes como `VITE_API_URL` deben seguir apuntando al backend actualizado.
7. Para análisis con modelo, define `OPENAI_API_KEY` en **Render / servicio backend** y `AI_PROVIDER=openai`, o configura el endpoint de LM Studio accesible desde Render. No pongas API keys secretas en variables `VITE_`.

## Validación en `proyecto1`

1. Abre Proyectos, edita `proyecto1`, observa la metodología inicial `Híbrida`. Guarda explícitamente la deseada.
2. En Dependencias, abre `Desarrollar backend`. Su relación antigua con `Definir requisitos del sistema` aparece **Obligatoria / Inicio y finalización** (se conservó).
3. Crea una dependencia informativa de prueba o cambia esa relación a `Informativa` siendo administrador. Comprueba que aparece advertencia sin prohibir avanzar. Revierte si corresponde.
4. Cambia a `Obligatoria / Restringir inicio`. Con predecesora pendiente, comprueba que `Desarrollar backend` no puede comenzar. En `Restringir finalización`, puede comenzar pero no cerrar mientras A esté pendiente.
5. En Bloqueos, añade un impedimento informativo y confirma que no frena el avance. Cambia a bloqueante y confirma HTTP 409 al intentar avanzar. Resuelve el impedimento.
6. Abre `Propuestas IA` / `Asistente IA`; selecciona el proyecto; ejecuta análisis. Revisa actividad y propuestas. Si hay propuesta, apruébala con rol admin y comprueba el resultado.
7. En Permisos IA, deja `auto_enabled=false` por defecto. Habilítalo **solo si deseas delegar explícitamente** repriorización y/o reprogramación. Cada operación conserva JWT, RLS y registro de la solicitud.
8. En Network deben responder `200` los GET/POST autenticados, sin errores 404 en rutas `/intelligence`, `/tasks`, `/dependencies`, `/blockers`.

## Verificación realizada

- `python -m pytest -q`: **40 pruebas aprobadas** de backend.
- `node --test`: **23 pruebas aprobadas** de frontend.
- `python -m compileall`: sin errores de sintaxis en backend.
- Supabase: migraciones aceptadas; RLS, nuevas tablas y seis triggers activos; se mantienen dos proyectos, tres tareas y una dependencia.
- **Pendiente**: `npm run build` con dependencias instaladas y pruebas integradas con JWT real en Render. En este entorno no se pudo ejecutar Vite porque los paquetes no están disponibles (y `npm ci --offline` falló por caché incompleta). No se debe declarar esa comprobación como superada.

## Riesgos y límites de seguridad

- El código enviado contiene solo archivos completos y no credenciales; toda escritura inteligente pasa por operaciones enumeradas con referencias limitadas al proyecto.
- El análisis del modelo puede equivocarse; sus propuestas se revalidan. Cambios que alteran metodología y dependencias no se ejecutan automáticamente.
- Los permisos reales dependen también de las políticas RLS (que prevalecen incluso si la UI deja un control visible).
- La auditoría nueva registra cambios desde su instalación en adelante; no reconstruye eventos anteriores.
- Las aprobaciones actuales registran resultado y autor, pero operaciones más complejas exigirán compensaciones/rollback antes de incluirse en autonomía futura.
