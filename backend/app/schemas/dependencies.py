"""PM-18: contratos públicos de relaciones de precedencia entre tareas."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DependencyType(str, Enum):
    finish_to_start = 'finish_to_start'
    start_to_start = 'start_to_start'
    finish_to_finish = 'finish_to_finish'
    start_to_finish = 'start_to_finish'


class Enforcement(str, Enum):
    informational = 'informational'
    strict = 'strict'

class GateOn(str, Enum):
    start = 'start'
    finish = 'finish'
    both = 'both'

class DependencyCreate(BaseModel):
    task_id: UUID
    depends_on_task_id: UUID
    dependency_type: DependencyType = DependencyType.finish_to_start
    enforcement: Enforcement | None = None  # se deriva de la metodología al crear
    gate_on: GateOn | None = None
    model_config = ConfigDict(extra='forbid')

    @model_validator(mode='after')
    def distinct_tasks(self):
        if self.task_id == self.depends_on_task_id:
            raise ValueError('Una tarea no puede depender de sí misma.')
        return self


class DependencyUpdate(BaseModel):
    depends_on_task_id: UUID | None = None
    dependency_type: DependencyType | None = None
    enforcement: Enforcement | None = None
    gate_on: GateOn | None = None
    model_config = ConfigDict(extra='forbid')

    @model_validator(mode='after')
    def valid_patch(self):
        data = self.model_dump(exclude_unset=True)
        if not data or any(value is None for value in data.values()):
            raise ValueError('Debes indicar una dependencia válida para actualizar.')
        return self


class DependencyOut(BaseModel):
    id: UUID
    project_id: UUID
    task_id: UUID
    depends_on_task_id: UUID
    dependency_type: DependencyType
    enforcement: Enforcement
    gate_on: GateOn
    created_by: UUID
    created_at: datetime


class DependencyList(BaseModel):
    items: list[DependencyOut] = Field(default_factory=list)
    count: int
    limit: int
    offset: int
