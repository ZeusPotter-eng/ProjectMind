from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/suggestions", tags=["Suggestions"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="suggestions", message="Propuestas de IA con revisión humana: estructura inicial lista para integración.")
