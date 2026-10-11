"""PM-15: contratos públicos de integrantes de proyectos."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MemberRole(str, Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class AssignableRole(str, Enum):
    admin = "admin"
    member = "member"


class MemberStatus(str, Enum):
    active = "active"
    inactive = "inactive"
    removed = "removed"


class AddMember(BaseModel):
    user_id: UUID
    role: AssignableRole = AssignableRole.member
    model_config = ConfigDict(extra="forbid")


class UpdateMember(BaseModel):
    role: AssignableRole | None = None
    status: MemberStatus | None = None
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_change(self):
        sent = self.model_fields_set
        if not sent or any(getattr(self, key) is None for key in sent):
            raise ValueError("Indica un rol o estado válido para actualizar al integrante.")
        return self


class MemberOut(BaseModel):
    project_id: UUID
    user_id: UUID
    role: MemberRole
    status: MemberStatus
    joined_at: datetime
    full_name: str | None = None


class MemberList(BaseModel):
    items: list[MemberOut]
    active_count: int = Field(ge=0)
    max_active: int = 15
