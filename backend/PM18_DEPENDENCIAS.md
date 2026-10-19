# PM-18 — Dependencias entre tareas (ProjectMind)

## Alcance implementado

- `GET /api/v1/dependencies/status` informa el estado del módulo.
- `GET /api/v1/projects/{project_id}/dependencies?limit=100&offset=0` lista, con paginación y contador.
- `GET /api/v1/projects/{project_id}/dependencies/{id}` consulta una relación.
- `POST /api/v1/projects/{project_id}/dependencies` crea una relación `finish_to_start`.
- `PATCH /api/v1/projects/{project_id}/dependencies/{id}` cambia su predecesora.
- `DELETE /api/v1/projects/{project_id}/dependencies/{id}` elimina **solo la relación**, no la tarea.

Las peticiones envían `Authorization: Bearer <access_token>` del usuario. Todos los accesos mantienen JWT, comprobación de pertenencia al proyecto y RLS de Supabase. Los proyectos archivados son de solo lectura. La API obtiene `created_by` del token, nunca del cliente.

## Contrato de creación

```json
{
  "task_id": "UUID-DE-LA-TAREA-DEPENDIENTE",
  "depends_on_task_id": "UUID-DE-LA-PREDECESORA",
  "dependency_type": "finish_to_start"
}
```

Una tarea A que depende de B no está **lista** hasta que B tenga estado `done`. Este módulo **muestra** las condiciones pendientes; no cambia automáticamente el estado ni impide iniciar o completar una tarea. Ese bloqueo de flujo corresponde a **PM-19**.

## Reglas y seguridad

- No admite autorreferencias, relaciones duplicadas, tareas de otros proyectos, ciclos directos o transitivos.
- El backend comprueba el grafo completo, paginando por grupos de 500 relaciones.
- La migración `sql/PM18_DEPENDENCIAS_INTEGRIDAD.sql` mejora el trigger **ya existente** `private.validate_task_dependency()` en Supabase. Emplea bloqueo transaccional por proyecto y verificación recursiva en PostgreSQL para evitar ciclos ante escrituras simultáneas. No altera tablas ni RLS.
- Esta migración se aplicó al proyecto Supabase **ProjectMind** el 19 de octubre de 2026. Si se instala en otro entorno, ejecutar dicho SQL una vez.

## Frontend

Tanto **Tareas** como **Dependencias** del menú muestran el módulo funcional. En cada tarjeta pulsa **Ver dependencias** para:

1. Añadir una tarea predecesora del mismo proyecto.
2. Editar o quitar una dependencia existente.
3. Revisar tareas sucesoras y requisitos pendientes/completados.
4. Filtrar tareas por predecesoras listas, pendientes o inexistentes.

La ventana impide elegir una relación circular antes de enviar, y la API/SQL vuelven a verificar. La lista global usa paginación para no excluir tareas fuera de la primera página.

## Comprobación local

```powershell
# Desde la raíz del repositorio
cd backend
pip install -r requirements.txt
pip install -r requirements-dev.txt
python -m pytest -q

cd ../frontend
npm install
npm test
npm run build
```

Si la app corre en Render, subir **los archivos modificados de backend y frontend** al repositorio y hacer commit/push. Render desplegará según la configuración de cada servicio. **Nunca subir `.env`, `.venv` o `node_modules`.**

## Prueba manual de extremo a extremo

1. Iniciar sesión y abrir un proyecto activo con al menos tres tareas.
2. En *Dependencias*, seleccionar A y agregar B como predecesora.
3. Verificar que A muestre `Espera 1 tarea` y B la incluya como sucesora.
4. Marcar B *Finalizada* desde *Tareas*: A debe mostrar `Predecesoras finalizadas`.
5. Intentar agregar B como dependiente de A: se debe impedir el ciclo.
6. Intentar usar una tarea de otro proyecto, o una tarea como su propia predecesora: rechazo.
7. Editar y después borrar la relación; las dos tareas deben conservarse.
8. Archivar el proyecto y comprobar modo solo lectura.

Pruebas automatizadas incluidas en `tests/test_pm18_dependencies.py` y `frontend/tests/dependencies.test.mjs`. No crean ni alteran tareas de producción.
