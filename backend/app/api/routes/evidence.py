"""PM-21: evidencias privadas vinculadas a tareas (JWT + RLS, sin llave service_role)."""
from hashlib import sha256
from pathlib import Path
from uuid import UUID, uuid4
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from app.api.routes.projects import get_authenticated_session
from app.api.routes.tasks import _project, _task
from app.core.config import get_settings
from app.services.task_service import task_database_request

router = APIRouter(prefix='/projects/{project_id}/tasks/{task_id}/evidence', tags=['Task evidence'])
BUCKET='task-evidence'
MAX_SIZE=10*1024*1024
MIMES={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
       '.webp':'image/webp','.txt':'text/plain','.csv':'text/csv',
       '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}

async def _context(project_id,task_id,session, writable=False):
    await _project(project_id,session,writable=writable)
    await _task(project_id,task_id,session)

def _storage_headers(token, mime='application/json'):
    settings=get_settings()
    if not settings.supabase_url or not settings.supabase_client_key:
        raise HTTPException(503,'El almacenamiento no está configurado.')
    return {'apikey':settings.supabase_client_key,'Authorization':f'Bearer {token}',
            'Content-Type':mime}

def _valid_upload(name, content):
    if not name or len(name)>180 or len(content)>MAX_SIZE or not content:
        raise HTTPException(422,'Archivo vacío, nombre demasiado largo o tamaño superior a 10 MB.')
    ext=Path(name).suffix.lower()
    if ext not in MIMES: raise HTTPException(422,'Formato no permitido: PDF, imagen, TXT, CSV, DOCX o XLSX.')
    if ext=='.pdf' and not content.startswith(b'%PDF-'):raise HTTPException(422,'El archivo no es un PDF válido.')
    if ext=='.png' and not content.startswith(b'\x89PNG\r\n\x1a\n'):raise HTTPException(422,'Imagen PNG inválida.')
    if ext in ('.jpg','.jpeg') and not content.startswith(b'\xff\xd8\xff'):raise HTTPException(422,'Imagen JPG inválida.')
    if ext=='.webp' and not (content[:4]==b'RIFF' and content[8:12]==b'WEBP'):raise HTTPException(422,'Imagen WEBP inválida.')
    if ext in ('.docx','.xlsx') and not content.startswith(b'PK\x03\x04'):raise HTTPException(422,'Documento Office inválido.')
    return ext,MIMES[ext]

@router.get('')
async def list_evidence(project_id:UUID,task_id:UUID,session:dict=Depends(get_authenticated_session)):
    await _context(project_id,task_id,session)
    rows,_=await task_database_request('GET',token=session['token'],table='task_evidence',
        filters={'project_id':f'eq.{project_id}','task_id':f'eq.{task_id}',
                 'order':'created_at.desc','limit':100},
        select='id,file_name,mime_type,size_bytes,sha256,uploaded_by,created_at')
    return {'items':rows,'count':len(rows)}

@router.post('',status_code=201)
async def upload_evidence(project_id:UUID,task_id:UUID,file:UploadFile=File(...),
                          session:dict=Depends(get_authenticated_session)):
    await _context(project_id,task_id,session,writable=True)
    content=await file.read(MAX_SIZE+1)
    ext,mime=_valid_upload(file.filename or '',content)
    evidence_id=uuid4()
    path=f'{project_id}/{task_id}/{evidence_id}{ext}'
    settings=get_settings()
    endpoint=f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{BUCKET}/{path}"
    try:
        async with httpx.AsyncClient(timeout=35) as client:
            response=await client.post(endpoint,headers={**_storage_headers(session['token'],mime),'x-upsert':'false'},content=content)
    except httpx.RequestError:
        raise HTTPException(502,'No fue posible conectar con Storage.') from None
    if response.status_code>=400:
        raise HTTPException(403 if response.status_code in (401,403) else 502,
                            'Storage rechazó la carga. Revisa los permisos del proyecto y del bucket.')
    values={'id':str(evidence_id),'project_id':str(project_id),'task_id':str(task_id),
            'file_name':Path(file.filename).name[:180], 'object_path':path,'mime_type':mime,
            'size_bytes':len(content),'sha256':sha256(content).hexdigest(),'uploaded_by':session['user_id']}
    rows,_=await task_database_request('POST',token=session['token'],table='task_evidence',payload=values)
    if not rows:
        raise HTTPException(502,'El archivo llegó a Storage, pero no pudo registrarse su evidencia. Contacta al administrador.')
    result=rows[0].copy();result.pop('object_path',None)
    return result

@router.post('/{evidence_id}/access')
async def access_evidence(project_id:UUID,task_id:UUID,evidence_id:UUID,
                          session:dict=Depends(get_authenticated_session)):
    await _context(project_id,task_id,session)
    rows,_=await task_database_request('GET',token=session['token'],table='task_evidence',filters={
        'id':f'eq.{evidence_id}','project_id':f'eq.{project_id}','task_id':f'eq.{task_id}','limit':1})
    if not rows:raise HTTPException(404,'La evidencia no existe o no tienes acceso.')
    path=rows[0]['object_path']
    endpoint=f"{get_settings().supabase_url.rstrip('/')}/storage/v1/object/sign/{BUCKET}/{path}"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response=await client.post(endpoint,headers=_storage_headers(session['token']),json={'expiresIn':120})
    except httpx.RequestError:
        raise HTTPException(502,'Storage no respondió.') from None
    if response.status_code>=400:raise HTTPException(403,'No tienes acceso a este archivo.')
    url=response.json().get('signedURL','')
    if not url.startswith('/object/sign/') and not url.startswith('/storage/v1/object/sign/'):
        raise HTTPException(502,'Storage devolvió una ruta de descarga inválida.')
    if url.startswith('/object/sign/'):
        url='/storage/v1'+url
    return {'url':get_settings().supabase_url.rstrip('/')+url, 'expires_in':120}
