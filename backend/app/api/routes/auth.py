from fastapi import APIRouter
from app.schemas.common import ModuleStatus
router = APIRouter(prefix="/auth", tags=["Auth"])
@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="auth", message="Autenticación con Supabase Auth: estructura inicial lista para integración.")
