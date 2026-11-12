"""Contexto de lectura del chat. Todas las consultas usan JWT humano + RLS.

No usa service_role, credenciales de administración, SQL del modelo ni escrituras.
Se obtienen TODOS los registros hasta el límite operativo para calcular métricas
exactas; solo se envía al proveedor un subconjunto limitado de detalles.
"""
from __future__ import annotations

from collections import Counter
from datetime import date
from uuid import UUID

from fastapi import HTTPException

from app.api.routes.projects import get_project
from app.services.member_service import member_database_request, serialize_member
from app.services.task_service import task_database_request

MAX_ROWS = 3000
PAGE_SIZE = 200


async def _all_rows(project_id: UUID, token: str, table: str) -> list[dict]:
    rows: list[dict] = []
    while True:
        page, _ = await task_database_request(
            'GET', token=token, table=table,
            filters={'project_id': f'eq.{project_id}', 'limit': PAGE_SIZE,
                     'offset': len(rows), 'order': 'created_at.desc'},
        )
        rows.extend(page)
        if len(rows) > MAX_ROWS or (len(rows) >= MAX_ROWS and len(page) == PAGE_SIZE):
            raise HTTPException(413, f'El proyecto supera el límite de {MAX_ROWS} registros en {table}; no se generará un informe incompleto.')
        if len(page) < PAGE_SIZE:
            return rows


async def _task_assignments(task_ids: list[str], token: str) -> dict[str, list[str]]:
    assignments: dict[str, list[str]] = {task_id: [] for task_id in task_ids}
    for index in range(0, len(task_ids), 50):
        batch = task_ids[index:index + 50]
        rows, _ = await task_database_request(
            'GET', token=token, table='task_assignees',
            filters={'task_id': 'in.(' + ','.join(batch) + ')', 'limit': 2000},
            select='task_id,user_id',
        )
        for row in rows:
            if row.get('task_id') in assignments:
                assignments[row['task_id']].append(row['user_id'])
    return assignments


def _prioritize_tasks(tasks: list[dict], message: str) -> list[dict]:
    """Da prioridad a títulos mencionados en la pregunta y al trabajo relevante."""
    query = message.casefold()
    def rank(task: dict) -> tuple[int, int]:
        title = str(task.get('title') or '').casefold()
        words = [word for word in title.split() if len(word) > 3]
        mention = bool(title and title in query) or bool(words and sum(w in query for w in words) >= min(2, len(words)))
        active = task.get('status') in ('blocked', 'in_progress', 'review', 'todo')
        return (0 if mention else 1, 0 if active else 1)
    return sorted(tasks, key=rank)


async def build_assistant_context(project_id: UUID, session: dict, message: str) -> tuple[dict, dict]:
    """Verifica visibilidad del proyecto y construye contexto verificable de solo lectura."""
    project = await get_project(project_id, session)  # 404 cuando JWT/RLS no permite ver el proyecto.
    token = session['token']
    tasks = await _all_rows(project_id, token, 'tasks')
    blockers = await _all_rows(project_id, token, 'blockers')
    dependencies = await _all_rows(project_id, token, 'task_dependencies')
    members = [serialize_member(row) for row in await member_database_request(
        'GET', access_token=token, project_id=str(project_id))]
    assignments = await _task_assignments([str(task['id']) for task in tasks], token)
    member_names = {str(member['user_id']): member.get('full_name') or str(member['user_id'])
                    for member in members if member.get('status') == 'active'}
    states = Counter(str(task.get('status', 'unknown')) for task in tasks)
    done = states.get('done', 0)
    pending = states.get('backlog', 0) + states.get('todo', 0)
    active_blockers = sum(blocker.get('status') == 'open' for blocker in blockers)
    overdue = sum(bool(task.get('due_date') and str(task['due_date'])[:10] < date.today().isoformat())
                  and task.get('status') not in ('done', 'cancelled') for task in tasks)
    counts = {
        'tasks': len(tasks), 'completed': done, 'pending': pending,
        'not_completed': len(tasks) - done - states.get('cancelled', 0),
        'in_progress': states.get('in_progress', 0), 'blocked_tasks': states.get('blocked', 0),
        'in_review': states.get('review', 0), 'cancelled': states.get('cancelled', 0),
        'open_blockers': active_blockers, 'blockers': len(blockers),
        'dependencies': len(dependencies), 'active_members': sum(m.get('status') == 'active' for m in members),
        'overdue_tasks': overdue,
    }
    # Datos limitados para proteger contra contextos gigantes; métricas calculadas sobre TODOS los registros.
    selected_tasks = _prioritize_tasks(tasks, message)[:120]
    context = {
        'source': 'Supabase/PostgREST autorizado bajo JWT y políticas RLS de ProjectMind',
        'snapshot_date': date.today().isoformat(),
        'project': {key: project.get(key) for key in ('id', 'name', 'objective', 'description',
                    'status', 'methodology', 'start_date', 'due_date')},
        'metrics_exact': counts,
        'task_status_counts': dict(states),
        'tasks': [{
            'id': task.get('id'), 'title': task.get('title'),
            'description': str(task.get('description') or '')[:280],
            'status': task.get('status'), 'priority': task.get('priority'),
            'progress': task.get('progress'), 'start_date': task.get('start_date'),
            'due_date': task.get('due_date'), 'completed_at': task.get('completed_at'),
            'responsibles': [member_names.get(uid, uid) for uid in assignments.get(str(task['id']), [])],
        } for task in selected_tasks],
        'blockers': [{key: b.get(key) for key in ('id', 'task_id', 'title', 'status', 'severity', 'is_blocking')}
                     for b in blockers[:100]],
        'dependencies': [{key: d.get(key) for key in ('id', 'task_id', 'depends_on_task_id',
                         'enforcement', 'gate_on')} for d in dependencies[:120]],
        'members': [{key: m.get(key) for key in ('user_id', 'full_name', 'role', 'status')}
                    for m in members[:50]],
        'detail_limits': {'tasks_in_context': len(selected_tasks), 'tasks_total': len(tasks),
                          'blockers_in_context': min(100, len(blockers)),
                          'dependencies_in_context': min(120, len(dependencies))},
    }
    return context, counts
