# ProjectMind Frontend

Frontend React + Vite del MVP de ProjectMind. Para PM-11 muestra tanto el estado de FastAPI como el estado real de Supabase consultado a través del backend.

## 1. Instalar

No copies `node_modules` entre equipos. Instala las dependencias a partir del lockfile:

```powershell
npm install
```

## 2. Configurar `.env`

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_ENABLE_CRUD_CONSOLE=false
VITE_CRUD_CONSOLE_TOKEN=
```

El frontend **no necesita ni debe contener** `SUPABASE_SECRET_KEY`, `service_role` ni claves de OpenAI.

## 3. Ejecutar

```powershell
npm run dev
```

Abre `http://localhost:5173`.

En **Configuración del sistema → Supabase / PostgreSQL** debe aparecer:

**Supabase conectado**

Eso confirma el flujo:

`React → FastAPI → Supabase → RPC de diagnóstico → FastAPI → React`

## Consola CRUD

La consola CRUD es una herramienta separada de desarrollo. Solo se habilita cuando el backend dispone de una llave administrativa y un token local. PM-11 no expone esa llave en Vite.
