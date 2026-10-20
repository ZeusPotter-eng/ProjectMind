-- PROJECTMIND PM-19 — Protección definitiva de tareas ante impedimentos y dependencias.
-- Idempotente. Requiere tablas public.tasks, public.task_dependencies y public.blockers.
-- No modifica ni borra registros existentes. La app publica sigue usando JWT + RLS.

-- Asegura que un bloqueo manual nunca pueda asociarse a una tarea de otro proyecto.
create or replace function private.pm19_validate_blocker()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.project_id::text, 180018));
  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.project_id = new.project_id
  ) then
    raise exception using errcode = 'PM19P', message = 'El impedimento debe referirse a una tarea de este proyecto.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pm19_validate_blocker on public.blockers;
create trigger trg_pm19_validate_blocker
before insert or update of project_id, task_id, status on public.blockers
for each row execute function private.pm19_validate_blocker();

-- Impide avanzar una tarea por REST, SQL con rol de usuario o backend si aún tiene
-- predecesoras sin finalizar o impedimentos manuales abiertos asociados a ella.
-- Permite editar metadatos, volver a 'Por hacer', marcar 'Bloqueada', o retroceder avance.
create or replace function private.pm19_guard_task_progress()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_guard boolean;
  v_advancing boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.project_id::text, 180018));
  if tg_op = 'INSERT' then
    v_advancing := new.status in ('in_progress', 'review', 'done') or new.progress > 0;
  else
    v_advancing := (new.status in ('in_progress', 'review', 'done')
                     and new.status is distinct from old.status)
                   or (new.progress > old.progress);
  end if;
  if not v_advancing then
    return new;
  end if;

  select
    exists (
      select 1 from public.task_dependencies d
      left join public.tasks predecessor on predecessor.id = d.depends_on_task_id
      where d.project_id = new.project_id and d.task_id = new.id
        and (predecessor.id is null or predecessor.status <> 'done')
    ) or exists (
      select 1 from public.blockers b
      where b.project_id = new.project_id and b.task_id = new.id and b.status = 'open'
    )
  into v_guard;

  if v_guard then
    raise exception using errcode = 'PM19B', message = 'No puedes avanzar: esta tarea tiene predecesoras o impedimentos pendientes.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pm19_guard_task_progress on public.tasks;
create trigger trg_pm19_guard_task_progress
before insert or update of status, progress on public.tasks
for each row execute function private.pm19_guard_task_progress();

-- Optimiza las consultas de impedimentos abiertos al cambiar estado o avance.
create index if not exists blockers_project_task_status_idx
on public.blockers (project_id, task_id, status);
