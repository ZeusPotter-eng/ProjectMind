"""Motor puro PM-20 para inicio, avance y finalización, alineado con SQL."""
from uuid import UUID
from fastapi import HTTPException
from app.services.task_service import task_database_request

ACTIVE_STATES = frozenset(('in_progress','review','done'))

def predecessor_satisfied(kind: str, status: str) -> bool:
    if kind in ('start_to_start','start_to_finish'):
        return status in ACTIVE_STATES
    return status == 'done'

def transition_events(current: dict | None, updated: dict) -> tuple[bool,bool,bool]:
    old_status = current['status'] if current else 'todo'
    old_progress = int(current.get('progress',0)) if current else 0
    status = updated.get('status',old_status)
    progress = 100 if status == 'done' else int(updated.get('progress',old_progress))
    start = (status in ACTIVE_STATES and old_status not in ACTIVE_STATES) or (old_progress == 0 and progress > 0)
    finish = (status == 'done' and old_status != 'done') or (old_progress < 100 and progress == 100)
    advancing = start or finish or progress > old_progress or (status in ACTIVE_STATES and old_status != status)
    return start,finish,advancing

def evaluate_gate(task: dict, tasks: list[dict], dependencies: list[dict], blockers: list[dict], updated: dict) -> dict:
    start,finish,advancing = transition_events(task,updated)
    catalog = {str(t['id']):t for t in tasks}
    waiting=[]; warnings=[]
    for edge in dependencies:
        if str(edge['task_id']) != str(task['id']): continue
        parent=catalog.get(str(edge['depends_on_task_id']))
        if parent and predecessor_satisfied(edge.get('dependency_type','finish_to_start'),parent['status']): continue
        is_strict = edge.get('enforcement','strict') == 'strict'
        applies = (start and edge.get('gate_on','both') in ('start','both')) or (finish and edge.get('gate_on','both') in ('finish','both'))
        data={'id':edge['depends_on_task_id'],'title':parent['title'] if parent else 'Tarea no disponible','edge_id':edge.get('id')}
        (waiting if is_strict and applies else warnings).append(data)
    open_blockers=[b for b in blockers if str(b.get('task_id')) == str(task['id']) and b['status']=='open']
    blocking=[b for b in open_blockers if b.get('is_blocking',True)]
    return {'pending_predecessors':waiting,'warnings':warnings,'open_blockers':blocking,
            'informational_blockers':[b for b in open_blockers if not b.get('is_blocking',True)],
            'blocked':bool(advancing and (waiting or blocking)),'start':start,'finish':finish,'advancing':advancing}

async def pending_gate(project_id: UUID, task_id: UUID, token: str, current: dict, updated: dict) -> dict:
    edges,_ = await task_database_request('GET', token=token, table='task_dependencies', filters={'project_id':f'eq.{project_id}','task_id':f'eq.{task_id}','limit':1000})
    parents={str(e['depends_on_task_id']) for e in edges}
    tasks=[current]
    for k in range(0,len(parents),100):
        ids=sorted(parents)[k:k+100]
        rows,_=await task_database_request('GET',token=token,filters={'project_id':f'eq.{project_id}','id':'in.('+','.join(ids)+')','limit':100}, select='id,title,status')
        tasks+=rows
    blockers,_=await task_database_request('GET',token=token,table='blockers', filters={'project_id':f'eq.{project_id}','task_id':f'eq.{task_id}','status':'eq.open','limit':1000})
    return evaluate_gate(current,tasks,edges,blockers,updated)

def requires_gate(current: dict | None, updated: dict) -> bool:
    return transition_events(current,updated)[2]

def enforce_gate(gate: dict) -> None:
    if gate['blocked']:
        reasons=[]
        if gate['pending_predecessors']: reasons.append(f"{len(gate['pending_predecessors'])} dependencia(s) obligatoria(s)")
        if gate['open_blockers']: reasons.append(f"{len(gate['open_blockers'])} impedimento(s) bloqueante(s)")
        raise HTTPException(409, 'No puedes avanzar: '+' y '.join(reasons)+'.')
