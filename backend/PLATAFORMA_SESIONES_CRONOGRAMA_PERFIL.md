# ProjectMind — Sesiones, cronograma y perfil personal

## Funcionalidades entregadas

1. **Sesión activa.** Indicador de cuenta regresiva y cierre tras **30 minutos sin actividad** (incluidas otras pestañas del mismo origen). Las solicitudes protegidas verifican el plazo local antes de usar o renovar el token. Una advertencia aparece en los últimos 2 minutos. Se conservan en el navegador del usuario los últimos 20 registros de sesiones finalizadas, con su duración media. No se envían estos historiales a Supabase.
2. **Calendario y cronograma tipo Gantt.** Nuevo módulo `Cronograma` con vista por mes o trimestre, barras para `projects.start_date` a `projects.due_date` de duración inclusiva, marca de fecha actual y fracción temporal transcurrida (no confundir con progreso de tareas), detalle por día y proyectos sin fechas. Utiliza `/api/v1/projects` y respeta las reglas RLS existentes. Hasta 500 proyectos autorizados por pantalla.
3. **Perfil personal.** Nuevo módulo `Mi perfil`, endpoint GET/PATCH `/api/v1/profile/me`, campos `full_name`, `job_title`, `bio` y tema visual `avatar_path` (iniciales y seis colores), datos de la cuenta e indicadores del portafolio. Solo permite editar el perfil identificado por Supabase Auth; no acepta `user_id` de la petición ni claves administrativas.

## Base de datos

**No se requiere migración** en la base de datos que verificamos: `public.profiles` tiene los campos utilizados y la política `profiles_update_self` restringe las actualizaciones a `auth.uid()`. `public.projects` ya dispone de `start_date`, `due_date`, `status` y propiedad. Si usan otra instancia distinta, verificar el esquema y las políticas antes de desplegar.

## Límites deliberados

- La inactividad se controla en **el navegador**, no con una política global del servidor de autenticación. JWT ya emitidos podrían continuar válidos hasta su expiración. Para invalidación central de sesiones entre dispositivos se necesitaría configurar políticas de sesión del proveedor y validar sesión en el servidor.
- La media de sesiones no es una métrica empresarial ni una estadística entre dispositivos; es local a cada navegador y solo considera sesiones finalizadas. No registra pulsaciones ni historial detallado.
- El avatar utiliza iniciales y temas de color, **sin subir fotografías**; `avatar_path` se reutiliza como identificador de tema. El formulario no cambia email ni contraseña.
- El cronograma representa fechas **planificadas**, no porcentaje real de trabajo completado. Los proyectos sin ambos extremos se muestran aparte y se pueden editar desde Proyectos.

## Pruebas

```powershell
# Desde backend
.\.venv\Scripts\python.exe -m pytest tests/test_pm13.py tests/test_pm15.py tests/test_profile.py -v

# Desde frontend
npm install
npm test
npm run build
```

El perfil profesional y su paleta visual también están disponibles en el listado de integrantes; se respetan sus permisos de lectura.

El backend publica el router nuevo mediante `app/main.py`, y el frontend consume las mismas credenciales de PM-12. No se incluyen archivos `.env`, paquetes instalados ni claves privadas.
