-- PM-13: registro atómico del propietario al crear un proyecto.
-- Ejecutar UNA SOLA VEZ desde Supabase > SQL Editor > ProjectMind.
-- No recrea tablas ni elimina datos. Puede ejecutarse de nuevo sin duplicar trigger.
-- Utiliza los permisos RLS de la sesión autenticada (SECURITY INVOKER).

begin;

create or replace function private.pm13_add_project_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_pm13_add_project_owner on public.projects;
create trigger trg_pm13_add_project_owner
  after insert on public.projects
  for each row execute function private.pm13_add_project_owner();

commit;

-- Verificación opcional (solo lectura):
-- select tgname from pg_trigger where tgrelid = 'public.projects'::regclass
--   and not tgisinternal and tgname = 'trg_pm13_add_project_owner';
