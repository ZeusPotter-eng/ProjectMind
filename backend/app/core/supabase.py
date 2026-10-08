from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Cliente público/autenticado usando publishable key (o anon legacy)."""
    settings = get_settings()
    client_key = settings.supabase_client_key
    if not settings.supabase_url or not client_key:
        raise RuntimeError(
            "Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY "
            "(o SUPABASE_ANON_KEY legacy) en backend/.env"
        )
    return create_client(settings.supabase_url, client_key)


@lru_cache
def get_supabase_admin() -> Client:
    """Cliente administrativo exclusivo del backend para tareas de desarrollo."""
    settings = get_settings()
    admin_key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not admin_key:
        raise RuntimeError(
            "Configura SUPABASE_URL y SUPABASE_SECRET_KEY "
            "(o SUPABASE_SERVICE_ROLE_KEY legacy) en backend/.env"
        )
    return create_client(settings.supabase_url, admin_key)
