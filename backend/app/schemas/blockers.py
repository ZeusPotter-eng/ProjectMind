"""PM-19: contratos de impedimentos y sus cambios de estado."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BlockerSeverity(str, Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'
    critical = 'critical'


class BlockerStatus(str, Enum):
    open = 'open'
    resolved = 'resolved'
    dismissed = 'dismissed'


class BlockerCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    task_id: UUID | None = None
    severity: BlockerSeverity = BlockerSeverity.medium
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)


class BlockerUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    description: str | None = Field(default=None, max_length=4000)
    task_id: UUID | None = None
    severity: BlockerSeverity | None = None
    status: BlockerStatus | None = None
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

    @model_validator(mode='after')
    def validate_patch(self):
        values = self.model_dump(exclude_unset=True)
        if not values:
            raise ValueError('Indica al menos un dato que modificar.')
        for field in ('title', 'severity', 'status'):
            if field in values and values[field] is None:
                raise ValueError(f'El campo {field} no puede ser nulo.')
        return self


class BlockerOut(BaseModel):
    id: UUID
    project_id: UUID
    task_id: UUID | None = None
    title: str
    description: str | None = None
    severity: BlockerSeverity
    status: BlockerStatus
    created_by: UUID
    resolved_by: UUID | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BlockerList(BaseModel):
    items: list[BlockerOut] = Field(default_factory=list)
    count: int
    limit: int
    offset: int
