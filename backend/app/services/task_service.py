"""Consultas de tareas y responsables bajo JWT del usuario, respetando RLS."""
import logging
from typing import Any
import httpx
from fastapi import HTTPException
from app.core.config import get_settings

log = logging.getLogger(__name__)

async def task_database_request(method: str, *, token: str, table: str = 'tasks', filters: dict | None = None, payload: dict | None = None, count: bool = False, select: str = '*') -> tuple[list[dict[str, Any]], int]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503, 'Supabase no está configurado.')
    params = {'select': select, **(filters or {})}
    headers = {
        'apikey': settings.supabase_client_key,
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation' + (',count=exact' if count else ''),
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(method, f"{settings.supabase_url.rstrip('/')}/rest/v1/{table}", params=params, json=payload, headers=headers)
    except httpx.RequestError:
        raise HTTPException(502, 'No fue posible conectar con Supabase.') from None
    if response.status_code >= 400:
        try:
            error = response.json()
        except ValueError:
            error = {}
        code = error.get('code') if isinstance(error, dict) else None
        log.warning('PM tasks %s: status=%s code=%s', table, response.status_code, code)
        if response.status_code in (401, 403) or code == '42501':
            raise HTTPException(403, 'No tienes permisos para esta operación.')
        if code == '23505':
            raise HTTPException(409, 'Este registro ya existe.')
        if code == 'PM18C':
            raise HTTPException(409, 'Esta relación generaría una dependencia circular.')
        if code == 'PM18P':
            raise HTTPException(422, 'Las tareas deben pertenecer al mismo proyecto.')
        if code == '23503':
            raise HTTPException(422, 'La persona o tarea indicada no existe.')
        if code in ('23514', '22P02', 'P0001'):
            raise HTTPException(422, 'Los datos no cumplen las reglas de la base de datos.')
        raise HTTPException(502, 'La base de datos rechazó la operación.')
    try:
        rows = response.json() if response.content else []
    except ValueError:
        raise HTTPException(502, 'Supabase devolvió una respuesta inesperada.') from None
    total = 0
    if count:
        content_range = response.headers.get('Content-Range', '')
        part = content_range.rsplit('/', 1)[-1]
        if part.isdigit():
            total = int(part)
    return rows, total
