-- PM-13: Registro automatico del propietario.
-- Corrige los permisos RLS al crear proyectos.

begin;

create or replace function private.pm13_add_project_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or (select auth.uid()) is distinct from new.owner_id then
    raise exception 'El propietario debe ser el usuario autenticado.'
      using errcode = '42501';
  end if;

  insert into public.project_members
    (project_id, user_id, role, status)
  values
    (new.id, new.owner_id, 'owner', 'active')
  on conflict (project_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.pm13_add_project_owner()
from public, anon, authenticated;

drop trigger if exists trg_pm13_add_project_owner
on public.projects;

create trigger trg_pm13_add_project_owner
after insert on public.projects
for each row
execute function private.pm13_add_project_owner();

commit;
