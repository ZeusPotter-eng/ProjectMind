"""PM-16: API de tareas, seguimiento y responsables con permisos por proyecto."""
from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.routes.projects import get_authenticated_session, get_project
from app.schemas.common import ModuleStatus
from app.schemas.tasks import TaskCreate, TaskList, TaskOut, TaskUpdate
from app.services.task_service import task_database_request
from app.services.member_service import member_database_request

router = APIRouter(prefix='/projects/{project_id}/tasks', tags=['Tasks'])
status_router = APIRouter(prefix='/tasks', tags=['Tasks'])

@status_router.get('/status', response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module='tasks', message='PM-16: tareas, prioridades, responsables y seguimiento activos.')

async def _project(project_id: UUID, session: dict, *, writable: bool = False):
    project = await get_project(project_id, session)
    if writable and project['status'] == 'archived':
        raise HTTPException(409, 'No puedes modificar tareas de un proyecto archivado.')
    return project

async def _task(project_id: UUID, task_id: UUID, session: dict):
    rows, _ = await task_database_request('GET', token=session['token'], filters={'project_id': f'eq.{project_id}', 'id': f'eq.{task_id}', 'limit': 1})
    if not rows:
        raise HTTPException(404, 'No encontramos esa tarea dentro del proyecto.')
    return rows[0]

async def _assignees(task_ids: list[str], session: dict) -> dict[str, list[str]]:
    if not task_ids:
        return {}
    rows, _ = await task_database_request('GET', token=session['token'], table='task_assignees', filters={'task_id': 'in.(' + ','.join(task_ids) + ')', 'limit': 2000}, select='task_id,user_id')
    result = {id: [] for id in task_ids}
    for item in rows:
        result.setdefault(item['task_id'], []).append(item['user_id'])
    return result

async def _enrich(rows, session):
    assignees = await _assignees([r['id'] for r in rows], session)
    return [{**row, 'assignees': assignees.get(row['id'], [])} for row in rows]

@router.get('', response_model=TaskList)
async def list_tasks(project_id: UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0), session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session)
    rows, count = await task_database_request('GET', token=session['token'], filters={'project_id': f'eq.{project_id}', 'order': 'created_at.desc,id.desc', 'limit': limit, 'offset': offset}, count=True)
    return {'items': await _enrich(rows, session), 'count': count, 'limit': limit, 'offset': offset}

@router.post('', response_model=TaskOut, status_code=201)
async def create_task(project_id: UUID, data: TaskCreate, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    values = {**data.model_dump(mode='json'), 'project_id': str(project_id), 'created_by': session['user_id']}
    if data.status.value == 'done':
        values['completed_at'] = datetime.now(timezone.utc).isoformat()
    rows, _ = await task_database_request('POST', token=session['token'], payload=values)
    if not rows:
        raise HTTPException(502, 'No se confirmó la creación de la tarea.')
    return (await _enrich(rows, session))[0]

@router.get('/{task_id}', response_model=TaskOut)
async def get_task(project_id: UUID, task_id: UUID, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session)
    return (await _enrich([await _task(project_id, task_id, session)], session))[0]

@router.patch('/{task_id}', response_model=TaskOut)
async def update_task(project_id: UUID, task_id: UUID, data: TaskUpdate, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    current = await _task(project_id, task_id, session)
    values = data.model_dump(mode='json', exclude_unset=True)
    merged = {**current, **values}
    if merged.get('start_date') and merged.get('due_date') and date.fromisoformat(str(merged['due_date'])) < date.fromisoformat(str(merged['start_date'])):
        raise HTTPException(422, 'La fecha de término no puede ser anterior al inicio.')
    if merged.get('status') == 'done':
        values['progress'] = 100
        values['completed_at'] = current.get('completed_at') or datetime.now(timezone.utc).isoformat()
    else:
        if merged.get('progress') == 100:
            raise HTTPException(422, 'El avance 100% requiere estado Finalizada.')
        if current.get('status') == 'done':
            values['completed_at'] = None
    values['updated_by'] = session['user_id']
    rows, _ = await task_database_request('PATCH', token=session['token'], filters={'project_id': f'eq.{project_id}', 'id': f'eq.{task_id}'}, payload=values)
    if not rows:
        raise HTTPException(403, 'No se pudo actualizar esta tarea.')
    return (await _enrich(rows, session))[0]

@router.delete('/{task_id}', status_code=204)
async def delete_task(project_id: UUID, task_id: UUID, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    await _task(project_id, task_id, session)
    rows, _ = await task_database_request('DELETE', token=session['token'], filters={'project_id': f'eq.{project_id}', 'id': f'eq.{task_id}'})
    if not rows:
        raise HTTPException(403, 'Solo propietarios y administradores pueden eliminar tareas.')
    return None

@router.post('/{task_id}/assignees/{user_id}', response_model=TaskOut)
async def assign_task(project_id: UUID, task_id: UUID, user_id: UUID, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    await _task(project_id, task_id, session)
    members = await member_database_request('GET', access_token=session['token'], project_id=str(project_id), select_profiles=False)
    if not any(str(m['user_id']) == str(user_id) and m['status'] == 'active' for m in members):
        raise HTTPException(422, 'Solo puedes asignar integrantes activos del proyecto.')
    await task_database_request('POST', token=session['token'], table='task_assignees', select='task_id,user_id', payload={'task_id': str(task_id), 'user_id': str(user_id), 'assigned_by': session['user_id']})
    return await get_task(project_id, task_id, session)

@router.delete('/{task_id}/assignees/{user_id}', response_model=TaskOut)
async def unassign_task(project_id: UUID, task_id: UUID, user_id: UUID, session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    await _task(project_id, task_id, session)
    rows, _ = await task_database_request('DELETE', token=session['token'], table='task_assignees', select='task_id,user_id', filters={'task_id': f'eq.{task_id}', 'user_id': f'eq.{user_id}'})
    if not rows:
        raise HTTPException(404, 'La persona no está asignada a la tarea.')
    return await get_task(project_id, task_id, session)
