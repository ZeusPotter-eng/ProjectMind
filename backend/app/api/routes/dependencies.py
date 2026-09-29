from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/dependencies", tags=["Dependencies"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="dependencies", message="Dependencias y validación determinista: estructura inicial lista para integración.")
