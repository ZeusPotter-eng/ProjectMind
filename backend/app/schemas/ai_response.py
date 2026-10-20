"""PM-21: contrato tipado y trazable para agentes; un informe NO ejecuta acciones."""
from datetime import datetime
from enum import Enum
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator

class FindingSeverity(str, Enum):
    info = 'info'
    warning = 'warning'
    critical = 'critical'

class EvidenceRef(BaseModel):
    model_config = ConfigDict(extra='forbid')
    kind: Literal['project', 'task', 'dependency', 'blocker']
    id: UUID

class Finding(BaseModel):
    model_config = ConfigDict(extra='forbid')
    code: str = Field(min_length=3, max_length=64, pattern=r'^[a-z][a-z0-9_]*$')
    severity: FindingSeverity
    title: str = Field(min_length=3, max_length=160)
    explanation: str = Field(min_length=8, max_length=1200)
    evidence: list[EvidenceRef] = Field(min_length=1, max_length=10)
    recommendation: str = Field(min_length=8, max_length=1200)

class AgentReport(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema_version: Literal['1.0'] = '1.0'
    agent_id: str = Field(default='projectmind-rules', pattern=r'^[a-z0-9][a-z0-9_-]{2,62}$')
    project_id: UUID
    produced_at: datetime
    summary: str = Field(min_length=8, max_length=2000)
    findings: list[Finding] = Field(default_factory=list, max_length=60)
    execution_mode: Literal['read_only'] = 'read_only'
    requires_human_approval: bool = True

class ReportRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    focus: str = Field(default='', max_length=1500)
    use_llm: bool = False


def validate_references(report: AgentReport, existing: dict[str, set[str]]) -> AgentReport:
    """No admitir referencias inventadas por un modelo; filtrar en la capa de orquestación."""
    for finding in report.findings:
        for reference in finding.evidence:
            if str(reference.id) not in existing.get(reference.kind, set()):
                raise ValueError(f'Referencia no autorizada: {reference.kind}')
    return report
