from pydantic import BaseModel, Field
class AssistantRequest(BaseModel):
    project_id: str | None = None
    message: str = Field(min_length=1, max_length=8000)
class AssistantResponse(BaseModel):
    provider: str
    model: str
    answer: str
    requires_human_review: bool = True
