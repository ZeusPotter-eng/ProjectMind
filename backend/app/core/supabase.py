from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Client público/autenticado usando la llave publishable/anon."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError(
            "Configura SUPABASE_URL y SUPABASE_ANON_KEY en backend/.env"
        )
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_supabase_admin() -> Client:
    """Client de administración exclusivo del backend para la consola CRUD local."""
    settings = get_settings()
    admin_key = settings.supabase_secret_key or settings.supabase_service_role_key
    if not settings.supabase_url or not admin_key:
        raise RuntimeError(
            "Configura SUPABASE_URL y SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY legacy) en backend/.env"
        )
    return create_client(settings.supabase_url, admin_key)
