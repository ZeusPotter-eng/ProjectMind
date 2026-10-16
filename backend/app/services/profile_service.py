"""Operaciones de perfil y fotografías privadas bajo JWT de Supabase + RLS.

No usa service_role, secret keys ni URLs externas elegidas por el cliente.
"""
import logging
import re
from typing import Any
from uuid import uuid4

import httpx
from fastapi import HTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PROFILE_SELECT = (
    "id,full_name,job_title,bio,company,department,location,website,skills,"
    "avatar_path,created_at,updated_at"
)
AVATAR_BUCKET = "avatars"
AVATAR_MAX_BYTES = 5 * 1024 * 1024
AVATAR_FILE_RE = re.compile(
    r"^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/"
    r"([0-9a-f]{32})\.(jpg|png|webp)$", re.IGNORECASE
)


def supabase_api() -> tuple[str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503, "La conexión con Supabase no está configurada.")
    return settings.supabase_url.rstrip("/"), settings.supabase_client_key


def jwt_headers(token: str) -> dict[str, str]:
    _, key = supabase_api()
    return {"apikey": key, "Authorization": f"Bearer {token}"}


def validate_photo(content: bytes, content_type: str | None) -> tuple[str, str]:
    """No confiar solo en extensiones o MIME del navegador."""
    if not content or len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(422, "La fotografía debe pesar menos de 5 MB.")
    signatures = {
        "image/png": (content.startswith(b"\x89PNG\r\n\x1a\n"), "png"),
        "image/jpeg": (content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9"), "jpg"),
        "image/webp": (content.startswith(b"RIFF") and len(content) >= 12 and content[8:12] == b"WEBP", "webp"),
    }
    valid, extension = signatures.get((content_type or "").lower(), (False, ""))
    if not valid:
        raise HTTPException(422, "Usa una imagen JPG, PNG o WebP válida.")
    return content_type.lower(), extension


def is_storage_avatar(path: str | None, user_id: str | None = None) -> bool:
    match = AVATAR_FILE_RE.fullmatch(path or "")
    return bool(match and (user_id is None or match.group(1).lower() == user_id.lower()))


async def profile_database_request(
    method: str, *, access_token: str, user_id: str, payload: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    base, _ = supabase_api()
    headers = {**jwt_headers(access_token), "Content-Type": "application/json", "Prefer": "return=representation"}
    query = {"id": f"eq.{user_id}", "select": PROFILE_SELECT}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            result = await client.request(
                method, f"{base}/rest/v1/profiles", headers=headers, params=query, json=payload,
            )
    except httpx.RequestError:
        raise HTTPException(502, "No fue posible conectar con Supabase.") from None
    if result.status_code >= 400:
        logger.warning("PostgREST profile error, status=%s", result.status_code)
        if result.status_code in {401, 403}:
            raise HTTPException(403, "No tienes permisos para acceder a este perfil.")
        raise HTTPException(502, "No fue posible guardar o consultar el perfil.")
    try:
        return result.json() if result.content else []
    except ValueError:
        raise HTTPException(502, "La base de datos respondió con un formato inesperado.") from None


async def upload_avatar(access_token: str, user_id: str, content: bytes, content_type: str) -> str:
    """Storage privada, una carpeta por usuario, archivo aleatorio sin overwrite."""
    base, _ = supabase_api()
    _, ext = validate_photo(content, content_type)
    object_path = f"{user_id}/{uuid4().hex}.{ext}"
    url = f"{base}/storage/v1/object/{AVATAR_BUCKET}/{object_path}"
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response = await client.post(
                url,
                content=content,
                headers={**jwt_headers(access_token), "Content-Type": content_type, "x-upsert": "false", "cache-control": "3600"},
            )
    except httpx.RequestError:
        raise HTTPException(502, "No se pudo conectar con el almacenamiento de fotografías.") from None
    if response.status_code >= 400:
        logger.warning("Supabase Storage avatar upload failed, status=%s", response.status_code)
        if response.status_code in {401, 403}:
            raise HTTPException(403, "No tienes permiso para guardar esta fotografía.")
        raise HTTPException(502, "No se pudo subir la fotografía. Comprueba el espacio avatars y sus permisos.")
    return object_path


async def delete_avatar(access_token: str, user_id: str, object_path: str | None) -> None:
    """Limpieza best-effort; jamás borrar recursos fuera de la carpeta propia."""
    if not is_storage_avatar(object_path, user_id):
        return
    base, _ = supabase_api()
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.delete(
                f"{base}/storage/v1/object/{AVATAR_BUCKET}/{object_path}",
                headers=jwt_headers(access_token),
            )
            if response.status_code >= 400:
                logger.warning("Old avatar cleanup failed, status=%s", response.status_code)
    except httpx.RequestError:
        logger.warning("Old avatar cleanup unavailable")


async def signed_avatar_url(access_token: str, object_path: str) -> str:
    """La política RLS de Storage verifica que el usuario puede ver ese perfil."""
    if not is_storage_avatar(object_path):
        raise HTTPException(404, "No hay fotografía de perfil.")
    base, _ = supabase_api()
    try:
        async with httpx.AsyncClient(timeout=18) as client:
            response = await client.post(
                f"{base}/storage/v1/object/sign/{AVATAR_BUCKET}/{object_path}",
                json={"expiresIn": 3600},
                headers={**jwt_headers(access_token), "Content-Type": "application/json"},
            )
    except httpx.RequestError:
        raise HTTPException(502, "No fue posible acceder a la fotografía.") from None
    if response.status_code >= 400:
        if response.status_code in {401, 403}:
            raise HTTPException(403, "No tienes permiso para ver esa fotografía.")
        raise HTTPException(502, "No se pudo generar el enlace privado de la fotografía.")
    try:
        url = response.json().get("signedURL") or response.json().get("signedUrl")
    except ValueError:
        url = None
    if not isinstance(url, str) or not url.startswith(("/object/sign/", "/storage/v1/object/sign/", "https://")):
        raise HTTPException(502, "Supabase devolvió un enlace de fotografía inesperado.")
    if url.startswith("https://"):
        if not url.startswith(f"{base}/storage/v1/object/sign/{AVATAR_BUCKET}/"):
            raise HTTPException(502, "URL de fotografía no válida.")
        return url
    return f"{base}{url}" if url.startswith("/storage/v1/") else f"{base}/storage/v1{url}"
