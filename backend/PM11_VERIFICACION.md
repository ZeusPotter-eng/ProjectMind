# PM-11 — Verificación de cierre

## Tarjeta
**Configurar Supabase y base de datos**

**Área:** Base de datos  
**Prioridad:** Alta  
**Dependencias:** PM-06 y PM-09  
**Entregable:** Base conectada al backend.  
**Criterio de aceptación:** FastAPI conecta y ejecuta una consulta de prueba en Supabase.

## Resultado

- [x] Proyecto Supabase `ProjectMind` identificado y activo.
- [x] Backend configurado con `SUPABASE_URL`.
- [x] Backend preparado para `SUPABASE_PUBLISHABLE_KEY`.
- [x] 24 tablas del dominio ProjectMind detectadas.
- [x] RLS activo en las 24 tablas.
- [x] `pgvector` instalado.
- [x] RPC `projectmind_connection_check()` creado y verificado.
- [x] RPC sin `SECURITY DEFINER`.
- [x] Acceso público general revocado; ejecución concedida explícitamente a `anon`, `authenticated` y `service_role`.
- [x] Endpoint FastAPI `GET /api/v1/health/supabase` implementado.
- [x] Frontend integrado con el endpoint y estado visual de Supabase.
- [x] `.env.example` actualizado.
- [x] `.env` local de backend/frontend preparado.
- [x] Llaves administrativas siguen fuera del frontend.

## Prueba local

Terminal 1:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Resultado esperado en `http://localhost:5173`:

- **Backend conectado**
- **Supabase conectado**

Con esas dos señales PM-11 cumple su criterio de aceptación y puede continuar PM-12.

## Verificación temporal en Render (producción)

Para poder ejecutar la consola CRUD durante la validación de PM-11 sin cambiar `APP_ENV=production`, el backend acepta ahora un interruptor explícito:

```env
APP_ENV=production
ENABLE_CRUD_CONSOLE=true
CRUD_CONSOLE_TOKEN=<token de verificación>
SUPABASE_SECRET_KEY=<secret key solo backend>
```

La consola permanece protegida por dos condiciones adicionales: token correcto en `X-CRUD-Token` y presencia de una llave administrativa únicamente en FastAPI. La variable legacy `CRUD_CONSOLE_ENABLED` se mantiene temporalmente por compatibilidad.

**Cierre de verificación:** una vez terminadas las pruebas CRUD en Render, volver a `ENABLE_CRUD_CONSOLE=false` y `VITE_ENABLE_CRUD_CONSOLE=false`.
