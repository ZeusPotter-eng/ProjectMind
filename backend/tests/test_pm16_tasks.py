"""PM-16: verificación del CRUD con repositorio simulado, sin modificar Supabase."""
import sys
from pathlib import Path
from uuid import UUID
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes import projects, tasks
from app.schemas.tasks import TaskCreate, TaskUpdate

P = '10000000-0000-4000-8000-000000000001'
U = '20000000-0000-4000-8000-000000000001'
V = '30000000-0000-4000-8000-000000000001'
T = '40000000-0000-4000-8000-000000000001'

@pytest.fixture
def api(monkeypatch):
    store = {}
    assigned = set()
    archive = {'value': False}
    async def session():
        return {'token': 'safe-jwt', 'user_id': U}
    async def project(project_id, session):
        if str(project_id) != P:
            from fastapi import HTTPException
            raise HTTPException(404, 'Proyecto inaccesible')
        return {'id': P, 'status': 'archived' if archive['value'] else 'active', 'owner_id': U}
    async def members(method, *, access_token, project_id, select_profiles=True, **kw):
        return [{'user_id': U, 'status': 'active'}, {'user_id': V, 'status': 'active'}]
    async def db(method, *, token, table='tasks', filters=None, payload=None, count=False, select='*'):
        assert token == 'safe-jwt'
        if table == 'task_assignees':
            if method == 'GET':
                ids = (filters or {}).get('task_id', 'in.()')
                return [{'task_id': tid, 'user_id': uid} for tid, uid in assigned if tid in ids], 0
            if method == 'POST':
                assigned.add((payload['task_id'], payload['user_id']))
                return [payload], 0
            if method == 'DELETE':
                key = (filters['task_id'][3:], filters['user_id'][3:])
                if key in assigned: assigned.remove(key); return [{'task_id': key[0], 'user_id': key[1]}], 0
                return [], 0
        if method == 'POST':
            row = {'id': T, 'created_at': '2026-10-16T00:00:00+00:00', 'updated_at': '2026-10-16T00:00:00+00:00', 'updated_by': None, 'completed_at': None, **payload}
            store[T] = row
            return [row], 0
        if method == 'GET':
            rows = list(store.values())
            if (filters or {}).get('id'): rows = [r for r in rows if r['id'] == filters['id'][3:]]
            return rows, len(rows)
        if method == 'PATCH':
            store[T].update(payload)
            return [store[T]], 0
        if method == 'DELETE':
            return [store.pop(T)], 0
        raise AssertionError(method)
    monkeypatch.setattr(tasks, 'get_project', project)
    monkeypatch.setattr(tasks, 'task_database_request', db)
    monkeypatch.setattr(tasks, 'member_database_request', members)
    app = FastAPI()
    app.include_router(tasks.router, prefix='/api/v1')
    app.include_router(tasks.status_router, prefix='/api/v1')
    app.dependency_overrides[projects.get_authenticated_session] = session
    with TestClient(app) as client:
        yield client, store, assigned, archive

def test_task_crud_and_assignees(api):
    client, store, assigned, _ = api
    root = f'/api/v1/projects/{P}/tasks'
    response = client.post(root, json={'title': 'Implementar tablero', 'priority': 'high', 'progress': 30})
    assert response.status_code == 201, response.text
    assert response.json()['created_by'] == U
    assert client.get(root).json()['count'] == 1
    assert client.post(f'{root}/{T}/assignees/{V}').status_code == 200
    assert client.get(f'{root}/{T}').json()['assignees'] == [V]
    assert client.delete(f'{root}/{T}/assignees/{V}').status_code == 200
    assert client.patch(f'{root}/{T}', json={'status': 'done'}).json()['progress'] == 100
    assert client.patch(f'{root}/{T}', json={'status': 'in_progress'}).status_code == 422
    assert client.patch(f'{root}/{T}', json={'status': 'in_progress', 'progress': 60}).status_code == 200
    assert client.delete(f'{root}/{T}').status_code == 204
    assert client.get(root).json()['count'] == 0

def test_task_validation_and_isolation(api):
    client, _, _, archive = api
    root = f'/api/v1/projects/{P}/tasks'
    assert client.post(root, json={'title': 'x'}).status_code == 422
    assert client.post(root, json={'title': 'Tarea de prueba', 'created_by': V}).status_code == 422
    assert client.post(root, json={'title': 'Tarea de prueba', 'start_date': '2026-11-01', 'due_date': '2026-10-01'}).status_code == 422
    assert client.post(root, json={'title': 'Tarea de prueba', 'status': 'done'}).status_code == 422
    assert client.post(root, json={'title': 'Tarea de prueba'}).status_code == 201
    assert client.patch(f'{root}/{T}', json={'project_id': P}).status_code == 422
    assert client.post(f'{root}/{T}/assignees/50000000-0000-4000-8000-000000000001').status_code == 422
    assert client.get('/api/v1/projects/90000000-0000-4000-8000-000000000001/tasks').status_code == 404
    archive['value'] = True
    assert client.patch(f'{root}/{T}', json={'progress': 20}).status_code == 409
    assert client.post(root, json={'title': 'Nueva tarea'}).status_code == 409

def test_schemas_and_no_login():
    with pytest.raises(ValueError):
        TaskCreate(title='Correcto', status='done', progress=10)
    with pytest.raises(ValueError):
        TaskUpdate()
    with pytest.raises(ValueError):
        TaskUpdate(progress=None)
    with TestClient(FastAPI()) as client:
        pass
