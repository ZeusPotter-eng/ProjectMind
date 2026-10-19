"""PM-18: verificación determinista del grafo antes de insertar/actualizar.

El trigger SQL PM18_DEPENDENCIES_INTEGRITY.sql repite la validación en una
transacción, porque dos peticiones simultáneas pueden saltarse el pre-chequeo.
"""
from uuid import UUID
from fastapi import HTTPException

from app.services.task_service import task_database_request


async def all_project_dependencies(project_id: UUID, token: str) -> list[dict]:
    """Paginar las aristas para evitar omitir ciclos en proyectos grandes."""
    edges: list[dict] = []
    while True:
        batch, _ = await task_database_request(
            'GET', token=token, table='task_dependencies',
            filters={'project_id': f'eq.{project_id}', 'limit': 500, 'offset': len(edges), 'order': 'created_at.asc,id.asc'},
            select='id,task_id,depends_on_task_id',
        )
        edges.extend(batch)
        if len(batch) < 500:
            return edges


def validate_dependency_graph(edges: list[dict], *, task_id: str, depends_on_task_id: str,
                              replacing_id: str | None = None) -> None:
    """La arista A -> B indica que A debe esperar a B."""
    if task_id == depends_on_task_id:
        raise HTTPException(422, 'Una tarea no puede depender de sí misma.')
    adjacency: dict[str, set[str]] = {}
    for edge in edges:
        if str(edge['id']) == replacing_id:
            continue
        child, parent = str(edge['task_id']), str(edge['depends_on_task_id'])
        if child == task_id and parent == depends_on_task_id:
            raise HTTPException(409, 'Esta dependencia ya existe.')
        adjacency.setdefault(child, set()).add(parent)

    # Se busca desde B hasta A; si A es alcanzable, A -> B cierra un ciclo.
    to_visit = [depends_on_task_id]
    visited: set[str] = set()
    while to_visit:
        current = to_visit.pop()
        if current == task_id:
            raise HTTPException(409, 'Esta relación generaría una dependencia circular.')
        if current in visited:
            continue
        visited.add(current)
        to_visit.extend(adjacency.get(current, ()))
