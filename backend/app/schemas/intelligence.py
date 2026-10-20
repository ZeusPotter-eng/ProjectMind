"""Contratos de operación inteligente. Los modelos de lenguaje nunca dictan permisos."""
from datetime import date
from enum import Enum
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, model_validator

class ActionName(str, Enum):
    reprioritize='task.reprioritize'
    reschedule='task.reschedule'
    dependency_policy='dependency.policy'
    methodology='project.methodology'

class ProposalCreate(BaseModel):
    action: ActionName
    arguments: dict = Field(default_factory=dict)
    reason: str = Field(min_length=8,max_length=3000)
    model_config=ConfigDict(extra='forbid')

class PolicyUpdate(BaseModel):
    auto_enabled: bool = False
    allowed_auto_actions: list[str] = Field(default_factory=list)
    model_config=ConfigDict(extra='forbid')
    @model_validator(mode='after')
    def only_safe_actions(self):
        safe={'task.reprioritize','task.reschedule'}
        if len(self.allowed_auto_actions)!=len(set(self.allowed_auto_actions)) or set(self.allowed_auto_actions)-safe:
            raise ValueError('Solo se permite delegar cambio de prioridad o fecha de tareas.')
        return self

class RecommendationInput(BaseModel):
    focus: str = Field(default='',max_length=1500)
    create_proposals: bool = True
    use_llm: bool = False
    model_config=ConfigDict(extra='forbid')

class ReprioritizeArgs(BaseModel):
    task_id: UUID
    priority: str
    model_config=ConfigDict(extra='forbid')
    @model_validator(mode='after')
    def priority_valid(self):
        if self.priority not in ('low','medium','high','critical'): raise ValueError('Prioridad inválida.')
        return self

class RescheduleArgs(BaseModel):
    task_id: UUID
    due_date: date
    model_config=ConfigDict(extra='forbid')

class DependencyPolicyArgs(BaseModel):
    dependency_id: UUID
    enforcement: str
    gate_on: str
    model_config=ConfigDict(extra='forbid')
    @model_validator(mode='after')
    def allowed(self):
        if self.enforcement not in ('strict','informational') or self.gate_on not in ('start','finish','both'):
            raise ValueError('Configuración de dependencia inválida.')
        return self

class MethodologyArgs(BaseModel):
    methodology: str
    model_config=ConfigDict(extra='forbid')
    @model_validator(mode='after')
    def allowed(self):
        if self.methodology not in ('scrum','traditional','hybrid'): raise ValueError('Metodología inválida.')
        return self

ACTION_ARGS={
    'task.reprioritize': ReprioritizeArgs,
    'task.reschedule': RescheduleArgs,
    'dependency.policy': DependencyPolicyArgs,
    'project.methodology': MethodologyArgs,
}

def validate_action(action: str, arguments: dict) -> dict:
    if action not in ACTION_ARGS: raise ValueError('Acción no permitida.')
    return ACTION_ARGS[action].model_validate(arguments).model_dump(mode='json')
