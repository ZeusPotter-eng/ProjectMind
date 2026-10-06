# ProjectMind Backend

Backend FastAPI del MVP de ProjectMind. La etapa **PM-11 — Configurar Supabase y base de datos** queda preparada para verificar la cadena React → FastAPI → Supabase sin exponer tablas ni llaves administrativas.

## 1. Crear el entorno

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## 2. Configurar variables

Copia `.env.example` como `.env`. Para PM-11 necesitas:

```env
APP_ENV=development
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_PUBLISHABLE_KEY
```

`SUPABASE_PUBLISHABLE_KEY` se usa para operaciones sujetas a RLS. La `SUPABASE_SECRET_KEY`/`service_role` queda reservada exclusivamente para tareas administrativas del backend y nunca debe colocarse en React/Vite.

La copia entregada de PM-11 ya incluye el URL y publishable key del proyecto ProjectMind en el `.env` local. `.env` continúa ignorado por Git.

## 3. Ejecutar

```powershell
uvicorn app.main:app --reload
```

Verificaciones:

- Backend: `http://localhost:8000/api/v1/health`
- Supabase: `http://localhost:8000/api/v1/health/supabase`
- Swagger: `http://localhost:8000/docs`

La ruta `/health/supabase` ejecuta `projectmind_connection_check()` en Supabase. El RPC es `SECURITY INVOKER`, no abre tablas del MVP y no utiliza una llave administrativa.

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "supabase",
  "connected": true,
  "rls_mode": "enabled"
}
```

## Estado de la base de datos

ProjectMind cuenta con 24 recursos de dominio registrados en el backend:

`profiles`, `projects`, `project_members`, `project_invitations`, `tasks`, `task_assignees`, `task_dependencies`, `task_updates`, `blockers`, `requirements`, `documents`, `task_requirements`, `document_chunks`, `meetings`, `meeting_participants`, `meeting_transcripts`, `meeting_items`, `ai_runs`, `rag_retrievals`, `ai_suggestions`, `conversations`, `messages`, `project_reports` y `audit_logs`.

Las 24 tablas tienen RLS habilitado. El rol `anon` no tiene acceso directo a ellas. `pgvector` está instalado para la etapa posterior de RAG.

## CRUD de desarrollo

La consola CRUD sigue disponible para verificaciones administrativas, pero está **deshabilitada por defecto**. Para activarla en desarrollo debes configurar una llave secreta exclusivamente en FastAPI:

```env
SUPABASE_SECRET_KEY=TU_SECRET_KEY_DE_BACKEND
CRUD_CONSOLE_ENABLED=true
CRUD_CONSOLE_TOKEN=UN_TOKEN_LOCAL_LARGO_Y_ALEATORIO
```

También se acepta `SUPABASE_SERVICE_ROLE_KEY` como compatibilidad legacy. Nunca coloques estas llaves en el frontend.

## PM-11

Se considera cerrado cuando:

1. El backend responde `/api/v1/health` con `status=ok`.
2. `/api/v1/health/supabase` responde `connected=true`.
3. El frontend muestra **Backend conectado** y **Supabase conectado**.
4. Las 24 tablas ProjectMind permanecen protegidas por RLS.
