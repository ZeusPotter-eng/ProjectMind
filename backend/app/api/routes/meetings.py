from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/meetings", tags=["Meetings"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="meetings", message="Reuniones, transcripción y minutas: estructura inicial lista para integración.")
