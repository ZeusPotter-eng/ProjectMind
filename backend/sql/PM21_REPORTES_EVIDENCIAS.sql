-- PM-21 y Cronograma: ejecutar una sola vez en Supabase ProjectMind.
-- Bucket privado. Ningún archivo es público y no se exponen llaves administrativas.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-evidence','task-evidence',false,10485760,
 ARRAY['application/pdf','image/png','image/jpeg','image/webp','text/plain','text/csv',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=EXCLUDED.file_size_limit,
 allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE TABLE IF NOT EXISTS public.task_evidence(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
 file_name text NOT NULL CHECK(length(file_name) BETWEEN 1 AND 180),
 object_path text NOT NULL UNIQUE,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=10485760),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT task_evidence_path CHECK (object_path LIKE project_id::text || '/' || task_id::text || '/%')
);
CREATE INDEX IF NOT EXISTS task_evidence_by_task ON public.task_evidence(project_id, task_id, created_at DESC);
ALTER TABLE public.task_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_evidence FROM anon;
GRANT SELECT, INSERT ON public.task_evidence TO authenticated;
CREATE POLICY task_evidence_read ON public.task_evidence FOR SELECT TO authenticated
 USING (private.is_project_member(project_id));
CREATE POLICY task_evidence_insert ON public.task_evidence FOR INSERT TO authenticated
 WITH CHECK (uploaded_by=(select auth.uid()) AND private.is_project_member(project_id)
 AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id=t.project_id
             WHERE t.id=task_id AND t.project_id=task_evidence.project_id AND p.status<>'archived'));

-- El path empieza con proyecto/tarea; tanto el proyecto como la tarea deben coincidir.
CREATE POLICY task_evidence_storage_read ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='task-evidence'
 AND EXISTS (SELECT 1 FROM public.projects p
  WHERE p.id::text=split_part(name,'/',1) AND private.is_project_member(p.id)));
CREATE POLICY task_evidence_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK (bucket_id='task-evidence'
 AND EXISTS (SELECT 1 FROM public.tasks t JOIN public.projects p ON p.id=t.project_id
  WHERE t.project_id::text=split_part(name,'/',1)
    AND t.id::text=split_part(name,'/',2)
    AND p.status<>'archived' AND private.is_project_member(p.id)));
-- Reutiliza la auditoría de PM-20: registrar la creación de evidencias.
CREATE TRIGGER trg_pm21_audit_task_evidence AFTER INSERT ON public.task_evidence
 FOR EACH ROW EXECUTE FUNCTION private.pm20_record_activity();
