"""Perfil editable del usuario autenticado: reutiliza public.profiles."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


AVATAR_THEMES = {"violet", "ocean", "emerald", "sunset", "rose", "slate"}


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    job_title: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=600)
    avatar_path: str | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("full_name")
    @classmethod
    def require_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("El nombre es obligatorio.")
        return value

    @field_validator("avatar_path")
    @classmethod
    def avatar_theme(cls, value: str | None) -> str | None:
        if value is not None and value not in AVATAR_THEMES:
            raise ValueError("Elige un avatar válido.")
        return value


class ProfileOut(BaseModel):
    id: UUID
    full_name: str
    job_title: str | None = None
    bio: str | None = None
    avatar_path: str | None = None
    created_at: datetime
    updated_at: datetime
