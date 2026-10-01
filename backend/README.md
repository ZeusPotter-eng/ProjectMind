# ProjectMind Backend

Backend FastAPI del MVP de ProjectMind. Incluye configuración, CORS, health check, integración Supabase, adaptador OpenAI/LM Studio, routers de módulos y una consola CRUD administrativa para verificar la base de datos durante desarrollo.

## 1. Crear el entorno

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 2. Configurar variables

Copia `.env.example` como `.env` y agrega tus valores reales. No subas `.env` a Git.

Para usar el CRUD necesitas, como mínimo:

```env
APP_ENV=development
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_SECRET_KEY=TU_SECRET_KEY_DE_BACKEND
CRUD_CONSOLE_ENABLED=true
CRUD_CONSOLE_TOKEN=UN_TOKEN_LOCAL_LARGO_Y_ALEATORIO
```

También se acepta `SUPABASE_SERVICE_ROLE_KEY` como compatibilidad legacy. La llave administrativa nunca debe ir en React/Vite.

Puedes generar el token local así:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 3. Ejecutar

```powershell
uvicorn app.main:app --reload
```

- Health: `http://localhost:8000/api/v1/health`
- Estado CRUD: `http://localhost:8000/api/v1/crud/status`
- Swagger: `http://localhost:8000/docs`

## CRUD de desarrollo

El CRUD cubre 24 tablas del dominio ProjectMind:

`profiles`, `projects`, `project_members`, `project_invitations`, `tasks`, `task_assignees`, `task_dependencies`, `task_updates`, `blockers`, `requirements`, `documents`, `task_requirements`, `document_chunks`, `meetings`, `meeting_participants`, `meeting_transcripts`, `meeting_items`, `ai_runs`, `rag_retrievals`, `ai_suggestions`, `conversations`, `messages`, `project_reports` y `audit_logs`.

Las tablas antiguas que existen en el mismo proyecto Supabase pero pertenecen a otro sistema no se exponen desde este CRUD.

Endpoints:

- `GET /api/v1/crud/resources`
- `GET /api/v1/crud/{recurso}`
- `POST /api/v1/crud/{recurso}/lookup`
- `POST /api/v1/crud/{recurso}`
- `PATCH /api/v1/crud/{recurso}`
- `DELETE /api/v1/crud/{recurso}`

Todos los endpoints administrativos, excepto `/crud/status`, requieren el header `X-CRUD-Token`.

### Seguridad

La consola se bloquea automáticamente cuando `APP_ENV=production`. Está diseñada para pruebas y validación del desarrollo, no como panel administrativo público. La `SUPABASE_SECRET_KEY`/`service_role` permanece exclusivamente en FastAPI.

## IA

`AI_PROVIDER=openai` usa `OPENAI_API_KEY`. Para LM Studio usa `AI_PROVIDER=lmstudio`, inicia su servidor local compatible con OpenAI y configura `LM_STUDIO_MODEL`.
