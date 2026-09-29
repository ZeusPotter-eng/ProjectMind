from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/reports", tags=["Reports"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="reports", message="Reportes de estado, avance y riesgo: estructura inicial lista para integración.")
