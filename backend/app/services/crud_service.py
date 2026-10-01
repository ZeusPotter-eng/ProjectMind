from typing import Any

from app.core.supabase import get_supabase_admin
from app.services.crud_registry import CrudResource


class CrudValidationError(ValueError):
    pass


def _clean_payload(resource: CrudResource, payload: dict[str, Any], *, update: bool) -> dict[str, Any]:
    unknown = sorted(set(payload) - set(resource.columns))
    if unknown:
        raise CrudValidationError(
            f"Campos no reconocidos para {resource.name}: {', '.join(unknown)}"
        )

    clean = dict(payload)
    if update:
        for field in resource.immutable_fields:
            clean.pop(field, None)

    if not update:
        missing = [
            field
            for field in resource.required_fields
            if field not in clean or clean[field] is None or clean[field] == ""
        ]
        if missing:
            raise CrudValidationError(
                f"Faltan campos obligatorios: {', '.join(missing)}"
            )

    if update and not clean:
        raise CrudValidationError("No hay campos editables para actualizar.")

    return clean


def _validate_key(resource: CrudResource, key: dict[str, Any]) -> dict[str, Any]:
    expected = set(resource.primary_key)
    provided = set(key)
    missing = sorted(expected - provided)
    extra = sorted(provided - expected)

    if missing:
        raise CrudValidationError(
            f"Faltan campos de clave primaria: {', '.join(missing)}"
        )
    if extra:
        raise CrudValidationError(
            f"La clave contiene campos no permitidos: {', '.join(extra)}"
        )

    for field in resource.primary_key:
        if key[field] is None or key[field] == "":
            raise CrudValidationError(f"La clave primaria {field} no puede estar vacía.")

    return key


def _apply_key(query, resource: CrudResource, key: dict[str, Any]):
    for field in resource.primary_key:
        query = query.eq(field, key[field])
    return query


def list_rows(resource: CrudResource, *, limit: int, offset: int) -> tuple[list[dict], int]:
    client = get_supabase_admin()
    response = (
        client.table(resource.name)
        .select("*", count="exact")
        .range(offset, offset + limit - 1)
        .execute()
    )
    return response.data or [], response.count or 0


def get_row(resource: CrudResource, key: dict[str, Any]) -> dict | None:
    client = get_supabase_admin()
    valid_key = _validate_key(resource, key)
    query = client.table(resource.name).select("*")
    response = _apply_key(query, resource, valid_key).limit(1).execute()
    items = response.data or []
    return items[0] if items else None


def create_row(resource: CrudResource, payload: dict[str, Any]) -> dict:
    client = get_supabase_admin()
    clean = _clean_payload(resource, payload, update=False)
    response = client.table(resource.name).insert(clean).execute()
    items = response.data or []
    return items[0] if items else clean


def update_row(resource: CrudResource, key: dict[str, Any], payload: dict[str, Any]) -> dict | None:
    client = get_supabase_admin()
    valid_key = _validate_key(resource, key)
    clean = _clean_payload(resource, payload, update=True)
    query = client.table(resource.name).update(clean)
    response = _apply_key(query, resource, valid_key).execute()
    items = response.data or []
    return items[0] if items else None


def delete_row(resource: CrudResource, key: dict[str, Any]) -> dict | None:
    client = get_supabase_admin()
    valid_key = _validate_key(resource, key)
    query = client.table(resource.name).delete()
    response = _apply_key(query, resource, valid_key).execute()
    items = response.data or []
    return items[0] if items else None
