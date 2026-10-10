"""Esquemas de proyectos del MVP PM-13."""
from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ProjectStatus(str, Enum):
    planning = "planning"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    archived = "archived"


class ProjectFields(BaseModel):
    name: str = Field(min_length=3, max_length=150)
    objective: str = Field(min_length=5, max_length=2000)
    description: str | None = Field(default=None, max_length=5000)
    start_date: date | None = None
    due_date: date | None = None

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    @model_validator(mode="after")
    def dates_in_order(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("La fecha de término no puede ser anterior al inicio.")
        return self


class ProjectCreate(ProjectFields):
    status: ProjectStatus = ProjectStatus.planning


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=150)
    objective: str | None = Field(default=None, min_length=5, max_length=2000)
    description: str | None = Field(default=None, max_length=5000)
    status: ProjectStatus | None = None
    start_date: date | None = None
    due_date: date | None = None

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    @model_validator(mode="after")
    def validate_fields(self):
        values = self.model_dump(exclude_unset=True)
        if not values:
            raise ValueError("Debes enviar al menos un campo para actualizar.")
        for required in ("name", "objective", "status"):
            if required in values and values[required] is None:
                raise ValueError(f"{required} no puede estar vacío.")
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("La fecha de término no puede ser anterior al inicio.")
        return self


class ProjectOut(ProjectFields):
    id: UUID
    owner_id: UUID
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime


class ProjectList(BaseModel):
    items: list[ProjectOut]
    count: int
    limit: int
    offset: int
