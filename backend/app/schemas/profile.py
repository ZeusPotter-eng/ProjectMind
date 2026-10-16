"""Datos públicos del perfil profesional; el almacenamiento de fotos se gestiona aparte."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

AVATAR_THEMES = {"violet", "ocean", "emerald", "sunset", "rose", "slate"}


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    job_title: str | None = Field(default=None, max_length=100)
    bio: str | None = Field(default=None, max_length=600)
    company: str | None = Field(default=None, max_length=120)
    department: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=120)
    website: str | None = Field(default=None, max_length=240)
    skills: str | None = Field(default=None, max_length=300)
    avatar_path: str | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("full_name")
    @classmethod
    def require_name(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("El nombre es obligatorio.")
        return value

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str | None) -> str | None:
        if value and not (value.startswith("https://") or value.startswith("http://")):
            raise ValueError("La página web debe comenzar por https:// o http://.")
        return value

    @field_validator("avatar_path")
    @classmethod
    def avatar_theme(cls, value: str | None) -> str | None:
        # Las rutas Storage SOLO se asignan mediante POST /profile/me/avatar.
        if value is not None and value not in AVATAR_THEMES:
            raise ValueError("Selecciona un color de avatar válido.")
        return value


class ProfileOut(BaseModel):
    id: UUID
    full_name: str
    job_title: str | None = None
    bio: str | None = None
    company: str | None = None
    department: str | None = None
    location: str | None = None
    website: str | None = None
    skills: str | None = None
    avatar_path: str | None = None
    created_at: datetime
    updated_at: datetime


class AvatarURL(BaseModel):
    url: str | None
