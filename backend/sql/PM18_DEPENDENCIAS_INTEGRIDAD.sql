-- ProjectMind PM-18 — migración incremental sobre la base existente.
-- Esta BD YA posee public.task_dependencies y el trigger
-- trg_validate_task_dependency -> private.validate_task_dependency().
-- Conservamos el trigger y sustituimos solo su función de validación.
-- No crea tablas, no borra registros y no altera los permisos RLS existentes.

create or replace function private.validate_task_dependency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serializa escrituras concurrentes del mismo proyecto, evita ciclos por carrera.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.project_id::text, 180018));

  if new.task_id = new.depends_on_task_id then
    raise exception using errcode = 'PM18P', message = 'Una tarea no puede depender de sí misma.';
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.project_id = new.project_id
  ) or not exists (
    select 1 from public.tasks t
    where t.id = new.depends_on_task_id and t.project_id = new.project_id
  ) then
    raise exception using errcode = 'PM18P', message = 'Ambas tareas deben pertenecer al proyecto.';
  end if;

  -- Recorrer la cadena de predecesoras B -> ... para impedir A -> B si
  -- B ya depende transitivamente de A. UNION evita loops en datos previos.
  if exists (
    with recursive predecessors(task_id) as (
      select new.depends_on_task_id
      union
      select d.depends_on_task_id
      from public.task_dependencies d
      join predecessors p on d.task_id = p.task_id
      where d.project_id = new.project_id and d.id is distinct from new.id
    )
    select 1 from predecessors where task_id = new.task_id
  ) then
    raise exception using errcode = 'PM18C', message = 'Esta dependencia crearía un ciclo.';
  end if;

  return new;
end;
$$;
