from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/projects", tags=["Projects"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="projects", message="Gestión de proyectos e integrantes: estructura inicial lista para integración.")
