"""Reglas PM-19: precedencias e impedimentos abiertos bloquean el avance.

La validación transaccional definitiva se ejecuta además mediante un trigger
PostgreSQL, para que no se pueda omitir desde otro cliente y para evitar carreras.
"""
from uuid import UUID

from fastapi import HTTPException
from app.services.task_service import task_database_request


ACTIVE_STATES = frozenset(('in_progress', 'review', 'done'))


async def pending_gate(project_id: UUID, task_id: UUID, token: str) -> dict:
    dependencies, _ = await task_database_request(
        'GET', token=token, table='task_dependencies',
        filters={'project_id': f'eq.{project_id}', 'task_id': f'eq.{task_id}', 'limit': 1000},
        select='depends_on_task_id',
    )
    predecessors = {str(item['depends_on_task_id']) for item in dependencies}
    waiting = []
    for start in range(0, len(predecessors), 100):
        batch_ids = sorted(predecessors)[start:start + 100]
        rows, _ = await task_database_request(
            'GET', token=token,
            filters={'project_id': f'eq.{project_id}', 'id': 'in.(' + ','.join(batch_ids) + ')', 'limit': 100},
            select='id,title,status',
        )
        indexed = {str(row['id']): row for row in rows}
        waiting.extend([indexed.get(pid, {'id': pid, 'title': 'Tarea no disponible', 'status': 'missing'})
                        for pid in batch_ids if indexed.get(pid, {}).get('status') != 'done'])

    blockers, _ = await task_database_request(
        'GET', token=token, table='blockers',
        filters={'project_id': f'eq.{project_id}', 'task_id': f'eq.{task_id}', 'status': 'eq.open', 'limit': 1000},
        select='id,title,severity',
    )
    return {'pending_predecessors': waiting, 'open_blockers': blockers,
            'blocked': bool(waiting or blockers)}


def requires_gate(current: dict | None, updated: dict) -> bool:
    """No bloquear ediciones de texto ni cambios a 'blocked'/'todo'; sí el avance."""
    next_status = updated.get('status', current['status'] if current else 'todo')
    old_status = current['status'] if current else None
    old_progress = int(current.get('progress', 0)) if current else 0
    next_progress = int(updated.get('progress', old_progress))
    return (next_status in ACTIVE_STATES and next_status != old_status) or next_progress > old_progress


def enforce_gate(gate: dict) -> None:
    if gate['blocked']:
        reasons = []
        if gate['pending_predecessors']:
            reasons.append(f"{len(gate['pending_predecessors'])} tarea(s) predecesora(s) pendientes")
        if gate['open_blockers']:
            reasons.append(f"{len(gate['open_blockers'])} impedimento(s) abierto(s)")
        raise HTTPException(409, 'No puedes avanzar esta tarea: ' + ' y '.join(reasons) + '.')
