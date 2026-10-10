"""Pruebas del PM-13 sin conectar a producción ni usar credenciales reales."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import projects
from app.schemas.projects import ProjectCreate, ProjectUpdate


@pytest.fixture
def client(monkeypatch):
    db = {}
    fixed_id = "10000000-0000-4000-8000-000000000001"
    user_id = "20000000-0000-4000-8000-000000000001"

    async def fake_session():
        return {"token": "validated-token", "user_id": user_id}

    async def fake_request(method, *, access_token, project_id=None, payload=None, params=None, exact_count=False):
        assert access_token == "validated-token"
        if method == "POST":
            assert payload["owner_id"] == user_id
            row = {"id": fixed_id, **payload, "created_at": "2026-10-10T10:00:00+00:00", "updated_at": "2026-10-10T10:00:00+00:00"}
            db[fixed_id] = row
            return [row], 0
        if method == "GET":
            rows = list(db.values())
            if project_id: rows = [row for row in rows if row["id"] == project_id]
            if params and params.get("status") == "neq.archived": rows = [row for row in rows if row["status"] != "archived"]
            count = len(rows)
            if params and "offset" in params: rows = rows[params["offset"]:][:params["limit"]]
            return rows, count
        if method == "PATCH":
            if project_id not in db: return [], 0
            db[project_id].update(payload)
            return [db[project_id]], 0
        raise AssertionError(method)

    app = FastAPI()
    app.include_router(projects.router, prefix="/api/v1")
    app.dependency_overrides[projects.get_authenticated_session] = fake_session
    monkeypatch.setattr(projects, "project_database_request", fake_request)
    with TestClient(app) as api:
        yield api, db


def test_create_list_edit_archive(client):
    api, _db = client
    response = api.post('/api/v1/projects', json={"name": "ProjectMind", "objective": "Administrar proyectos de manera segura"})
    assert response.status_code == 201, response.text
    created = response.json()
    assert created['owner_id'] == '20000000-0000-4000-8000-000000000001'
    response = api.get('/api/v1/projects')
    assert response.status_code == 200
    assert response.json()['count'] == 1
    id = created['id']
    response = api.patch(f'/api/v1/projects/{id}', json={"status": "active", "start_date": "2026-10-10", "due_date": "2026-10-20"})
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'active'
    assert api.patch(f'/api/v1/projects/{id}', json={"due_date": "2026-10-01"}).status_code == 422
    response = api.patch(f'/api/v1/projects/{id}/archive')
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'archived'
    assert api.get('/api/v1/projects').json()['count'] == 0
    assert api.get('/api/v1/projects?include_archived=true').json()['count'] == 1


def test_validation_and_inaccessible(client):
    api, _db = client
    assert api.post('/api/v1/projects', json={"name": "A", "objective": "Breve"}).status_code == 422
    assert api.post('/api/v1/projects', json={"name": "Plan", "objective": "Objetivo largo", "owner_id": "attacker"}).status_code == 422
    assert api.post('/api/v1/projects', json={"name": "Plan", "objective": "Objetivo largo"}).status_code == 201
    assert api.patch('/api/v1/projects/10000000-0000-4000-8000-000000000001', json={"owner_id": "attacker"}).status_code == 422
    assert api.get('/api/v1/projects/00000000-0000-4000-8000-000000000000').status_code == 404


def test_date_validation():
    with pytest.raises(ValueError):
        ProjectCreate(name="Proyecto", objective="Objetivo importante", start_date="2026-11-10", due_date="2026-10-10")
    with pytest.raises(ValueError):
        ProjectUpdate(status=None)
    with pytest.raises(ValueError):
        ProjectUpdate()


def test_endpoint_requires_login():
    app = FastAPI()
    app.include_router(projects.router, prefix="/api/v1")
    with TestClient(app) as api:
        response = api.get('/api/v1/projects')
        assert response.status_code == 401
        assert 'sesión válida' in response.json()['detail']
