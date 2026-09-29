from pydantic import BaseModel
class ModuleStatus(BaseModel):
    module: str
    status: str = "scaffold_ready"
    message: str
