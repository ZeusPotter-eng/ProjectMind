import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.core.config import get_settings
from app.schemas.crud import (
    CrudCreateRequest,
    CrudDeleteRequest,
    CrudLookupRequest,
    CrudUpdateRequest,
)
from app.services.crud_registry import CrudResource, get_resource, list_resources
from app.services.crud_service import (
    CrudValidationError,
    create_row,
    delete_row,
    get_row,
    list_rows,
    update_row,
)

router = APIRouter(prefix="/crud", tags=["Development CRUD"])


def require_crud_console(x_crud_token: str | None = Header(default=None)) -> None:
    settings = get_settings()

    if settings.app_env.lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La consola CRUD está bloqueada en APP_ENV=production.",
        )

    if not settings.crud_console_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La consola CRUD está deshabilitada. Configura CRUD_CONSOLE_ENABLED=true solo en desarrollo.",
        )

    if not settings.crud_console_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falta CRUD_CONSOLE_TOKEN en backend/.env.",
        )

    if not x_crud_token or not secrets.compare_digest(x_crud_token, settings.crud_console_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de consola CRUD inválido.",
        )

    if not (settings.supabase_secret_key or settings.supabase_service_role_key):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY legacy) en backend/.env.",
        )


def resolve_resource(resource_name: str) -> CrudResource:
    resource = get_resource(resource_name)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El recurso '{resource_name}' no pertenece al CRUD de ProjectMind.",
        )
    return resource


def database_error(exc: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Supabase rechazó la operación: {exc}",
    )


@router.get("/status")
async def crud_status() -> dict:
    settings = get_settings()
    return {
        "module": "crud",
        "environment": settings.app_env,
        "enabled": bool(settings.crud_console_enabled and settings.app_env.lower() != "production"),
        "token_configured": bool(settings.crud_console_token),
        "admin_key_configured": bool(settings.supabase_secret_key or settings.supabase_service_role_key),
        "resource_count": len(list_resources()),
    }


@router.get("/resources", dependencies=[Depends(require_crud_console)])
async def crud_resources() -> dict:
    return {
        "count": len(list_resources()),
        "resources": [item.public_dict() for item in list_resources()],
    }


@router.get("/{resource_name}", dependencies=[Depends(require_crud_console)])
async def crud_list(
    resource_name: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    resource = resolve_resource(resource_name)
    try:
        items, count = list_rows(resource, limit=limit, offset=offset)
        return {
            "resource": resource.name,
            "count": count,
            "limit": limit,
            "offset": offset,
            "items": items,
        }
    except Exception as exc:
        raise database_error(exc) from exc


@router.post("/{resource_name}/lookup", dependencies=[Depends(require_crud_console)])
async def crud_lookup(resource_name: str, payload: CrudLookupRequest) -> dict:
    resource = resolve_resource(resource_name)
    try:
        item = get_row(resource, payload.key)
        if item is None:
            raise HTTPException(status_code=404, detail="Registro no encontrado.")
        return {"resource": resource.name, "item": item}
    except CrudValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise database_error(exc) from exc


@router.post("/{resource_name}", dependencies=[Depends(require_crud_console)], status_code=201)
async def crud_create(resource_name: str, payload: CrudCreateRequest) -> dict:
    resource = resolve_resource(resource_name)
    try:
        item = create_row(resource, payload.data)
        return {"resource": resource.name, "item": item}
    except CrudValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise database_error(exc) from exc


@router.patch("/{resource_name}", dependencies=[Depends(require_crud_console)])
async def crud_update(resource_name: str, payload: CrudUpdateRequest) -> dict:
    resource = resolve_resource(resource_name)
    try:
        item = update_row(resource, payload.key, payload.data)
        if item is None:
            raise HTTPException(status_code=404, detail="Registro no encontrado.")
        return {"resource": resource.name, "item": item}
    except CrudValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise database_error(exc) from exc


@router.delete("/{resource_name}", dependencies=[Depends(require_crud_console)])
async def crud_delete(resource_name: str, payload: CrudDeleteRequest) -> dict:
    resource = resolve_resource(resource_name)
    try:
        item = delete_row(resource, payload.key)
        if item is None:
            raise HTTPException(status_code=404, detail="Registro no encontrado.")
        return {"resource": resource.name, "deleted": item}
    except CrudValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise database_error(exc) from exc
