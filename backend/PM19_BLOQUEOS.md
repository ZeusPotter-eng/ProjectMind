# ProjectMind · PM-19 — Bloqueos e impedimentos

## Alcance

Se implementó un módulo de impedimentos manuales y un bloqueo real de tareas dependientes:

- Registro, listado, lectura, edición, resolución, descarte, reapertura y borrado (solo admin por RLS) de impedimentos.
- Cada impedimento puede vincularse a una tarea del mismo proyecto, o ser general del proyecto (informativo).
- Un impedimento **abierto y vinculado a una tarea**, o una predecesora con estado distinto de `done`, impide pasar a `in_progress`, `review`, `done` y aumentar el porcentaje de avance.
- Es válido editar título, descripción, fechas, responsables, bajar avance o marcar la tarea `blocked` / `todo`. Las predecesoras deben quedar `done`; no basta marcar la dependiente `blocked`.
- Backend rechaza con HTTP 409; el frontend también avisa visualmente, deshabilita las opciones afectadas y explica el motivo.
- Los impedimentos resueltos y descartados ya no bloquean. Pueden reabrirse.
- La protección también se aplica en PostgreSQL mediante triggers, así no puede saltarse haciendo peticiones directas a Supabase.
- Proyectos archivados: lectura permitida; escritura rechazada.
- Los datos de `created_by`, `resolved_by`, `resolved_at` los fija exclusivamente el backend desde el JWT.

## Endpoints nuevos

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/blockers/status` | Estado del módulo |
| GET | `/api/v1/projects/{project_id}/blockers` | Lista paginada |
| POST | `/api/v1/projects/{project_id}/blockers` | Crear impedimento |
| GET | `/api/v1/projects/{project_id}/blockers/{blocker_id}` | Consultar |
| PATCH | `/api/v1/projects/{project_id}/blockers/{blocker_id}` | Editar, resolver, descartar o reabrir |
| DELETE | `/api/v1/projects/{project_id}/blockers/{blocker_id}` | Eliminar (RLS admin) |

Los endpoints existentes de `/projects/{project_id}/tasks` validan bloqueos antes de aceptar un avance.

## Despliegue

1. Integrar el ZIP **backend** conservando rutas relativas (`backend/...`).
2. Ejecutar `python -m pytest -q` desde `backend` y desplegar backend en Render.
3. Confirmar que `/api/v1/blockers/status` devuelve HTTP 200 y que el backend nuevo esté activo.
4. SQL en Supabase `ProjectMind`: **ya aplicado** como migración `pm19_task_blocking_and_impediments`. Archivo de reproducción: `backend/sql/PM19_BLOQUEOS_INTEGRIDAD.sql`. No es necesario ejecutar otra vez en ese proyecto.
5. Integrar ZIP **frontend** conservando rutas (`frontend/...`).
6. Ejecutar `npm ci`, `npm test`, `npm run build` desde `frontend`, luego desplegar.
7. Comprobar `Network` -> `GET /api/v1/projects/{project_id}/blockers` HTTP 200.

## Prueba con `proyecto1`

1. Mantener A = `Definir requisitos del sistema` en `Por hacer`; B = `Desarrollar backend` debe depender de A.
2. Intentar mover B a `En progreso` o subir su avance: el botón/selector debe restringirlo y el backend devolver 409 si se fuerza la petición.
3. Mover A a `Finalizada` (100%); actualizar. B ya podrá pasar a `En progreso`.
4. Entrar a **Bloqueos** y crear `Falta validación del cliente`, vinculado a B, gravedad Alta.
5. Intentar avanzar B: se debe impedir y mostrar ese impedimento.
6. Resolver el impedimento desde **Bloqueos**, actualizar y comprobar que B puede avanzar.
7. Reabrir el impedimento y comprobar que B vuelve a quedar restringida.
8. Comprobar que un impedimento general del proyecto no bloquea automáticamente todas las tareas.

## Verificaciones

- Backend: `python -m pytest -q` (28 pruebas).
- Frontend: `npm test` (19 pruebas).
- Comprobación de sintaxis JSX con parser TypeScript. **No se pudo ejecutar la compilación Vite en este entorno** por fallo al instalar dependencias desde npm; ejecutarla en Windows antes del commit/despliegue.
- Migration y triggers verificados en Supabase; pruebas de extremo a extremo con sesión de usuario y Render siguen pendientes de despliegue.

## Nota de seguridad

- No incluye `.env`, tokens ni carpetas `node_modules` o `.venv`.
- Los permisos de lectura/escritura de Supabase se aplican mediante políticas RLS existentes. No se usa `service_role`.
- Las funciones nuevas de trigger son `security invoker` y usan un bloqueo transaccional de proyecto para sincronizar sus verificaciones con las relaciones de PM-18.
