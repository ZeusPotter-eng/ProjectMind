from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/tasks", tags=["Tasks"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="tasks", message="Tareas, responsables y avance: estructura inicial lista para integración.")
