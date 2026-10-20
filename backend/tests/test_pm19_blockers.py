"""PM-19: pruebas integradas en memoria, sin escribir en Supabase real."""
import sys
from pathlib import Path
from uuid import UUID
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from app.api.routes import blockers, projects, tasks
from app.services import blocker_service
from app.schemas.blockers import BlockerCreate, BlockerUpdate

P = '10000000-0000-4000-8000-000000000001'
OTHER = '10000000-0000-4000-8000-000000000002'
U = '20000000-0000-4000-8000-000000000001'
A = '40000000-0000-4000-8000-000000000001'
B = '40000000-0000-4000-8000-000000000002'
C = '40000000-0000-4000-8000-000000000003'
X = '40000000-0000-4000-8000-000000000004'
D = '60000000-0000-4000-8000-000000000001'
NOW = '2026-10-19T16:00:00Z'


@pytest.fixture
def api(monkeypatch):
    archive = {'value': False}
    rows = {
        'tasks': {
            key: {'id': key, 'project_id': P if key != X else OTHER,
                  'title': label, 'description': None, 'status': 'todo', 'progress': 0,
                  'priority': 'medium', 'start_date': None, 'due_date': None,
                  'created_by': U, 'updated_by': None, 'completed_at': None,
                  'created_at': NOW, 'updated_at': NOW}
            for key, label in ((A, 'Definir requisitos'), (B, 'Desarrollar backend'), (C, 'Pruebas'), (X, 'Externa'))
        },
        'task_dependencies': {D: {'id': D, 'project_id': P, 'task_id': B, 'depends_on_task_id': A}},
        'blockers': {},
        'task_assignees': {},
    }

    async def session():
        return {'token': 'mock-jwt', 'user_id': U}

    async def project(project_id, _session, *, writable=False):
        if str(project_id) != P:
            raise HTTPException(404, 'No hay acceso al proyecto')
        if writable and archive['value']:
            raise HTTPException(409, 'Proyecto archivado')
        return {'status': 'archived' if archive['value'] else 'active'}

    async def db(method, *, token, table='tasks', filters=None, payload=None, count=False, select='*'):
        assert token == 'mock-jwt'
        assert table in rows
        if table == 'task_assignees':
            return [], 0
        data = rows[table]
        subset = list(data.values())
        filters = filters or {}
        for key, spec in filters.items():
            if key in ('limit', 'offset', 'order'): continue
            if spec.startswith('eq.'):
                subset = [r for r in subset if str(r.get(key)) == spec[3:]]
            if spec.startswith('in.('):
                choices = spec[4:-1].split(',')
                subset = [r for r in subset if str(r.get(key)) in choices]
        if method == 'GET':
            total = len(subset)
            subset = subset[int(filters.get('offset', 0)):int(filters.get('offset', 0)) + int(filters.get('limit', 1000))]
            return subset, total
        if method == 'POST':
            item = {'id': str(UUID(int=len(data) + 100)), 'created_at': NOW,
                    'updated_at': NOW, 'resolved_by': None, 'resolved_at': None,
                    **payload}
            data[item['id']] = item
            return [item], 0
        if method == 'PATCH':
            if not subset: return [], 0
            subset[0].update(payload)
            return subset[:1], 0
        if method == 'DELETE':
            if not subset: return [], 0
            return [data.pop(subset[0]['id'])], 0
        raise AssertionError(method)

    monkeypatch.setattr(tasks, '_project', project)
    monkeypatch.setattr(blockers, '_project', project)
    monkeypatch.setattr(tasks, 'task_database_request', db)
    monkeypatch.setattr(blockers, 'task_database_request', db)
    monkeypatch.setattr(blocker_service, 'task_database_request', db)

    app = FastAPI()
    app.include_router(blockers.router, prefix='/api/v1')
    app.include_router(blockers.project_router, prefix='/api/v1')
    app.include_router(tasks.router, prefix='/api/v1')
    app.dependency_overrides[projects.get_authenticated_session] = session
    with TestClient(app) as client:
        yield client, rows, archive


def test_predecessor_blocks_work_but_not_metadata(api):
    client, rows, _ = api
    base = f'/api/v1/projects/{P}/tasks'
    assert client.patch(f'{base}/{B}', json={'status': 'in_progress'}).status_code == 409
    assert client.patch(f'{base}/{B}', json={'progress': 10}).status_code == 409
    assert client.patch(f'{base}/{B}', json={'status': 'done'}).status_code == 409
    assert client.patch(f'{base}/{B}', json={'title': 'Backend actualizado'}).status_code == 200
    assert client.patch(f'{base}/{B}', json={'status': 'blocked'}).status_code == 200
    assert client.patch(f'{base}/{B}', json={'progress': 0}).status_code == 200
    assert client.patch(f'{base}/{A}', json={'status': 'done'}).status_code == 200
    assert client.patch(f'{base}/{B}', json={'status': 'in_progress', 'progress': 10}).status_code == 200
    assert rows['tasks'][B]['progress'] == 10


def test_blocker_crud_status_transitions_and_permissions(api):
    client, rows, archive = api
    base = f'/api/v1/projects/{P}/blockers'
    tasks_base = f'/api/v1/projects/{P}/tasks'
    assert client.get('/api/v1/blockers/status').json()['module'] == 'blockers'
    assert client.post(base, json={'title': 'Mal proyecto', 'task_id': X}).status_code == 404
    assert client.post(base, json={'title': 'Omitido', 'status': 'resolved'}).status_code == 422
    response = client.post(base, json={'title': 'Esperar credenciales', 'task_id': C, 'severity': 'critical'})
    assert response.status_code == 201, response.text
    item = response.json(); ident = item['id']
    assert item['status'] == 'open' and item['created_by'] == U
    assert client.get(base).json()['count'] == 1
    assert client.get(f'{base}/{ident}').status_code == 200
    assert client.patch(f'{tasks_base}/{C}', json={'status': 'done'}).status_code == 409
    assert client.patch(f'{base}/{ident}', json={'status': 'resolved'}).status_code == 200
    assert rows['blockers'][ident]['resolved_by'] == U
    assert rows['blockers'][ident]['resolved_at']
    assert client.patch(f'{tasks_base}/{C}', json={'status': 'done'}).status_code == 200
    assert client.patch(f'{base}/{ident}', json={'status': 'open'}).status_code == 200
    assert rows['blockers'][ident]['resolved_at'] is None
    assert client.patch(f'{base}/{ident}', json={'title': 'Impedimento repetido'}).status_code == 200
    assert client.patch(f'{base}/{ident}', json={}).status_code == 422
    assert client.patch(f'{base}/{ident}', json={'task_id': X}).status_code == 404
    assert client.patch(f'{base}/{ident}', json={'created_by': U}).status_code == 422
    assert client.post(f'/api/v1/projects/{OTHER}/blockers', json={'title': 'Sin acceso'}).status_code == 404
    archive['value'] = True
    assert client.get(base).status_code == 200
    assert client.post(base, json={'title': 'Archivado'}).status_code == 409
    assert client.patch(f'{base}/{ident}', json={'status': 'resolved'}).status_code == 409
    assert client.delete(f'{base}/{ident}').status_code == 409
    archive['value'] = False
    assert client.delete(f'{base}/{ident}').status_code == 204
    assert client.get(base).json()['count'] == 0


def test_project_wide_blocker_is_informational(api):
    client, _, _ = api
    base = f'/api/v1/projects/{P}'
    assert client.post(f'{base}/blockers', json={'title': 'Falta una reunión'}).status_code == 201
    assert client.patch(f'{base}/tasks/{C}', json={'status': 'in_progress'}).status_code == 200


def test_validations():
    with pytest.raises(ValueError):
        BlockerCreate(title='xx')
    with pytest.raises(ValueError):
        BlockerUpdate()
    with pytest.raises(ValueError):
        BlockerUpdate(status=None)
    assert blocker_service.requires_gate({'status': 'todo', 'progress': 20}, {'title': 'Editar'}) is False
    assert blocker_service.requires_gate({'status': 'todo', 'progress': 20}, {'progress': 30}) is True
    assert blocker_service.requires_gate({'status': 'done', 'progress': 100}, {'status': 'todo', 'progress': 0}) is False
