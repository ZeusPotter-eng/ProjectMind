-- PM-15: endurecer permisos de integrantes existentes; no crea tablas ni elimina datos.
-- Ejecutar una sola vez en Supabase > SQL Editor > ProjectMind. Idempotente.
-- Mantener RLS activo. Conserva el trigger PM-13 que registra al propietario.

begin;

-- Nadie puede cambiar el propietario, reasignar identificadores o superar
-- el límite del MVP. Esta validación se ejecuta incluso en solicitudes
-- directas a la Data API (no solo desde nuestro backend).
create or replace function private.pm15_validate_project_member()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_count integer;
begin
  if tg_op = 'UPDATE' then
    if old.project_id is distinct from new.project_id
       or old.user_id is distinct from new.user_id then
      raise exception 'No es posible cambiar el proyecto ni la identidad del integrante.'
        using errcode = '23514';
    end if;
    if old.role = 'owner' and (new.role is distinct from old.role or new.status is distinct from old.status) then
      raise exception 'No se puede modificar al propietario del proyecto.'
        using errcode = '23514';
    end if;
  end if;

  if new.role = 'owner' and not exists (
    select 1 from public.projects p
    where p.id = new.project_id and p.owner_id = new.user_id
  ) then
    raise exception 'El rol owner está reservado para el propietario original.'
      using errcode = '23514';
  end if;

  if new.status = 'active' and (
    tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status <> 'active')
  ) then
    -- Serializa incorporaciones paralelas al mismo proyecto.
    perform 1 from public.projects p where p.id = new.project_id for update;
    select count(*) into current_count
    from public.project_members pm
    where pm.project_id = new.project_id and pm.status = 'active';
    if current_count >= 15 then
      raise exception 'El máximo del proyecto es de 15 integrantes activos.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.pm15_validate_project_member()
  from public, anon, authenticated;

drop trigger if exists trg_pm15_validate_project_member on public.project_members;
create trigger trg_pm15_validate_project_member
before insert or update on public.project_members
for each row execute function private.pm15_validate_project_member();

-- Solo owner/admin activo puede agregar personas con rol admin o member.
-- El trigger PRIVADO PM-13 registra al propietario con rol owner.
drop policy if exists project_members_insert_admin on public.project_members;
create policy project_members_insert_admin on public.project_members
for insert to authenticated
with check (
  private.is_project_admin(project_id)
  and role in ('admin', 'member') and status = 'active'
);

-- RLS impide editar la fila owner o convertir cualquier fila en owner.
drop policy if exists project_members_update_admin on public.project_members;
create policy project_members_update_admin on public.project_members
for update to authenticated
using (private.is_project_admin(project_id) and role <> 'owner')
with check (private.is_project_admin(project_id) and role <> 'owner');

-- Mantiene la protección del propietario incluso para DELETE directo.
drop policy if exists project_members_delete_admin on public.project_members;
create policy project_members_delete_admin on public.project_members
for delete to authenticated
using (private.is_project_admin(project_id) and role <> 'owner');

commit;

-- Comprobación opcional de solo lectura:
-- select tgname, tgenabled from pg_trigger
-- where tgrelid = 'public.project_members'::regclass
--   and tgname = 'trg_pm15_validate_project_member';
