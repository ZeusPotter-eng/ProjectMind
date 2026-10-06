from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.core.config import get_settings
from app.core.supabase import get_supabase

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "projectmind-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/supabase")
async def supabase_health_check() -> dict:
    """Verifica FastAPI -> Supabase mediante un RPC sin exponer tablas del MVP."""
    settings = get_settings()

    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase no está configurado en el backend.",
        )

    try:
        response = get_supabase().rpc("projectmind_connection_check").execute()
        payload = response.data or {}

        if not isinstance(payload, dict) or payload.get("connected") is not True:
            raise RuntimeError("El RPC de verificación respondió de forma inesperada.")

        return {
            "status": "ok",
            "service": "supabase",
            "connected": True,
            "rls_mode": "enabled",
            "project_url": settings.supabase_url,
            "database": payload.get("database"),
            "server_time": payload.get("server_time"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No fue posible verificar la conexión con Supabase: {exc}",
        ) from exc
