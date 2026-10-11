"""PM-15: pruebas de permisos y gestión sin acceder a Supabase de producción."""
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import members, projects
from app.schemas.members import AddMember, UpdateMember

PROJECT = "10000000-0000-4000-8000-000000000001"
OWNER = "20000000-0000-4000-8000-000000000001"
ADMIN = "20000000-0000-4000-8000-000000000002"
MEMBER = "20000000-0000-4000-8000-000000000003"
NEW_USER = "20000000-0000-4000-8000-000000000004"
ANOTHER_PROJECT = "10000000-0000-4000-8000-000000000002"


def row(user_id, role="member", status="active"):
    return {
        "project_id": PROJECT, "user_id": user_id, "role": role,
        "status": status, "joined_at": "2026-10-10T10:00:00+00:00",
        "profiles": {"full_name": "Cuenta de prueba"},
    }


@pytest.fixture
def api(monkeypatch):
    state = {"actor": OWNER, "rows": [row(OWNER, "owner"), row(ADMIN, "admin"), row(MEMBER)], "archived": False}

    async def session():
        return {"token": "test-jwt", "user_id": state["actor"]}

    async def read_project(project_id, session):
        if str(project_id) == ANOTHER_PROJECT:
            from fastapi import HTTPException
            raise HTTPException(404, "No tienes acceso al proyecto.")
        return {"id": PROJECT, "owner_id": OWNER, "status": "archived" if state["archived"] else "active"}

    async def db(method, *, access_token, project_id, user_id=None, payload=None, select_profiles=True):
        assert access_token == "test-jwt"
        assert project_id == PROJECT
        if method == "GET":
            # La vista de producción filtra con RLS: la simulamos por separado.
            return [dict(item) for item in state["rows"]]
        if method == "POST":
            created = row(payload["user_id"], payload["role"])
            state["rows"].append(created)
            return [dict(created)]
        if method == "PATCH":
            for item in state["rows"]:
                if item["user_id"] == user_id:
                    item.update(payload)
                    return [dict(item)]
            return []
        raise AssertionError(method)

    monkeypatch.setattr(members, "get_project", read_project)
    monkeypatch.setattr(members, "member_database_request", db)
    app = FastAPI()
    app.include_router(members.router, prefix="/api/v1")
    app.dependency_overrides[projects.get_authenticated_session] = session
    with TestClient(app) as client:
        yield client, state


def test_owner_can_list_add_edit_and_remove(api):
    client, state = api
    url = f"/api/v1/projects/{PROJECT}/members"
    assert client.get(url).json()["active_count"] == 3
    created = client.post(url, json={"user_id": NEW_USER, "role": "member"})
    assert created.status_code == 201, created.text
    assert created.json()["role"] == "member"
    edited = client.patch(f"{url}/{NEW_USER}", json={"role": "admin"})
    assert edited.status_code == 200, edited.text
    assert edited.json()["role"] == "admin"
    removed = client.patch(f"{url}/{NEW_USER}", json={"status": "removed"})
    assert removed.status_code == 200
    assert removed.json()["status"] == "removed"
    assert client.get(url).json()["active_count"] == 3
    reactivated = client.patch(f"{url}/{NEW_USER}", json={"status": "active"})
    assert reactivated.status_code == 200
    assert client.get(url).json()["active_count"] == 4
    assert len(state["rows"]) == 4


def test_member_cannot_manage_and_cannot_change_owner(api):
    client, state = api
    url = f"/api/v1/projects/{PROJECT}/members"
    state["actor"] = MEMBER
    assert client.get(url).status_code == 200
    assert client.post(url, json={"user_id": NEW_USER}).status_code == 403
    assert client.patch(f"{url}/{ADMIN}", json={"role": "member"}).status_code == 403
    state["actor"] = ADMIN
    assert client.post(url, json={"user_id": NEW_USER}).status_code == 201
    assert client.patch(f"{url}/{OWNER}", json={"status": "removed"}).status_code == 403
    assert client.patch(f"{url}/{ADMIN}", json={"status": "removed"}).status_code == 403


def test_duplicate_invalid_payload_archived_and_limit(api):
    client, state = api
    url = f"/api/v1/projects/{PROJECT}/members"
    assert client.post(url, json={"user_id": ADMIN}).status_code == 409
    assert client.post(url, json={"user_id": "not-an-id"}).status_code == 422
    assert client.post(url, json={"user_id": NEW_USER, "role": "owner"}).status_code == 422
    assert client.patch(f"{url}/{ADMIN}", json={}).status_code == 422
    assert client.patch(f"{url}/{ADMIN}", json={"status": "unknown"}).status_code == 422
    assert client.get(f"/api/v1/projects/{ANOTHER_PROJECT}/members").status_code == 404
    state["archived"] = True
    assert client.post(url, json={"user_id": NEW_USER}).status_code == 409
    state["archived"] = False
    for i in range(12):
        state["rows"].append(row(f"30000000-0000-4000-8000-{i:012d}"))
    assert client.get(url).json()["active_count"] == 15
    assert client.post(url, json={"user_id": NEW_USER}).status_code == 409


def test_no_session_rejected():
    app = FastAPI()
    app.include_router(members.router, prefix="/api/v1")
    with TestClient(app) as client:
        assert client.get(f"/api/v1/projects/{PROJECT}/members").status_code == 401


def test_schema_rejects_escalation_and_missing_values():
    with pytest.raises(ValueError):
        AddMember(user_id=UUID(NEW_USER), role="owner")
    with pytest.raises(ValueError):
        UpdateMember()
    with pytest.raises(ValueError):
        UpdateMember(role=None)
