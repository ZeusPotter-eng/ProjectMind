"""PM-13: gestionar proyectos propios y compartidos, respetando RLS."""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.routes.auth import bearer, supabase_auth
from app.schemas.common import ModuleStatus
from app.schemas.projects import ProjectCreate, ProjectList, ProjectOut, ProjectUpdate
from app.services.project_service import project_database_request

router = APIRouter(prefix="/projects", tags=["Projects"])


async def get_authenticated_session(authorization: str | None = Header(default=None)) -> dict:
    token = bearer(authorization)
    user = await supabase_auth("GET", "user", token=token)
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(401, "No fue posible identificar al usuario.")
    return {"token": token, "user_id": user["id"]}


@router.get("/status", response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module="projects", message="PM-13: gestión de proyectos mediante Supabase Auth y RLS.")


@router.get("", response_model=ProjectList)
async def list_projects(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_archived: bool = Query(default=False),
    session: dict = Depends(get_authenticated_session),
):
    filters: dict[str, str | int] = {"order": "created_at.desc", "limit": limit, "offset": offset}
    if not include_archived:
        filters["status"] = "neq.archived"
    rows, count = await project_database_request(
        "GET", access_token=session["token"], params=filters, exact_count=True
    )
    return {"items": rows, "count": count, "limit": limit, "offset": offset}


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: UUID, session: dict = Depends(get_authenticated_session)):
    rows, _ = await project_database_request(
        "GET", access_token=session["token"], project_id=str(project_id), params={"limit": 1}
    )
    if not rows:
        raise HTTPException(404, "No encontramos el proyecto o no tienes acceso.")
    return rows[0]


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(data: ProjectCreate, session: dict = Depends(get_authenticated_session)):
    values = data.model_dump(mode="json")
    # owner_id se obtiene EXCLUSIVAMENTE de Supabase Auth, no del formulario.
    values["owner_id"] = session["user_id"]
    rows, _ = await project_database_request(
        "POST", access_token=session["token"], payload=values, params={"select": "*"}
    )
    if not rows:
        raise HTTPException(502, "No fue posible recuperar el proyecto recién creado.")
    return rows[0]


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    session: dict = Depends(get_authenticated_session),
):
    # Consulta previa: verifica el acceso de lectura y valida fechas parciales.
    current = ProjectOut.model_validate(await get_project(project_id, session))
    values = data.model_dump(mode="json", exclude_unset=True)
    start = values.get("start_date", current.start_date.isoformat() if current.start_date else None)
    due = values.get("due_date", current.due_date.isoformat() if current.due_date else None)
    if start and due and date.fromisoformat(due) < date.fromisoformat(start):
        raise HTTPException(422, "La fecha de término no puede ser anterior al inicio.")
    rows, _ = await project_database_request(
        "PATCH", access_token=session["token"], project_id=str(project_id), payload=values
    )
    if not rows:
        raise HTTPException(403, "No tienes permisos para editar este proyecto.")
    return rows[0]


@router.patch("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(project_id: UUID, session: dict = Depends(get_authenticated_session)):
    await get_project(project_id, session)
    rows, _ = await project_database_request(
        "PATCH", access_token=session["token"], project_id=str(project_id), payload={"status": "archived"}
    )
    if not rows:
        raise HTTPException(403, "No tienes permisos para archivar este proyecto.")
    return rows[0]
