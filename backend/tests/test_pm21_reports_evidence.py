from datetime import datetime, timezone
from uuid import uuid4
import pytest
from fastapi import HTTPException
from app.schemas.ai_response import AgentReport, validate_references
from app.api.routes.evidence import _valid_upload, MAX_SIZE
from app.api.routes import ai_reports

PROJECT=str(uuid4())
TASK_A=str(uuid4())
TASK_B=str(uuid4())
EDGE=str(uuid4())
BLOCKER=str(uuid4())

def test_reject_reference_not_in_project():
    report=AgentReport(project_id=PROJECT,produced_at=datetime.now(timezone.utc),summary='Análisis de proyecto de prueba.',findings=[{
        'code':'pending_dependency','severity':'warning','title':'Restricción pendiente',
        'explanation':'Existe una tarea que todavía no termina.',
        'recommendation':'Revisar los responsables para desbloquearla.',
        'evidence':[{'kind':'task','id':TASK_A}]
    }])
    with pytest.raises(ValueError):validate_references(report,{'task':set()})
    assert validate_references(report,{'task':{TASK_A}})==report

def test_file_validation_rejects_forged_pdf_and_excess():
    with pytest.raises(HTTPException):_valid_upload('reporte.pdf',b'no es pdf')
    with pytest.raises(HTTPException):_valid_upload('reporte.pdf',b'%PDF-'+b'0'*MAX_SIZE)
    assert _valid_upload('imagen.png',b'\x89PNG\r\n\x1a\ncontenido')[0]=='.png'
    with pytest.raises(HTTPException):_valid_upload('payload.exe',b'malware')

@pytest.mark.asyncio
async def test_ai_report_uses_existing_project_references(monkeypatch):
    rows={'tasks':[
        {'id':TASK_A,'title':'A','status':'todo','due_date':None},
        {'id':TASK_B,'title':'B','status':'todo','due_date':None}],
        'task_dependencies':[{'id':EDGE,'project_id':PROJECT,'task_id':TASK_B,
                              'depends_on_task_id':TASK_A,'enforcement':'strict'}],
        'blockers':[{'id':BLOCKER,'status':'open','title':'Falta información','is_blocking':True}]}
    async def fake(method,*,token,table='tasks',filters=None,**kwargs):
        return rows[table],len(rows[table])
    monkeypatch.setattr(ai_reports,'task_database_request',fake)
    report=await ai_reports.generate_report(PROJECT,'token',{'name':'proyecto1'})
    assert report.execution_mode=='read_only'
    assert len(report.findings)==2
    assert report.findings[0].evidence[0].id.__str__()==EDGE
    assert all(str(ref.id) in {PROJECT,TASK_A,TASK_B,EDGE,BLOCKER} for finding in report.findings for ref in finding.evidence)

@pytest.mark.asyncio
async def test_upload_and_signed_access_use_user_token(monkeypatch):
    from io import BytesIO
    from fastapi import UploadFile
    from app.api.routes import evidence
    evidence_id=str(uuid4())
    calls=[]
    async def context(*args,**kwargs): pass
    async def db(method,*,token,table='tasks',payload=None,filters=None,**kwargs):
        calls.append((method,token,table))
        if method=='POST':
            assert payload['uploaded_by']==TASK_A
            assert payload['object_path'].startswith(f'{PROJECT}/{TASK_B}/')
            return [payload],1
        return [{'id':evidence_id,'object_path':f'{PROJECT}/{TASK_B}/{evidence_id}.pdf'}],1
    class Response:
        status_code=200
        def json(self):return {'signedURL':f'/object/sign/task-evidence/{PROJECT}/{TASK_B}/{evidence_id}.pdf?token=fake'}
    class Client:
        def __init__(self,**kwargs):pass
        async def __aenter__(self):return self
        async def __aexit__(self,*args):pass
        async def post(self,url,**kwargs):
            assert 'task-evidence/' in url
            assert kwargs['headers']['Authorization']=='Bearer user-jwt'
            return Response()
    class Settings:
        supabase_url='https://example.supabase.co'
        supabase_client_key='public'
    monkeypatch.setattr(evidence,'_context',context)
    monkeypatch.setattr(evidence,'task_database_request',db)
    monkeypatch.setattr(evidence.httpx,'AsyncClient',Client)
    monkeypatch.setattr(evidence,'get_settings',lambda:Settings())
    upload=UploadFile(filename='plan.pdf',file=BytesIO(b'%PDF-1.7 test'))
    result=await evidence.upload_evidence(PROJECT,TASK_B,upload,{'token':'user-jwt','user_id':TASK_A})
    assert result['file_name']=='plan.pdf' and 'object_path' not in result
    signed=await evidence.access_evidence(PROJECT,TASK_B,evidence_id,{'token':'user-jwt'})
    assert signed['url'].startswith('https://example.supabase.co/storage/v1/object/sign/')
    assert ('POST','user-jwt','task_evidence') in calls
