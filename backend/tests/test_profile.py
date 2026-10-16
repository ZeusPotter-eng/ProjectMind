"""Perfil y fotos: pruebas sin red contra endpoints y reglas de validación."""
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import profile, projects
from app.services.profile_service import is_storage_avatar, validate_photo

USER = "20000000-0000-4000-8000-000000000001"
OTHER = "20000000-0000-4000-8000-000000000002"
PROFILE = {
    "id": USER, "full_name": "Cuenta Ejemplo", "job_title": "Diseñador",
    "bio": "Proyectos", "avatar_path": "violet", "company": None, "department": None,
    "location": None, "website": None, "skills": None,
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
        assert access_token == "jwt-user"
        if user_id != USER:
            return []  # Un perfil no compartido queda oculto por RLS.
        if method == "PATCH":
            state.update(payload)
        return [dict(state)]

    async def upload(access_token, user_id, content, content_type):
        assert access_token == "jwt-user" and user_id == USER
        assert content_type == "image/png"
        return USER + "/" + "a" * 32 + ".png"

    async def sign(access_token, path):
        assert path.startswith(USER)
        return "https://supabase.test/storage/v1/object/sign/avatars/signed?token=fake"

    async def cleanup(access_token, user_id, path):
        assert access_token == "jwt-user"
        return None

    monkeypatch.setattr(profile, "profile_database_request", db)
    monkeypatch.setattr(profile, "upload_avatar", upload)
    monkeypatch.setattr(profile, "signed_avatar_url", sign)
    monkeypatch.setattr(profile, "delete_avatar", cleanup)
    app = FastAPI()
    app.include_router(profile.router, prefix="/api/v1")
    app.dependency_overrides[projects.get_authenticated_session] = session
    with TestClient(app) as client:
        yield client, state, requests


def test_get_and_edit_profile(api):
    client, state, requests = api
    assert client.get("/api/v1/profile/me").json()["full_name"] == "Cuenta Ejemplo"
    result = client.patch("/api/v1/profile/me", json={
        "full_name": "Nuevo Nombre", "job_title": "Líder", "avatar_path": "ocean",
        "company": "Universidad", "department": "Tecnología", "location": "Querétaro",
        "website": "https://example.com", "skills": "React, Python"
    })
    assert result.status_code == 200, result.text
    assert state["skills"] == "React, Python"
    assert requests[-1][2] == USER


def test_rejects_invalid_and_unsafe_fields(api):
    client, _, _ = api
    for payload in [
        {}, {"id": USER}, {"is_active": False}, {"avatar_path": "https://evil.test/photo.svg"},
        {"avatar_path": OTHER + "/" + "a" * 32 + ".jpg"},
        {"full_name": ""}, {"website": "javascript:alert(1)"},
    ]:
        assert client.patch("/api/v1/profile/me", json=payload).status_code == 422


def test_avatar_upload_and_private_signed_url(api):
    client, state, _ = api
    good_png = b"\x89PNG\r\n\x1a\n" + b"12345678"
    response = client.post("/api/v1/profile/me/avatar", files={"file": ("foto.png", good_png, "image/png")})
    assert response.status_code == 200, response.text
    assert state["avatar_path"] == USER + "/" + "a" * 32 + ".png"
    signed = client.get(f"/api/v1/profile/avatar/{USER}")
    assert signed.status_code == 200
    assert signed.json()["url"].startswith("https://")
    assert signed.headers.get("cache-control") == "no-store"


def test_avatar_upload_rejects_fake_image_and_large_content(api):
    client, _, _ = api
    fake = client.post("/api/v1/profile/me/avatar", files={"file": ("fake.png", b"hello", "image/png")})
    assert fake.status_code == 422
    large = client.post("/api/v1/profile/me/avatar", files={"file": ("big.png", b"\x89PNG\r\n\x1a\n" + b"a" * (5 * 1024 * 1024), "image/png")})
    assert large.status_code == 422


def test_avatar_reader_cannot_access_unrelated_profile(api):
    client, _, _ = api
    assert client.get(f"/api/v1/profile/avatar/{OTHER}").status_code == 404
    assert client.get("/api/v1/profile/avatar/not-a-uuid").status_code == 422


def test_avatar_validation_helpers():
    p = USER + "/" + "a" * 32 + ".webp"
    assert is_storage_avatar(p, USER)
    assert not is_storage_avatar(p, OTHER)
    assert not is_storage_avatar("../../secret", USER)
    assert validate_photo(b"RIFF" + b"\x00" * 4 + b"WEBP" + b"a", "image/webp") == ("image/webp", "webp")
    assert validate_photo(b"\xff\xd8\xff" + b"data" + b"\xff\xd9", "image/jpeg") == ("image/jpeg", "jpg")


def test_requires_valid_session():
    app = FastAPI()
    app.include_router(profile.router, prefix="/api/v1")
    with TestClient(app) as client:
        assert client.get("/api/v1/profile/me").status_code == 401
        assert client.post("/api/v1/profile/me/avatar", files={"file": ("a.png", b"x", "image/png")}).status_code == 401


def test_postgrest_is_owner_scoped_in_service():
    from app.services import profile_service
    assert '"id": f"eq.{user_id}"' in __import__('inspect').getsource(profile_service.profile_database_request)


def test_member_list_can_show_own_profile_photo_path():
    from app.services.member_service import serialize_member
    path = USER + "/" + "a" * 32 + ".png"
    row = {
        "project_id": "10000000-0000-4000-8000-000000000001", "user_id": USER,
        "role": "member", "status": "active", "joined_at": "2026-10-10T10:00:00Z",
        "profiles": {"full_name": "Nuevo Nombre", "job_title": "Diseñador UX", "avatar_path": path},
    }
    member = serialize_member(row)
    assert member["avatar_path"] == path
    assert member["job_title"] == "Diseñador UX"
