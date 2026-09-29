from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/requirements", tags=["Requirements"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="requirements", message="Requisitos y trazabilidad: estructura inicial lista para integración.")
