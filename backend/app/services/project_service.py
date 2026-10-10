"""Acceso a proyectos mediante PostgREST con el JWT del usuario (RLS activo).

Nunca se usa la clave administrativa: los permisos se evalúan en Supabase.
"""
import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def project_database_request(
    method: str,
    *,
    access_token: str,
    project_id: str | None = None,
    payload: dict[str, Any] | None = None,
    params: dict[str, str | int] | None = None,
    exact_count: bool = False,
) -> tuple[Any, int]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503, "La conexión con Supabase no está configurada.")

    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/projects"
    query: dict[str, str | int] = {"select": "*"}
    if project_id:
        query["id"] = f"eq.{project_id}"
    if params:
        query.update(params)

    headers = {
        "apikey": settings.supabase_client_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" + (",count=exact" if exact_count else ""),
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(method, url, params=query, json=payload, headers=headers)
    except httpx.RequestError as exc:
        logger.warning("Supabase no disponible para proyectos: %s", type(exc).__name__)
        raise HTTPException(502, "No fue posible conectar con la base de datos.") from None

    if response.status_code >= 400:
        try:
            error = response.json()
        except ValueError:
            error = {}
        pg_code = error.get("code") if isinstance(error, dict) else None
        logger.warning("PostgREST projects error: status=%d code=%s", response.status_code, pg_code)
        if response.status_code in (401, 403) or pg_code == "42501":
            raise HTTPException(403, "No tienes permisos para realizar esta operación.")
        if pg_code == "23503":
            raise HTTPException(409, "No existe un perfil de usuario válido para esta operación.")
        if pg_code == "23514":
            raise HTTPException(422, "El estado o las fechas del proyecto no son válidos.")
        raise HTTPException(502, "Supabase rechazó la operación. Revisa su configuración y los registros del backend.")

    try:
        result = response.json() if response.content else []
    except ValueError:
        raise HTTPException(502, "Supabase devolvió una respuesta inesperada.") from None

    total = 0
    if exact_count:
        # Formato de PostgREST: Content-Range: 0-9/35 o */0.
        range_header = response.headers.get("Content-Range", "")
        if "/" in range_header:
            last = range_header.rsplit("/", 1)[1]
            if last.isdigit():
                total = int(last)
    return result, total
