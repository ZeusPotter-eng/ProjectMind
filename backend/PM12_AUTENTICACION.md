# PM-12 — Autenticación de usuarios

## Alcance
Supabase Auth: registro, correo de verificación si está habilitado, inicio de sesión, renovación de tokens, consulta de identidad y cierre de sesión. El frontend bloquea la interfaz hasta verificar la sesión.

## Configuración
En Render backend: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `FRONTEND_ORIGIN` con el origen exacto del frontend, sin slash final. Habilita el proveedor Email en Supabase Authentication y configura Site URL y Redirect URLs del dominio del frontend para la confirmación por correo. No coloques `SUPABASE_SECRET_KEY` en Vite.

En frontend: `VITE_API_URL` debe apuntar a la ruta `/api/v1` del backend. Reconstruir/redeployar en Render.

## Verificación manual
1. GET `/api/v1/auth/status` devuelve `configured: true`.
2. Registrar correo nuevo; con confirmación habilitada se solicita verificar email.
3. Iniciar sesión; recargar y comprobar renovación de sesión y nombre de usuario.
4. Cerrar sesión; se oculta la interfaz privada.
5. Intentar credenciales incorrectas y revisar error.

## Seguridad y siguientes tareas
La sesión se conserva en localStorage y el refresh token se renueva al cargar. Para mayor seguridad en producción, mover tokens a cookies HttpOnly Secure SameSite y establecer protección CSRF. La capa visual no sustituye autorización: los endpoints existentes de projects/tasks/etc. y la consola CRUD deben validar usuario, pertenencia a proyecto y roles en backend antes de habilitarse para datos reales. **NO habilites la consola CRUD de verificación públicamente**: actualmente `VITE_CRUD_CONSOLE_TOKEN` queda expuesto al navegador. No se incluye migración SQL: Supabase Auth usa `auth.users` preexistente; se debe revisar la integración de `public.profiles`/RLS en la siguiente etapa.
