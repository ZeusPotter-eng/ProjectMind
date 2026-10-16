"""El perfil solo admite cambios del usuario conectado. No usa Supabase real."""
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.api.routes import profile, projects
from app.schemas.profile import ProfileUpdate

USER = "20000000-0000-4000-8000-000000000001"
PROFILE = {
    "id": USER, "full_name": "Cuenta Ejemplo", "job_title": "Diseñador",
    "bio": "Proyectos", "avatar_path": "violet",
    "created_at": "2026-10-10T10:00:00Z", "updated_at": "2026-10-10T10:00:00Z",
}


@pytest.fixture
def api(monkeypatch):
    state = dict(PROFILE)
    requests = []

    async def session():
        return {"token": "jwt-user", "user_id": USER}

    async def db(method, *, access_token, user_id, payload=None):
        requests.append((method, access_token, user_id, payload))
        assert access_token == "jwt-user" and user_id == USER
        if method == "PATCH":
            state.update(payload)
        return [dict(state)]

    monkeypatch.setattr(profile, "profile_database_request", db)
    app = FastAPI()
    app.include_router(profile.router, prefix="/api/v1")
    app.dependency_overrides[projects.get_authenticated_session] = session
    with TestClient(app) as client:
        yield client, state, requests


def test_get_and_edit_own_profile(api):
    client, state, requests = api
    assert client.get("/api/v1/profile/me").json()["full_name"] == "Cuenta Ejemplo"
    response = client.patch("/api/v1/profile/me", json={"full_name": "Nuevo Nombre", "job_title": "Líder", "avatar_path": "ocean"})
    assert response.status_code == 200, response.text
    assert state["full_name"] == "Nuevo Nombre"
    assert requests[-1][3] == {"full_name": "Nuevo Nombre", "job_title": "Líder", "avatar_path": "ocean"}


def test_rejects_escalation_and_empty_payload(api):
    client, _, _ = api
    assert client.patch("/api/v1/profile/me", json={}).status_code == 422
    assert client.patch("/api/v1/profile/me", json={"id": USER}).status_code == 422
    assert client.patch("/api/v1/profile/me", json={"is_active": False}).status_code == 422
    assert client.patch("/api/v1/profile/me", json={"avatar_path": "https://untrusted.com/image.svg"}).status_code == 422
    assert client.patch("/api/v1/profile/me", json={"full_name": ""}).status_code == 422


def test_session_is_required():
    app = FastAPI()
    app.include_router(profile.router, prefix="/api/v1")
    with TestClient(app) as client:
        assert client.get("/api/v1/profile/me").status_code == 401
        assert client.patch("/api/v1/profile/me", json={"full_name": "Test"}).status_code == 401


def test_postgrest_is_owner_scoped_in_service():
    from app.services import profile_service
    assert "eq.{user_id}" in __import__('inspect').getsource(profile_service.profile_database_request)


def test_member_list_can_use_public_profile_theme():
    from app.services.member_service import serialize_member
    row = {
        "project_id": "10000000-0000-4000-8000-000000000001", "user_id": USER,
        "role": "member", "status": "active", "joined_at": "2026-10-10T10:00:00Z",
        "profiles": {"full_name": "Nuevo Nombre", "job_title": "Diseñador UX", "avatar_path": "ocean"},
    }
    member = serialize_member(row)
    assert member["avatar_path"] == "ocean"
    assert member["job_title"] == "Diseñador UX"
