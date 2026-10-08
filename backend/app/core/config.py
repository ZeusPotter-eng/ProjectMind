from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ProjectMind API"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    frontend_origin: str = "http://localhost:5173"

    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    # Compatibilidad con proyectos/configuraciones legacy.
    supabase_anon_key: str | None = None
    supabase_secret_key: str | None = None
    supabase_service_role_key: str | None = None

    # Consola CRUD de verificación.
    # ENABLE_CRUD_CONSOLE es la variable recomendada. CRUD_CONSOLE_ENABLED se
    # conserva temporalmente para no romper configuraciones locales anteriores.
    enable_crud_console: bool = False
    crud_console_enabled: bool = False
    crud_console_token: str | None = None

    openai_api_key: str | None = None
    openai_model: str = "gpt-5.6"
    ai_provider: str = "openai"
    lm_studio_base_url: str = "http://localhost:1234/v1"
    lm_studio_model: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def supabase_client_key(self) -> str | None:
        """Llave pública para llamadas sujetas a RLS/Data API."""
        return self.supabase_publishable_key or self.supabase_anon_key

    @property
    def crud_console_is_enabled(self) -> bool:
        """Activa la consola mediante la variable nueva o la legacy."""
        return self.enable_crud_console or self.crud_console_enabled


@lru_cache
def get_settings() -> Settings:
    return Settings()
