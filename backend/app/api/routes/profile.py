"""Perfil profesional personal y fotografías privadas accesibles bajo RLS."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.api.routes.projects import get_authenticated_session
from app.schemas.profile import AvatarURL, ProfileOut, ProfileUpdate
from app.services.profile_service import (
    AVATAR_MAX_BYTES, delete_avatar, is_storage_avatar,
    profile_database_request, signed_avatar_url, upload_avatar, validate_photo,
)

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/me", response_model=ProfileOut)
async def get_my_profile(session: dict = Depends(get_authenticated_session)):
    rows = await profile_database_request(
        "GET", access_token=session["token"], user_id=session["user_id"]
    )
    if not rows:
        raise HTTPException(404, "Tu perfil todavía no existe en Supabase.")
    return rows[0]


@router.patch("/me", response_model=ProfileOut)
async def update_my_profile(data: ProfileUpdate, session: dict = Depends(get_authenticated_session)):
    values = data.model_dump(exclude_unset=True)
    if not values:
        raise HTTPException(422, "Selecciona al menos un campo para actualizar.")
    previous = []
    if "avatar_path" in values:
        previous = await profile_database_request("GET", access_token=session["token"], user_id=session["user_id"])
    rows = await profile_database_request(
        "PATCH", access_token=session["token"], user_id=session["user_id"], payload=values
    )
    if not rows:
        raise HTTPException(403, "No tienes permisos para modificar tu perfil.")
    if previous and previous[0].get("avatar_path") != rows[0].get("avatar_path"):
        await delete_avatar(session["token"], session["user_id"], previous[0].get("avatar_path"))
    return rows[0]


@router.post("/me/avatar", response_model=ProfileOut)
async def upload_my_avatar(file: UploadFile = File(...), session: dict = Depends(get_authenticated_session)):
    content = await file.read(AVATAR_MAX_BYTES + 1)
    mime, _ = validate_photo(content, file.content_type)
    token, user_id = session["token"], session["user_id"]
    previous = await profile_database_request("GET", access_token=token, user_id=user_id)
    if not previous:
        raise HTTPException(404, "No encontramos tu perfil.")
    object_path = await upload_avatar(token, user_id, content, mime)
    try:
        updated = await profile_database_request("PATCH", access_token=token, user_id=user_id, payload={"avatar_path": object_path})
        if not updated:
            raise HTTPException(403, "No tienes permiso para actualizar tu fotografía.")
    except Exception:
        await delete_avatar(token, user_id, object_path)
        raise
    await delete_avatar(token, user_id, previous[0].get("avatar_path"))
    return updated[0]


@router.get("/avatar/{profile_id}", response_model=AvatarURL)
async def get_profile_avatar(profile_id: UUID, session: dict = Depends(get_authenticated_session)):
    """Una foto se firma solo si el perfil es visible vía política SELECT RLS."""
    rows = await profile_database_request("GET", access_token=session["token"], user_id=str(profile_id))
    if not rows:
        raise HTTPException(404, "No encontramos ese perfil o no tienes acceso.")
    path = rows[0].get("avatar_path")
    if not is_storage_avatar(path, str(profile_id)):
        return JSONResponse({"url": None}, headers={"Cache-Control": "no-store"})
    url = await signed_avatar_url(session["token"], path)
    return JSONResponse({"url": url}, headers={"Cache-Control": "no-store"})
