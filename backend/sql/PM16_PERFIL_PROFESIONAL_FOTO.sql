-- ProjectMind: ampliación ADITIVA del perfil. No elimina ni modifica filas existentes.
-- Ejecutar una sola vez en SQL Editor si no se aplicó aún desde ChatGPT.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS company text,
    ADD COLUMN IF NOT EXISTS department text,
    ADD COLUMN IF NOT EXISTS location text,
    ADD COLUMN IF NOT EXISTS website text,
    ADD COLUMN IF NOT EXISTS skills text;

COMMENT ON COLUMN public.profiles.company IS 'Empresa o institución (visible para compañeros con permiso de perfil).';
COMMENT ON COLUMN public.profiles.department IS 'Área o departamento profesional.';
COMMENT ON COLUMN public.profiles.location IS 'Ciudad o ubicación general compartida voluntariamente.';
COMMENT ON COLUMN public.profiles.website IS 'Enlace profesional público, validado por FastAPI.';
COMMENT ON COLUMN public.profiles.skills IS 'Habilidades profesionales separadas por comas.';

-- El proyecto ProjectMind ya tiene un bucket PRIVADO avatars (5MB, JPEG/PNG/WebP),
-- con políticas INSERT/UPDATE/DELETE para el dueño del subdirectorio UUID,
-- y SELECT para perfiles visibles vía private.can_view_profile.
-- No crear otro bucket ni abrirlo al público.
