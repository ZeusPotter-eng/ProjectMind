"""PM-19: CRUD de impedimentos y resolución; autenticado, con RLS por proyecto."""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from app.api.routes.projects import get_authenticated_session
from app.api.routes.tasks import _project, _task
from app.schemas.common import ModuleStatus
from app.schemas.blockers import BlockerCreate, BlockerList, BlockerOut, BlockerUpdate
from app.services.task_service import task_database_request

router = APIRouter(prefix='/blockers', tags=['Blockers'])
project_router = APIRouter(prefix='/projects/{project_id}/blockers', tags=['Blockers'])


@router.get('/status', response_model=ModuleStatus)
async def module_status() -> ModuleStatus:
    return ModuleStatus(module='blockers', message='PM-19: registro, seguimiento y resolución de impedimentos activos.')


async def _blocker_admin(project_id: UUID, session: dict):
    from app.api.routes.dependencies import _admin
    await _admin(project_id, session)

async def _blocker(project_id: UUID, blocker_id: UUID, session: dict):
    rows, _ = await task_database_request('GET', token=session['token'], table='blockers',
        filters={'project_id': f'eq.{project_id}', 'id': f'eq.{blocker_id}', 'limit': 1})
    if not rows:
        raise HTTPException(404, 'No encontramos ese impedimento dentro del proyecto.')
    return rows[0]


@project_router.get('', response_model=BlockerList)
async def list_blockers(project_id: UUID, limit: int = Query(100, ge=1, le=500),
                        offset: int = Query(0, ge=0), session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session)
    rows, count = await task_database_request('GET', token=session['token'], table='blockers',
        filters={'project_id': f'eq.{project_id}', 'order': 'created_at.desc,id.desc',
                 'limit': limit, 'offset': offset}, count=True)
    return {'items': rows, 'count': count, 'limit': limit, 'offset': offset}


@project_router.post('', response_model=BlockerOut, status_code=201)
async def create_blocker(project_id: UUID, data: BlockerCreate,
                         session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    if data.task_id:
        await _task(project_id, data.task_id, session)
    if data.is_blocking: await _blocker_admin(project_id, session)
    values = {**data.model_dump(mode='json'), 'project_id': str(project_id),
              'status': 'open', 'created_by': session['user_id']}
    rows, _ = await task_database_request('POST', token=session['token'], table='blockers', payload=values)
    if not rows:
        raise HTTPException(403, 'No fue posible registrar el impedimento.')
    return rows[0]


@project_router.get('/{blocker_id}', response_model=BlockerOut)
async def get_blocker(project_id: UUID, blocker_id: UUID,
                      session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session)
    return await _blocker(project_id, blocker_id, session)


@project_router.patch('/{blocker_id}', response_model=BlockerOut)
async def update_blocker(project_id: UUID, blocker_id: UUID, data: BlockerUpdate,
                         session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    current = await _blocker(project_id, blocker_id, session)
    if current.get('is_blocking',True) or data.is_blocking: await _blocker_admin(project_id, session)
    values = data.model_dump(mode='json', exclude_unset=True)
    if values.get('task_id'):
        await _task(project_id, UUID(str(values['task_id'])), session)
    if 'status' in values:
        if values['status'] == 'resolved':
            values['resolved_by'] = session['user_id']
            values['resolved_at'] = datetime.now(timezone.utc).isoformat()
        else:
            values['resolved_by'] = None
            values['resolved_at'] = None
    rows, _ = await task_database_request('PATCH', token=session['token'], table='blockers',
        filters={'project_id': f'eq.{project_id}', 'id': f'eq.{blocker_id}'}, payload=values)
    if not rows:
        raise HTTPException(403, 'No fue posible actualizar el impedimento.')
    return rows[0]


@project_router.delete('/{blocker_id}', status_code=204)
async def delete_blocker(project_id: UUID, blocker_id: UUID,
                         session: dict = Depends(get_authenticated_session)):
    await _project(project_id, session, writable=True)
    await _blocker_admin(project_id, session)
    await _blocker(project_id, blocker_id, session)
    rows, _ = await task_database_request('DELETE', token=session['token'], table='blockers',
        filters={'project_id': f'eq.{project_id}', 'id': f'eq.{blocker_id}'})
    if not rows:
        raise HTTPException(403, 'Solo un administrador puede eliminar impedimentos.')
    return None
