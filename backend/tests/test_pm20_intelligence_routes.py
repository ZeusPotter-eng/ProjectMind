"""Pruebas PM-20 con JWT ficticio y datos en memoria; jamás escriben en Supabase."""
from uuid import UUID
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import FastAPI,HTTPException
from fastapi.testclient import TestClient
from app.api.routes import projects,intelligence
P=str(UUID(int=100));U=str(UUID(int=101));T=str(UUID(int=102));D=str(UUID(int=103));R=str(UUID(int=104))

@pytest.fixture
def api(monkeypatch):
    state={'admin':True,'requests':{},'policy':None,'executed':0}
    async def session(): return {'token':'test-session','user_id':U}
    async def project(project_id,session,writable=False):
        assert str(project_id)==P
        return {'name':'Demo','methodology':'scrum','status':'active','id':P}
    async def admin(project_id,session):
        if not state['admin']: raise HTTPException(403,'Solo administradores')
    async def fake_db(method,*,token,table='tasks',filters=None,payload=None,count=False,select='*'):
        assert token=='test-session'
        filters=filters or {}
        if table=='tasks':
            return ([{'id':T,'project_id':P,'title':'Ejemplo','status':'todo','priority':'low','due_date':'2026-01-01','progress':0,'created_at':'2026-01-01T00:00:00Z'}] if filters.get('id',f'eq.{T}')[3:]==T else []),0
        if table=='task_dependencies' or table=='blockers' or table=='audit_logs':return [],0
        if table=='ai_project_policies':
            if method=='GET':return ([state['policy']] if state['policy'] else []),0
            state['policy']={'project_id':P,**payload};return [state['policy']],0
        assert table=='ai_action_requests'
        if method=='POST':
            row={'id':R,'status':'proposed','created_at':'2026-10-19T00:00:00Z',**payload}
            state['requests'][R]=row
            return [row],0
        rows=[x for x in state['requests'].values() if x['project_id']==P]
        if 'id' in filters:rows=[x for x in rows if x['id']==filters['id'][3:]]
        if 'status' in filters:rows=[x for x in rows if x['status']==filters['status'][3:]]
        if method=='PATCH':
            for row in rows:row.update(payload)
        return rows,0
    async def execute(project_id,request,session):
        state['executed']+=1
        return T
    monkeypatch.setattr(intelligence,'_project',project)
    monkeypatch.setattr(intelligence,'_admin',admin)
    monkeypatch.setattr(intelligence,'task_database_request',fake_db)
    monkeypatch.setattr(intelligence,'_execute',execute)
    app=FastAPI()
    app.include_router(intelligence.router,prefix='/api/v1')
    app.dependency_overrides[projects.get_authenticated_session]=session
    with TestClient(app) as client:yield client,state

def test_proposal_approval_is_scoped_and_idempotent(api):
    client,state=api
    base=f'/api/v1/projects/{P}/intelligence'
    created=client.post(f'{base}/proposals',json={'action':'task.reprioritize','arguments':{'task_id':T,'priority':'high'},'reason':'La tarea está retrasada.'})
    assert created.status_code==201,created.text
    assert created.json()['proposed_by']==U
    approved=client.post(f'{base}/proposals/{R}/approve')
    assert approved.status_code==200,approved.text
    assert approved.json()['status']=='executed' and state['executed']==1
    assert client.post(f'{base}/proposals/{R}/approve').status_code==409
    assert state['executed']==1

def test_nonadmin_cannot_approve(api):
    client,state=api;state['admin']=False
    base=f'/api/v1/projects/{P}/intelligence'
    assert client.post(f'{base}/proposals',json={'action':'task.reprioritize','arguments':{'task_id':T,'priority':'high'},'reason':'Se detecta retraso.'}).status_code==201
    assert client.post(f'{base}/proposals/{R}/approve').status_code==403
    assert state['executed']==0

def test_ai_scope_and_policy_restrictions(api):
    client,state=api; base=f'/api/v1/projects/{P}/intelligence'
    wrong=str(UUID(int=999))
    assert client.post(f'{base}/proposals',json={'action':'task.reprioritize','arguments':{'task_id':wrong,'priority':'high'},'reason':'Prueba de aislamiento.'}).status_code==422
    assert client.put(f'{base}/policy',json={'auto_enabled':True,'allowed_auto_actions':['project.methodology']}).status_code==422
    res=client.put(f'{base}/policy',json={'auto_enabled':True,'allowed_auto_actions':['task.reprioritize']})
    assert res.status_code==200
    assert res.json()['auto_enabled'] is True

def test_analysis_creates_validated_proposal(api):
    client,state=api; base=f'/api/v1/projects/{P}/intelligence'
    result=client.post(f'{base}/analyze',json={'focus':'retrasos','use_llm':False})
    assert result.status_code==200,result.text
    assert result.json()['totals']['tasks']==1
    assert len(result.json()['proposals'])==1
    assert state['executed']==0  # autonomía desactivada por defecto
