"""PM-12: Supabase Auth proxy. Public credentials only; no service role."""
from typing import Any

import httpx
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.core.config import get_settings

router = APIRouter(prefix="/auth", tags=["Auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


def public_config() -> tuple[str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503, "Supabase Auth no está configurado en el backend.")
    return settings.supabase_url.rstrip("/"), settings.supabase_client_key


async def supabase_auth(method: str, path: str, *, payload: dict | None = None, token: str | None = None) -> Any:
    url, key = public_config()
    headers = {"apikey": key, "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        headers["Authorization"] = f"Bearer {key}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            result = await client.request(method, f"{url}/auth/v1/{path}", headers=headers, json=payload)
    except httpx.RequestError:
        raise HTTPException(502, "No se pudo contactar al servicio de autenticación.") from None
    if result.status_code >= 400:
        data = result.json() if "json" in result.headers.get("content-type", "") else {}
        message = data.get("msg") or data.get("error_description") or data.get("message") or "Operación de autenticación rechazada."
        raise HTTPException(result.status_code if result.status_code < 500 else 502, str(message))
    if not result.content:
        return {"ok": True}
    return result.json()


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer ") or not authorization[7:].strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Se requiere una sesión válida.")
    return authorization[7:].strip()


@router.get("/status")
async def module_status():
    settings = get_settings()
    return {"module": "auth", "configured": bool(settings.supabase_url and settings.supabase_client_key)}


@router.post("/register")
async def register(data: Credentials):
    return await supabase_auth("POST", "signup", payload=data.model_dump())


@router.post("/login")
async def login(data: Credentials):
    return await supabase_auth("POST", "token?grant_type=password", payload=data.model_dump())


@router.post("/refresh")
async def refresh(data: RefreshRequest):
    return await supabase_auth("POST", "token?grant_type=refresh_token", payload={"refresh_token": data.refresh_token})


@router.get("/me")
async def me(authorization: str | None = Header(default=None)):
    return await supabase_auth("GET", "user", token=bearer(authorization))


@router.post("/logout")
async def logout(authorization: str | None = Header(default=None)):
    return await supabase_auth("POST", "logout", token=bearer(authorization))
