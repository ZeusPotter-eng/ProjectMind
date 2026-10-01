# ProjectMind Frontend

Frontend React + Vite del MVP de ProjectMind. Incluye comprobación del backend, resumen de módulos, integrantes y una consola CRUD para verificar la base de datos desde el navegador durante desarrollo.

## 1. Instalar

```powershell
npm install
```

## 2. Configurar `.env`

Copia `.env.example` como `.env`:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_ENABLE_CRUD_CONSOLE=true
VITE_CRUD_CONSOLE_TOKEN=EL_MISMO_VALOR_DE_CRUD_CONSOLE_TOKEN_DEL_BACKEND
```

`VITE_CRUD_CONSOLE_TOKEN` es únicamente el token local que protege la consola de desarrollo. Nunca coloques `SUPABASE_SECRET_KEY`, `service_role` ni claves de OpenAI en el frontend.

## 3. Ejecutar

```powershell
npm run dev
```

Abre `http://localhost:5173`.

## Probar CRUD

En la sección **CRUD · Verificación** podrás:

- Seleccionar cualquiera de las 24 tablas de ProjectMind.
- Consultar registros.
- Crear registros con un editor JSON y campos obligatorios sugeridos.
- Editar registros existentes.
- Eliminar registros con confirmación.
- Trabajar correctamente con claves primarias simples y compuestas.

Las llaves foráneas deben apuntar a registros existentes. Por ejemplo, antes de crear una tarea debe existir el proyecto y el usuario indicado en sus campos relacionados.
