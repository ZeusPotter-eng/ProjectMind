"""PM-16: contratos para tareas de proyectos y responsables."""
from datetime import date, datetime
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

class TaskStatus(str, Enum):
    backlog = 'backlog'
    todo = 'todo'
    in_progress = 'in_progress'
    blocked = 'blocked'
    review = 'review'
    done = 'done'
    cancelled = 'cancelled'

class TaskPriority(str, Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    critical = 'critical'

class TaskCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.medium
    start_date: date | None = None
    due_date: date | None = None
    progress: int = Field(default=0, ge=0, le=100)
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @model_validator(mode='after')
    def validate_task(self):
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError('La fecha de término no puede ser anterior al inicio.')
        if self.status == TaskStatus.done and self.progress != 100:
            raise ValueError('Una tarea completada requiere 100% de avance.')
        if self.progress == 100 and self.status != TaskStatus.done:
            raise ValueError('El 100% de avance requiere estado Finalizada.')
        return self

class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    start_date: date | None = None
    due_date: date | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @model_validator(mode='after')
    def validate_update(self):
        values = self.model_dump(exclude_unset=True)
        if not values:
            raise ValueError('Indica al menos un campo para actualizar.')
        for name in ('title', 'status', 'priority', 'progress'):
            if name in values and values[name] is None:
                raise ValueError(f'El campo {name} no puede ser nulo.')
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError('La fecha de término no puede ser anterior al inicio.')
        return self

class TaskOut(BaseModel):
    id: UUID
    project_id: UUID
    title: str
    description: str | None = None
    status: TaskStatus
    priority: TaskPriority
    start_date: date | None = None
    due_date: date | None = None
    progress: int
    created_by: UUID
    updated_by: UUID | None = None
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    assignees: list[UUID] = Field(default_factory=list)

class TaskList(BaseModel):
    items: list[TaskOut]
    count: int
    limit: int
    offset: int
