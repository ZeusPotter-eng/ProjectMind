"""Contratos seguros del chat y su historial efímero."""
from typing import Literal

from pydantic import BaseModel, Field


class AssistantTurn(BaseModel):
    role: Literal['user', 'assistant']
    content: str = Field(min_length=1, max_length=2000)


class AssistantRequest(BaseModel):
    project_id: str | None = None
    message: str = Field(min_length=1, max_length=8000)
    history: list[AssistantTurn] = Field(default_factory=list, max_length=8)


class AssistantResponse(BaseModel):
    provider: str
    model: str
    answer: str
    requires_human_review: bool = True
    context_loaded: bool = False
    project_name: str | None = None
    context_counts: dict[str, int] | None = None
