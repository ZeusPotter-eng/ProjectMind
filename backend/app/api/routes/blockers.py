from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/blockers", tags=["Blockers"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="blockers", message="Bloqueos e impedimentos: estructura inicial lista para integración.")
