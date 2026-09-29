from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/audit", tags=["Audit"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="audit", message="Historial y auditoría: estructura inicial lista para integración.")
