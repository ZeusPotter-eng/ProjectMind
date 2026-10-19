"""PM-18: CRUD simulado y validaciones sin modificar datos productivos."""
import sys
from pathlib import Path
from uuid import UUID
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes import dependencies, projects
from app.services import dependency_service
from app.schemas.dependencies import DependencyCreate, DependencyUpdate

P = '10000000-0000-4000-8000-000000000001'
Q = '10000000-0000-4000-8000-000000000002'
U = '20000000-0000-4000-8000-000000000001'
A = '40000000-0000-4000-8000-000000000001'
B = '40000000-0000-4000-8000-000000000002'
C = '40000000-0000-4000-8000-000000000003'
X = '40000000-0000-4000-8000-000000000004'
D1 = '50000000-0000-4000-8000-000000000001'
D2 = '50000000-0000-4000-8000-000000000002'
D3 = '50000000-0000-4000-8000-000000000003'


@pytest.fixture
def api(monkeypatch):
    rows = {}
    archived = {'value': False}
    tasks = {A: P, B: P, C: P, X: Q}

    async def session():
        return {'token': 'mock-session', 'user_id': U}

    async def project(project_id, session, *, writable=False):
        if str(project_id) != P:
            raise HTTPException(404, 'Proyecto sin acceso')
        if writable and archived['value']:
            raise HTTPException(409, 'Proyecto archivado')
        return {'id': P, 'status': 'archived' if archived['value'] else 'active'}

    async def db(method, *, token, table='tasks', filters=None, payload=None, count=False, select='*'):
        assert token == 'mock-session'
        filters = filters or {}
        if table == 'tasks':
            task_id = filters.get('id', 'eq.')[3:]
            return ([{'id': task_id}] if tasks.get(task_id) == filters.get('project_id', 'eq.')[3:] else []), 0
        assert table == 'task_dependencies'
        matches = [r for r in rows.values() if r['project_id'] == filters.get('project_id', f'eq.{P}')[3:]]
        if 'id' in filters:
            matches = [r for r in matches if r['id'] == filters['id'][3:]]
        if method == 'GET':
            count_value = len(matches)
            return matches[int(filters.get('offset', 0)):int(filters.get('offset', 0)) + int(filters.get('limit', 500))], count_value
        if method == 'POST':
            ident = [D1, D2, D3][len(rows)]
            row = {'id': ident, 'created_at': '2026-10-19T14:00:00Z', **payload}
            rows[ident] = row
            return [row], 0
        if method == 'PATCH':
            matches[0].update(payload)
            return matches[:1], 0
        if method == 'DELETE':
            if matches:
                return [rows.pop(matches[0]['id'])], 0
            return [], 0
        raise AssertionError(method)

    monkeypatch.setattr(dependencies, '_project', project)
    monkeypatch.setattr(dependencies, 'task_database_request', db)
    monkeypatch.setattr(dependency_service, 'task_database_request', db)
    app = FastAPI()
    app.include_router(dependencies.router, prefix='/api/v1')
    app.include_router(dependencies.project_router, prefix='/api/v1')
    app.dependency_overrides[projects.get_authenticated_session] = session
    with TestClient(app) as client:
        yield client, rows, archived


def test_dependency_crud_and_cycle_detection(api):
    client, edges, _ = api
    base = f'/api/v1/projects/{P}/dependencies'
    assert client.get('/api/v1/dependencies/status').json()['module'] == 'dependencies'
    response = client.post(base, json={'task_id': A, 'depends_on_task_id': B})
    assert response.status_code == 201, response.text
    assert response.json()['created_by'] == U
    assert response.json()['dependency_type'] == 'finish_to_start'
    assert client.get(base).json()['count'] == 1
    assert client.get(f'{base}/{D1}').status_code == 200
    assert client.post(base, json={'task_id': A, 'depends_on_task_id': B}).status_code == 409
    assert client.post(base, json={'task_id': B, 'depends_on_task_id': C}).status_code == 201
    # C -> A forma ciclo A -> B -> C -> A.
    response = client.post(base, json={'task_id': C, 'depends_on_task_id': A})
    assert response.status_code == 409 and 'circular' in response.text
    assert len(edges) == 2
    assert client.patch(f'{base}/{D1}', json={'depends_on_task_id': C}).status_code == 200
    # C -> A ahora generaría A -> C -> A.
    assert client.post(base, json={'task_id': C, 'depends_on_task_id': A}).status_code == 409
    assert client.delete(f'{base}/{D1}').status_code == 204
    assert client.get(base).json()['count'] == 1


def test_validation_isolation_and_archive(api):
    client, _, archived = api
    base = f'/api/v1/projects/{P}/dependencies'
    assert client.post(base, json={'task_id': A, 'depends_on_task_id': A}).status_code == 422
    assert client.post(base, json={'task_id': A, 'depends_on_task_id': X}).status_code == 422
    assert client.post(base, json={'task_id': A, 'depends_on_task_id': B, 'created_by': U}).status_code == 422
    assert client.post(base, json={'task_id': A, 'depends_on_task_id': B, 'dependency_type': 'invalid'}).status_code == 422
    assert client.post(base, json={'task_id': A, 'depends_on_task_id': B}).status_code == 201
    assert client.patch(f'{base}/{D1}', json={}).status_code == 422
    assert client.patch(f'{base}/{D1}', json={'depends_on_task_id': X}).status_code == 422
    assert client.patch(f'{base}/{D1}', json={'task_id': C}).status_code == 422
    assert client.get(f'{base}/{D2}').status_code == 404
    assert client.get(f'/api/v1/projects/{Q}/dependencies').status_code == 404
    archived['value'] = True
    assert client.get(base).status_code == 200
    assert client.post(base, json={'task_id': B, 'depends_on_task_id': C}).status_code == 409
    assert client.patch(f'{base}/{D1}', json={'depends_on_task_id': C}).status_code == 409
    assert client.delete(f'{base}/{D1}').status_code == 409


def test_schema_and_large_cycle():
    with pytest.raises(ValueError):
        DependencyCreate(task_id=UUID(A), depends_on_task_id=UUID(A))
    with pytest.raises(ValueError):
        DependencyUpdate()
    # 501 enlaces: el pre-chequeo debe detectar ciclos aun entre varias páginas.
    vertices = [str(UUID(int=i+1)) for i in range(502)]
    graph = [{'id': str(UUID(int=i+1000)), 'task_id': vertices[i], 'depends_on_task_id': vertices[i+1]} for i in range(501)]
    with pytest.raises(HTTPException) as error:
        dependency_service.validate_dependency_graph(graph, task_id=vertices[-1], depends_on_task_id=vertices[0])
    assert error.value.status_code == 409
