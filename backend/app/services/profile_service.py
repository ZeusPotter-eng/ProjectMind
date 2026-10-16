"""Acceso PostgREST al perfil propio, bajo el JWT del usuario y RLS.

Nunca utiliza la service_role ni permite escribir sobre un perfil distinto al autenticado.
"""
import logging
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def profile_database_request(
    method: str, *, access_token: str, user_id: str, payload: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503, "La conexión con Supabase no está configurada.")

    headers = {
        "apikey": settings.supabase_client_key,
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    query = {
        "id": f"eq.{user_id}",
        "select": "id,full_name,job_title,bio,avatar_path,created_at,updated_at",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.request(
                method, f"{settings.supabase_url.rstrip('/')}/rest/v1/profiles",
                headers=headers, params=query, json=payload,
            )
    except httpx.RequestError:
        raise HTTPException(502, "No fue posible conectar con Supabase.") from None

    if result.status_code >= 400:
        logger.warning("PostgREST profile error, status=%s", result.status_code)
        if result.status_code in {401, 403}:
            raise HTTPException(403, "No tienes permisos para editar este perfil.")
        raise HTTPException(502, "No fue posible guardar el perfil en la base de datos.")
    try:
        return result.json() if result.content else []
    except ValueError:
        raise HTTPException(502, "La base de datos respondió con un formato inesperado.") from None
