-- ProjectMind PM-20: actualización ADITIVA y compatible con PM-18/PM-19.
-- Las dependencias ya existentes permanecen estrictas para evitar cambios silenciosos.
-- Ejecutar una sola vez como migración controlada; no elimina tareas/proyectos.
BEGIN;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS methodology text NOT NULL DEFAULT 'hybrid';
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_methodology_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_methodology_check CHECK (methodology IN ('scrum','traditional','hybrid'));
ALTER TABLE public.task_dependencies ADD COLUMN IF NOT EXISTS enforcement text NOT NULL DEFAULT 'strict';
ALTER TABLE public.task_dependencies ADD COLUMN IF NOT EXISTS gate_on text NOT NULL DEFAULT 'both';
ALTER TABLE public.task_dependencies DROP CONSTRAINT IF EXISTS task_dependencies_enforcement_check;
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_enforcement_check CHECK (enforcement IN ('informational','strict'));
ALTER TABLE public.task_dependencies DROP CONSTRAINT IF EXISTS task_dependencies_gate_on_check;
ALTER TABLE public.task_dependencies ADD CONSTRAINT task_dependencies_gate_on_check CHECK (gate_on IN ('start','finish','both'));
ALTER TABLE public.blockers ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT true;

-- No se debe permitir cambiar reglas restrictivas desde un cliente sin privilegios.
DROP POLICY IF EXISTS task_dependencies_insert_member ON public.task_dependencies;
DROP POLICY IF EXISTS task_dependencies_update_member ON public.task_dependencies;
DROP POLICY IF EXISTS task_dependencies_delete_member ON public.task_dependencies;
CREATE POLICY task_dependencies_insert_scoped ON public.task_dependencies FOR INSERT TO authenticated
WITH CHECK (created_by = (select auth.uid()) AND
    (private.is_project_admin(project_id) OR
     (private.is_project_member(project_id) AND enforcement = 'informational')));
CREATE POLICY task_dependencies_update_admin ON public.task_dependencies FOR UPDATE TO authenticated
USING (private.is_project_admin(project_id)) WITH CHECK (private.is_project_admin(project_id));
CREATE POLICY task_dependencies_delete_admin ON public.task_dependencies FOR DELETE TO authenticated
USING (private.is_project_admin(project_id));
DROP POLICY IF EXISTS blockers_insert_member ON public.blockers;
DROP POLICY IF EXISTS blockers_update_member ON public.blockers;
CREATE POLICY blockers_insert_scoped ON public.blockers FOR INSERT TO authenticated
WITH CHECK (created_by = (select auth.uid()) AND
   (private.is_project_admin(project_id) OR (private.is_project_member(project_id) AND NOT is_blocking)));
CREATE POLICY blockers_update_scoped ON public.blockers FOR UPDATE TO authenticated
USING (private.is_project_admin(project_id) OR (private.is_project_member(project_id) AND NOT is_blocking))
WITH CHECK (private.is_project_admin(project_id) OR (private.is_project_member(project_id) AND NOT is_blocking));

-- Reutilizar la validación PM-16: estado done normaliza avance a 100% primero.
CREATE OR REPLACE FUNCTION private.pm19_guard_task_progress()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_start boolean; v_finish boolean; v_advancing boolean; v_dep_count integer; v_block_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.project_id::text, 180018));
  IF TG_OP = 'INSERT' THEN
    v_start := new.status IN ('in_progress','review','done') OR new.progress > 0;
    v_finish := new.status = 'done' OR new.progress = 100;
    v_advancing := v_start OR v_finish;
  ELSE
    v_start := ((new.status IN ('in_progress','review','done') AND old.status NOT IN ('in_progress','review','done'))
            OR (old.progress = 0 AND new.progress > 0));
    v_finish := ((new.status = 'done' AND old.status <> 'done') OR (old.progress < 100 AND new.progress = 100));
    v_advancing := v_start OR v_finish OR new.progress > old.progress
               OR (new.status IN ('in_progress','review','done') AND old.status IS DISTINCT FROM new.status);
  END IF;
  IF NOT v_advancing THEN RETURN new; END IF;
  SELECT count(*) INTO v_block_count FROM public.blockers b
    WHERE b.project_id = new.project_id AND b.task_id = new.id AND b.status = 'open' AND b.is_blocking;
  IF v_block_count > 0 THEN
    RAISE EXCEPTION USING ERRCODE='PM19B', MESSAGE='La tarea tiene impedimentos bloqueantes abiertos.';
  END IF;
  SELECT count(*) INTO v_dep_count
  FROM public.task_dependencies d
  LEFT JOIN public.tasks p ON p.id = d.depends_on_task_id
  WHERE d.project_id = new.project_id AND d.task_id = new.id AND d.enforcement = 'strict'
    AND ((v_start AND d.gate_on IN ('start','both')) OR (v_finish AND d.gate_on IN ('finish','both')))
    AND (p.id IS NULL OR CASE d.dependency_type
      WHEN 'finish_to_start' THEN p.status <> 'done'
      WHEN 'start_to_start' THEN p.status NOT IN ('in_progress','review','done')
      WHEN 'finish_to_finish' THEN p.status <> 'done'
      WHEN 'start_to_finish' THEN p.status NOT IN ('in_progress','review','done')
      ELSE true END);
  IF v_dep_count > 0 THEN
    RAISE EXCEPTION USING ERRCODE='PM19B', MESSAGE='La tarea tiene dependencias obligatorias pendientes.';
  END IF;
  RETURN new;
END;
$$;

-- Política delegada: nunca existen acciones autónomas habilitadas por defecto.
CREATE TABLE IF NOT EXISTS public.ai_project_policies (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  auto_enabled boolean NOT NULL DEFAULT false,
  allowed_auto_actions text[] NOT NULL DEFAULT '{}'::text[],
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_auto_action_allowlist CHECK (
    allowed_auto_actions <@ ARRAY['task.reprioritize','task.reschedule']::text[])
);
ALTER TABLE public.ai_project_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_project_policies FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.ai_project_policies TO authenticated;
DROP POLICY IF EXISTS ai_policies_read ON public.ai_project_policies;
DROP POLICY IF EXISTS ai_policies_write ON public.ai_project_policies;
CREATE POLICY ai_policies_read ON public.ai_project_policies FOR SELECT TO authenticated
USING (private.is_project_member(project_id));
CREATE POLICY ai_policies_write ON public.ai_project_policies FOR INSERT TO authenticated
WITH CHECK (private.is_project_admin(project_id) AND updated_by=(select auth.uid()));
CREATE POLICY ai_policies_update ON public.ai_project_policies FOR UPDATE TO authenticated
USING (private.is_project_admin(project_id))
WITH CHECK (private.is_project_admin(project_id) AND updated_by=(select auth.uid()));

CREATE TABLE IF NOT EXISTS public.ai_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('task.reprioritize','task.reschedule','dependency.policy','project.methodology')),
  arguments jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(arguments)='object'),
  reason text NOT NULL CHECK (length(reason) BETWEEN 8 AND 3000),
  suggested_by text NOT NULL DEFAULT 'projectmind-rules',
  proposed_by uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','rejected','executing','executed','failed')),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_action_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.ai_action_requests TO authenticated;
CREATE INDEX IF NOT EXISTS ai_action_requests_project_status_idx ON public.ai_action_requests(project_id, status, created_at DESC);
DROP POLICY IF EXISTS ai_requests_read ON public.ai_action_requests;
CREATE POLICY ai_requests_read ON public.ai_action_requests FOR SELECT TO authenticated
USING (private.is_project_member(project_id));
CREATE POLICY ai_requests_insert ON public.ai_action_requests FOR INSERT TO authenticated
WITH CHECK (private.is_project_member(project_id) AND proposed_by=(select auth.uid()) AND status='proposed');
CREATE POLICY ai_requests_update ON public.ai_action_requests FOR UPDATE TO authenticated
USING (private.is_project_admin(project_id)) WITH CHECK (private.is_project_admin(project_id));

-- Auditoría de cambios reales con identidades del JWT; historial inmutable para clientes.
-- Función privada SECURITY DEFINER limitada a escrituras en audit_logs; sin SQL dinámico.
CREATE OR REPLACE FUNCTION private.pm20_record_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_project uuid; v_entity uuid; v_actor uuid;
BEGIN
  v_actor := (SELECT auth.uid());
  IF v_actor IS NULL THEN RETURN coalesce(new, old); END IF;
  IF TG_OP = 'DELETE' THEN
    v_project := CASE WHEN TG_TABLE_NAME='projects' THEN old.id ELSE old.project_id END;
    v_entity := CASE WHEN TG_TABLE_NAME='ai_project_policies' THEN old.project_id ELSE old.id END;
  ELSE
    v_project := CASE WHEN TG_TABLE_NAME='projects' THEN new.id ELSE new.project_id END;
    v_entity := CASE WHEN TG_TABLE_NAME='ai_project_policies' THEN new.project_id ELSE new.id END;
  END IF;
  INSERT INTO public.audit_logs(project_id,actor_user_id,actor_type,action,entity_type,entity_id,before_data,after_data,metadata)
  VALUES (v_project,v_actor,'user',lower(TG_OP),TG_TABLE_NAME,v_entity,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(old) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(new) END,
    pg_catalog.jsonb_build_object('source','pm20-audit-trigger'));
  RETURN coalesce(new, old);
END;
$$;
REVOKE ALL ON FUNCTION private.pm20_record_activity() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_pm20_audit_projects ON public.projects;
CREATE TRIGGER trg_pm20_audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();
DROP TRIGGER IF EXISTS trg_pm20_audit_tasks ON public.tasks;
CREATE TRIGGER trg_pm20_audit_tasks AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();
DROP TRIGGER IF EXISTS trg_pm20_audit_dependencies ON public.task_dependencies;
CREATE TRIGGER trg_pm20_audit_dependencies AFTER INSERT OR UPDATE OR DELETE ON public.task_dependencies
  FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();
DROP TRIGGER IF EXISTS trg_pm20_audit_blockers ON public.blockers;
CREATE TRIGGER trg_pm20_audit_blockers AFTER INSERT OR UPDATE OR DELETE ON public.blockers
  FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();
DROP TRIGGER IF EXISTS trg_pm20_audit_ai_requests ON public.ai_action_requests;
CREATE TRIGGER trg_pm20_audit_ai_requests AFTER INSERT OR UPDATE OR DELETE ON public.ai_action_requests
  FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();
DROP TRIGGER IF EXISTS trg_pm20_audit_ai_policies ON public.ai_project_policies;
CREATE TRIGGER trg_pm20_audit_ai_policies AFTER INSERT OR UPDATE OR DELETE ON public.ai_project_policies
  FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();

-- SQL limita permisos; jamás colocar claves administrativas en el frontend.
COMMIT;
