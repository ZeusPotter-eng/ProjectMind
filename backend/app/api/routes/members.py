"""PM-15: gestión de miembros con autorización defensiva + RLS en Supabase."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.api.routes.projects import get_authenticated_session, get_project
from app.schemas.members import AddMember, MemberList, MemberOut, UpdateMember
from app.services.member_service import member_database_request, serialize_member

router = APIRouter(prefix="/projects/{project_id}/members", tags=["Project Members"])


async def _project_and_members(project_id: UUID, session: dict):
    project = await get_project(project_id, session)
    rows = await member_database_request(
        "GET", access_token=session["token"], project_id=str(project_id)
    )
    return project, rows


def _permission(session: dict, rows: list[dict], *, owner_id: str) -> None:
    actor = str(session["user_id"])
    active_role = next((row.get("role") for row in rows if str(row.get("user_id")) == actor and row.get("status") == "active"), None)
    if active_role not in ("owner", "admin") or (active_role == "owner" and actor != str(owner_id)):
        raise HTTPException(403, "Solo el propietario o un administrador activo puede gestionar integrantes.")


def _member(rows: list[dict], member_id: UUID):
    return next((row for row in rows if str(row.get("user_id")) == str(member_id)), None)


@router.get("", response_model=MemberList)
async def list_members(project_id: UUID, session: dict = Depends(get_authenticated_session)):
    _project, rows = await _project_and_members(project_id, session)
    return {"items": [serialize_member(row) for row in rows],
            "active_count": sum(row.get("status") == "active" for row in rows), "max_active": 15}


@router.post("", response_model=MemberOut, status_code=201)
async def add_member(project_id: UUID, data: AddMember, session: dict = Depends(get_authenticated_session)):
    project, rows = await _project_and_members(project_id, session)
    _permission(session, rows, owner_id=str(project["owner_id"]))
    if project["status"] == "archived":
        raise HTTPException(409, "No puedes añadir integrantes a un proyecto archivado.")
    if str(data.user_id) == str(project["owner_id"]):
        raise HTTPException(409, "El propietario ya pertenece al proyecto.")
    if _member(rows, data.user_id):
        raise HTTPException(409, "La persona ya existe en este proyecto. Modifica su estado en el listado.")
    if sum(row.get("status") == "active" for row in rows) >= 15:
        raise HTTPException(409, "El máximo es de 15 integrantes activos por proyecto.")

    result = await member_database_request(
        "POST", access_token=session["token"], project_id=str(project_id),
        payload={"project_id": str(project_id), "user_id": str(data.user_id), "role": data.role.value, "status": "active"},
        select_profiles=False,
    )
    if not result:
        raise HTTPException(502, "No fue posible confirmar la incorporación del integrante.")
    # El usuario puede no ser visible en profiles hasta ser integrante; la vista lo recuperará al refrescar.
    return serialize_member(result[0])


@router.patch("/{member_id}", response_model=MemberOut)
async def update_member(project_id: UUID, member_id: UUID, data: UpdateMember, session: dict = Depends(get_authenticated_session)):
    project, rows = await _project_and_members(project_id, session)
    _permission(session, rows, owner_id=str(project["owner_id"]))
    existing = _member(rows, member_id)
    if not existing:
        raise HTTPException(404, "Este integrante no pertenece al proyecto.")
    if existing.get("role") == "owner" or str(member_id) == str(project["owner_id"]):
        raise HTTPException(403, "El propietario no puede modificarse ni eliminarse.")
    if str(member_id) == str(session["user_id"]):
        raise HTTPException(403, "No puedes cambiar tu propio rol ni retirar tu propia cuenta.")
    if project["status"] == "archived":
        raise HTTPException(409, "No puedes modificar integrantes de un proyecto archivado.")
    if data.status and data.status.value == "active" and existing.get("status") != "active":
        if sum(row.get("status") == "active" for row in rows) >= 15:
            raise HTTPException(409, "El máximo es de 15 integrantes activos por proyecto.")
    payload = data.model_dump(mode="json", exclude_unset=True)
    result = await member_database_request(
        "PATCH", access_token=session["token"], project_id=str(project_id),
        user_id=str(member_id), payload=payload, select_profiles=False,
    )
    if not result:
        raise HTTPException(403, "No fue posible actualizar los permisos de este integrante.")
    return serialize_member(result[0])
