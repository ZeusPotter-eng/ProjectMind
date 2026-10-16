"""Perfil tipo gestor de proyectos para el usuario conectado."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.projects import get_authenticated_session
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.services.profile_service import profile_database_request

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
    # Solo los campos del schema son editables; nunca se recibe un ID como entrada.
    rows = await profile_database_request(
        "PATCH", access_token=session["token"], user_id=session["user_id"], payload=values
    )
    if not rows:
        raise HTTPException(403, "No tienes permisos para modificar tu perfil.")
    return rows[0]
