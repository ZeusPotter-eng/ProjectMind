"""PM-15: peticiones PostgREST de integrantes bajo el JWT del usuario.

No emplea service_role ni credenciales administrativas: RLS es la autoridad final.
"""
import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def member_database_request(
    method: str,
    *,
    access_token: str,
    project_id: str,
    user_id: str | None = None,
    payload: dict[str, Any] | None = None,
    select_profiles: bool = True,
) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503, "La conexión con Supabase no está configurada.")

    query: dict[str, str] = {
        "select": "project_id,user_id,role,status,joined_at,profiles(full_name)" if select_profiles else "project_id,user_id,role,status,joined_at",
    }
    if method != "POST":
        query["project_id"] = f"eq.{project_id}"
        if user_id:
            query["user_id"] = f"eq.{user_id}"
    if method == "GET":
        query["order"] = "joined_at.asc"

    headers = {
        "apikey": settings.supabase_client_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/project_members"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.request(method, url, headers=headers, params=query, json=payload)
    except httpx.RequestError:
        logger.warning("Conexión de integrantes a Supabase fallida.")
        raise HTTPException(502, "No fue posible conectar con la base de datos.") from None

    if result.status_code >= 400:
        try:
            error = result.json()
        except ValueError:
            error = {}
        code = error.get("code") if isinstance(error, dict) else None
        logger.warning("PostgREST project_members error: %d %s", result.status_code, code)
        if result.status_code in (401, 403) or code == "42501":
            raise HTTPException(403, "No tienes permisos para administrar integrantes.")
        if code == "23505":
            raise HTTPException(409, "Esta persona ya está registrada en el proyecto. Puedes reactivarla desde el listado.")
        if code == "23503":
            raise HTTPException(404, "No encontramos una cuenta registrada con ese identificador.")
        if code == "23514" or code == "P0001":
            raise HTTPException(422, "Los datos o el límite de integrantes del proyecto no son válidos.")
        raise HTTPException(502, "La base de datos rechazó el cambio. Revisa las políticas de acceso.")
    try:
        return result.json() if result.content else []
    except ValueError:
        raise HTTPException(502, "La base de datos devolvió una respuesta inesperada.") from None


def serialize_member(row: dict[str, Any]) -> dict[str, Any]:
    """Normaliza el JOIN opcional a profiles sin filtrar metadatos privados."""
    profile = row.get("profiles")
    if isinstance(profile, list):
        profile = profile[0] if profile else None
    return {
        "project_id": row["project_id"], "user_id": row["user_id"],
        "role": row["role"], "status": row["status"],
        "joined_at": row["joined_at"],
        "full_name": profile.get("full_name") if isinstance(profile, dict) else None,
    }
