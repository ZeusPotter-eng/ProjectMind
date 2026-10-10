# PM-13 — Gestión de proyectos | ProjectMind

**Base:** los ZIP `backend(6).zip` y `frontend(6).zip`. Este ajuste conserva PM-11, PM-12, el dashboard oscuro y la consola CRUD de verificación.

## ¿Qué se implementó?

- **Backend:** API de proyectos autenticada (`/api/v1/projects`) y validación de campos/fechas. Solo se usa la clave pública de Supabase con el JWT del usuario; Supabase aplica RLS.
- **Frontend:** pantalla **Proyectos** conectada a la API, con listado paginado, búsqueda y filtro sobre la página actual, creación, edición, archivado y consulta de archivados. Los proyectos compartidos sin propiedad se muestran inicialmente en modo lectura.
- **Sesión:** renovación del JWT al solicitar datos si está próximo a expirar.
- **Base de datos:** un trigger nuevo para insertar automáticamente al propietario como integrante de su proyecto en la MISMA transacción de creación. No se crean ni destruyen tablas.
- **Pruebas:** `backend/tests/test_pm13.py` comprueba los flujos de la API mediante dobles de prueba y no toca datos reales.

## Dependencias y tablas verificadas

Las tablas `public.projects`, `public.project_members` y `public.profiles` ya existen en Supabase **ProjectMind**. También existen las políticas RLS relevantes. El propietario necesita pertenecer a `project_members` para poder editar/archivar según la política de la base de datos. Por eso **debes ejecutar** el SQL incluido ANTES de crear proyectos desde el frontend.

## PASO 1 — SQL (una sola vez)

1. Entrar en [Supabase Dashboard](https://supabase.com/dashboard) → proyecto **ProjectMind**.
2. Abrir **SQL Editor** → **New query**.
3. Copiar **todo** el archivo `backend/sql/PM13_PROJECT_OWNER_TRIGGER.sql` y pulsar **Run**.
4. Opcional: ejecutar la consulta de verificación incluida al final del archivo SQL.

> No hemos ejecutado este SQL desde ChatGPT. Revísalo con el equipo antes de aplicarlo sobre el proyecto compartido.

## PASO 2 — Copiar archivos de los ZIP

Los ZIP entregados tienen la estructura `backend/...` y `frontend/...`. Deben extraerse en la **carpeta raíz `ProjectMind`**: NO los extraigas dentro de `backend` o `frontend`, porque se duplicarían los directorios.

No copiar `node_modules` ni archivos `.env`.

## PASO 3 — Comprobar localmente

Backend, desde `ProjectMind/backend`:

```powershell
pip install -r requirements-dev.txt
python -m pytest tests/test_pm13.py -q
uvicorn app.main:app --reload
```

En otra terminal, desde `ProjectMind/frontend`:

```powershell
npm install
npm run build
npm run dev
```

Abre `http://localhost:5173` e inicia sesión. Para ello tu backend debe estar configurado con `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en `.env`.

## PASO 4 — GitHub

Desde la carpeta raíz `ProjectMind`:

```powershell
git status
git add backend/app/api/routes/projects.py backend/app/schemas/projects.py backend/app/services/project_service.py backend/sql/PM13_PROJECT_OWNER_TRIGGER.sql backend/tests/test_pm13.py backend/requirements-dev.txt backend/PM13_GESTION_PROYECTOS.md frontend/src/App.jsx frontend/src/api/client.js frontend/src/components/AuthGate.jsx frontend/src/components/ProjectsPage.jsx frontend/src/components/projects.css
git commit -m "feat(projects): implement PM-13 authenticated project management with RLS"
git push origin main
```

Si el equipo está trabajando a la vez, revisen antes `git status`, la rama y los cambios remotos; no fuerces `git push`.

## PASO 5 — Render y verificación

1. Revisar Deploys del backend y frontend; deben usar el nuevo commit (Auto-Deploy o Deploy latest commit).
2. No se requieren **nuevas** variables de entorno: se aprovecha el backend que ya tiene PM-12.
3. Abrir ProjectMind, iniciar sesión y elegir **Proyectos** en el menú.
4. Crear un proyecto con nombre y objetivo, comprobar que aparece en el listado.
5. Editarlo, cambiarlo a **Activo**, guardar y recargar; comprobar persistencia.
6. Archivarlo y habilitar **Incluir archivados**; confirmar que puede consultarse.
7. En Supabase → Table Editor revisar `projects` y `project_members`, sin editar manualmente los datos.

## Endpoints

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/v1/projects` | Lista paginada, excluye archivados salvo `include_archived=true` |
| GET | `/api/v1/projects/{id}` | Consulta un proyecto accesible |
| POST | `/api/v1/projects` | Crea proyecto y asigna `owner_id` al usuario autenticado |
| PATCH | `/api/v1/projects/{id}` | Edita campos permitidos, si RLS lo autoriza |
| PATCH | `/api/v1/projects/{id}/archive` | Archiva sin borrar datos |

Todos exigen `Authorization: Bearer <access_token>` salvo `/status`. No existe DELETE permanente en PM-13.

## Limitaciones honestas

- El SQL aún debe aplicarse por el equipo en Supabase; una compilación correcta por sí sola NO prueba conexión real ni políticas RLS.
- La administración de invitaciones/miembros será otra etapa; en PM-13 el creador queda como propietario.
- Las búsquedas y filtros del frontend se aplican **solo sobre los registros de la página cargada**; paginación de 20 en 20.
- No coloques `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ni `CRUD_CONSOLE_TOKEN` en `VITE_...`.
- Si la consola CRUD de verificación continúa activada públicamente, deshabilítala al terminar las pruebas (no forma parte de este módulo de usuarios).
