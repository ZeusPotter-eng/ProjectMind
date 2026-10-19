"""PM-18: CRUD de dependencias con JWT, RLS y validaciones de grafo."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.routes.projects import get_authenticated_session
from app.api.routes.tasks import _project, _task
from app.schemas.common import ModuleStatus
from app.schemas.dependencies import DependencyCreate, DependencyList, DependencyOut, DependencyUpdate
from app.services.dependency_service import all_project_dependencies, validate_dependency_graph
from app.services.task_service import task_database_request

router = APIRouter(prefix='/dependencies', tags=['Dependencies'])
project_router = APIRouter(prefix='/projects/{project_id}/dependencies', tags=['Dependencies'])


@router.get('/status', response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module='dependencies', message='PM-18: gestión de precedencias de tareas activa.')


async def _edge(project_id: UUID, dependency_id: UUID, session: dict) -> dict:
    rows, _ = await task_database_request('GET', token=session['token'], table='task_dependencies',
        filters={'project_id': f'eq.{project_id}', 'id': f'eq.{dependency_id}', 'limit': 1})
    if not rows:
        raise HTTPException(404, 'No encontramos esa dependencia en el proyecto.')
    return rows[0]


async def _verify_tasks(project_id: UUID, task_id: UUID, predecessor_id: UUID, session: dict) -> None:
    if task_id == predecessor_id:
        raise HTTPException(422, 'Una tarea no puede depender de sí misma.')
    for task in (task_id, predecessor_id):
        rows, _ = await task_database_request('GET', token=session['token'],
            filters={'project_id': f'eq.{project_id}', 'id': f'eq.{task}', 'limit': 1}, select='id')
        if not rows:
            raise HTTPException(422, 'Ambas tareas deben existir y pertenecer a este mismo proyecto.')


@project_router.get('', response_model=DependencyList)
async def list_dependencies(project_id: UUID, limit: int = Query(100, ge=1, le=500),
                            offset: int = Query(0, ge=0), session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session)
    rows, count = await task_database_request('GET', token=session['token'], table='task_dependencies',
        filters={'project_id': f'eq.{project_id}', 'order': 'created_at.asc,id.asc', 'limit': limit, 'offset': offset}, count=True)
    return {'items': rows, 'count': count, 'limit': limit, 'offset': offset}


@project_router.post('', response_model=DependencyOut, status_code=201)
async def create_dependency(project_id: UUID, data: DependencyCreate,
                            session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    await _verify_tasks(project_id, data.task_id, data.depends_on_task_id, session)
    existing = await all_project_dependencies(project_id, session['token'])
    validate_dependency_graph(existing, task_id=str(data.task_id), depends_on_task_id=str(data.depends_on_task_id))
    values = {**data.model_dump(mode='json'), 'project_id': str(project_id), 'created_by': session['user_id']}
    rows, _ = await task_database_request('POST', token=session['token'], table='task_dependencies', payload=values)
    if not rows:
        raise HTTPException(403, 'No se pudo crear la dependencia.')
    return rows[0]


@project_router.get('/{dependency_id}', response_model=DependencyOut)
async def get_dependency(project_id: UUID, dependency_id: UUID, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session)
    return await _edge(project_id, dependency_id, session)


@project_router.patch('/{dependency_id}', response_model=DependencyOut)
async def update_dependency(project_id: UUID, dependency_id: UUID, data: DependencyUpdate,
                            session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    current = await _edge(project_id, dependency_id, session)
    values = data.model_dump(mode='json', exclude_unset=True)
    predecessor = UUID(str(values.get('depends_on_task_id', current['depends_on_task_id'])))
    task_id = UUID(str(current['task_id']))
    await _verify_tasks(project_id, task_id, predecessor, session)
    existing = await all_project_dependencies(project_id, session['token'])
    validate_dependency_graph(existing, task_id=str(task_id), depends_on_task_id=str(predecessor), replacing_id=str(dependency_id))
    rows, _ = await task_database_request('PATCH', token=session['token'], table='task_dependencies',
        filters={'project_id': f'eq.{project_id}', 'id': f'eq.{dependency_id}'}, payload=values)
    if not rows:
        raise HTTPException(403, 'No se pudo modificar la dependencia.')
    return rows[0]


@project_router.delete('/{dependency_id}', status_code=204)
async def delete_dependency(project_id: UUID, dependency_id: UUID,
                            session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    await _edge(project_id, dependency_id, session)
    rows, _ = await task_database_request('DELETE', token=session['token'], table='task_dependencies',
        filters={'project_id': f'eq.{project_id}', 'id': f'eq.{dependency_id}'})
    if not rows:
        raise HTTPException(403, 'No se pudo eliminar la dependencia.')
    return None
