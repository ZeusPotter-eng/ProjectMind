# PM-15 — Integrantes de proyecto (ProjectMind)

## Alcance implementado

- En cada proyecto aparece el botón **Integrantes**: lista de personas, roles, estado y límite de 15 personas activas (incluido el propietario).
- Cuentas registradas pueden copiar su identificador desde **Copiar mi ID**, junto al botón Cerrar sesión.
- Propietario y administrador activo pueden añadir cuentas **ya registradas**, mediante UUID, como `member` o `admin`.
- Propietario y administradores pueden cambiar rol (`member` / `admin`), retirar (estado `removed`) y reactivar integrantes. El propietario original permanece protegido.
- Los integrantes activos pueden ver el equipo y los proyectos a los que pertenecen; los integrantes normales no pueden gestionar el equipo. Los administradores pueden acceder a los controles para editar/archivar el proyecto desde la ventana de integrantes.
- Proyectos archivados: consulta del equipo, sin altas ni cambios desde esta interfaz.
- El máximo es **15 integrantes activos**. El backend lo revisa y la función SQL protege también operaciones directas a la Data API.

## Seguridad

- Todos los endpoints usan el mismo JWT emitido por Supabase Auth (PM-12). No se usa `service_role` ni se exponen claves privadas.
- Los controles de acceso se comprueban tanto en FastAPI como en políticas RLS de PostgreSQL.
- La migración `backend/sql/PM15_MEMBERS_SECURITY.sql` protege el registro owner, inmutabilidad de identificadores y el límite de 15 integrantes.
- **NO** deshabilites RLS. El SQL de PM-13 debe estar aplicado previamente.
- El UUID no es una contraseña: puede compartirse con el administrador del proyecto, pero no se publican correos ni contraseñas de otros usuarios.

## Nuevas rutas

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/v1/projects/{project_id}/members` | Consultar integrantes (cualquier integrante autorizado) |
| `POST` | `/api/v1/projects/{project_id}/members` | Añadir persona, solo owner/admin |
| `PATCH` | `/api/v1/projects/{project_id}/members/{user_id}` | Cambiar rol/estado, solo owner/admin |

**POST ejemplo**: `{"user_id":"UUID_DE_USUARIO","role":"member"}`. **PATCH ejemplo**: `{"status":"removed"}` o `{"role":"admin"}`.

## Instalación desde los ZIP

1. En VS Code, desde raíz `ProjectMind`, ejecutar `git status` y `git pull --ff-only origin main` si está limpio.
2. Extraer el ZIP completo sobre la **raíz** `ProjectMind` (fusionar carpetas `backend`/`frontend`; no borrar carpetas originales).
3. En **Supabase > SQL Editor > ProjectMind**, pegar **todo** el archivo `backend/sql/PM15_MEMBERS_SECURITY.sql` y ejecutar `Run`. Guardarlo con el código del proyecto en Git.
4. Verificar frontend local: `cd frontend`, `npm install`, `npm run build`, luego `cd ..`.
5. Backend desde raíz: `cd backend`, en Windows usar `.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt` si ya existe `.venv`. Después `.\.venv\Scripts\python.exe -m pytest tests/test_pm13.py tests/test_pm15.py -v`; vuelve a raíz con `cd ..`.
6. Comprobar `git status`; **no añadir** `.env`, `.venv`, `node_modules` ni secretos.
7. Commit sugerido:
   ```powershell
   git add backend/app/main.py backend/app/api/routes/members.py backend/app/schemas/members.py backend/app/services/member_service.py backend/tests/test_pm15.py backend/sql/PM15_MEMBERS_SECURITY.sql backend/PM15_INTEGRANTES_PROYECTO.md frontend/src/api/client.js frontend/src/components/ProjectsPage.jsx frontend/src/components/ProjectMembersPanel.jsx frontend/src/components/members.css frontend/src/components/AuthGate.jsx frontend/src/components/auth.css
   git commit -m "feat(members): implement PM-15 project membership and role-based access"
   git push origin main
   ```
8. En Render verificar que **backend** y **frontend** despliegan el nuevo commit. Si Auto Deploy está deshabilitado, hacer **Deploy latest commit** en ambos.

## Pruebas reales después del despliegue

1. Con cuenta A, abrir Proyectos > Integrantes y confirmar que A figura como propietario.
2. Con cuenta B, pulsar **Copiar mi ID**; entregar el UUID a A (no contraseña).
3. A agrega B como `member`; B actualiza Proyectos y debe visualizar el proyecto compartido, pero no poder añadir/quitar integrantes.
4. A cambia B a `admin`; B actualiza y debe poder administrar integrantes desde la ventana.
5. A retira B; B actualiza Proyectos y ya no debe visualizar el proyecto.
6. A reactiva B. Comprobar que las operaciones de otros proyectos ajenos continúan rechazándose con 403/404.
7. Revisar Render > Logs si hay errores; no pegar tokens ni claves privadas en capturas.

## Límites y siguiente evolución

- **Incorporación mediante UUID, no invitación por correo.** No hay búsqueda global de cuentas por correo ni envío automático de invitaciones. Las personas deben tener una cuenta creada previamente.
- La pertenencia se confirma inmediatamente al agregarla, no exige aceptar una invitación.
- Para el MVP se gestionan roles `owner` (único), `admin` y `member`; no se elimina físicamente la membresía al retirarla.
- La prueba de integración con Supabase de producción queda pendiente hasta que se ejecute el SQL y se prueben cuentas reales. Las pruebas automáticas trabajan con dobles de prueba, no modifican datos reales.
