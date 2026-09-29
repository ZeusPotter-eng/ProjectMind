from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/documents", tags=["Documents"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="documents", message="Documentos y preparación para RAG: estructura inicial lista para integración.")
