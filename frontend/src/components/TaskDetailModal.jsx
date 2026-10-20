import { useEffect, useMemo, useState } from 'react'
import { asUTC, readable } from '../utils/timelineDates'
import { taskDurationLabel } from '../utils/taskTimeline'
import { listTaskEvidence, requestEvidenceLink, uploadTaskEvidence, listProjectMembers, listDependencies } from '../api/client'
import './taskDetailModal.css'

const STATES={backlog:'Backlog',todo:'Por hacer',in_progress:'En progreso',blocked:'Bloqueada',review:'En revisión',done:'Finalizada',cancelled:'Cancelada'}
const PRIORITIES={low:'Baja',medium:'Media',high:'Alta',critical:'Crítica'}
const fileSize=(size)=>`${(size / 1024 / 1024).toFixed(2)} MB`
export default function TaskDetailModal({task,project,getAccessToken,onClose}){
 const [evidence,setEvidence]=useState([]),[members,setMembers]=useState([]),[dependencies,setDependencies]=useState([])
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[uploading,setUploading]=useState(false),[links,setLinks]=useState({})
 const isArchived=project?.status==='archived'
 const assignees=useMemo(()=>task.assignees||[],[task.assignees])
 useEffect(()=>{let active=true;const id=task.id;async function load(){try{const [files,people,edges]=await Promise.all([listTaskEvidence(getAccessToken,project.id,id),listProjectMembers(getAccessToken,project.id),listDependencies(getAccessToken,project.id,{limit:500})]);if(active){setEvidence(files.items||[]);setMembers(people.items||[]);setDependencies(edges.items||[])}}catch(e){if(active)setError(e.message)}}load();const key=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',key);return()=>{active=false;window.removeEventListener('keydown',key)}},[task.id,project.id,getAccessToken,onClose])
 const displayPerson=(id)=>{const found=members.find(m=>m.user_id===id);return found?.profile?.full_name||found?.profile?.display_name||found?.profile?.email||found?.user_id||id}
 const predecessors=dependencies.filter(d=>d.task_id===task.id)
 const successors=dependencies.filter(d=>d.depends_on_task_id===task.id)
 async function upload(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;setError('');setNotice('');setUploading(true);try{await uploadTaskEvidence(getAccessToken,project.id,task.id,file);const result=await listTaskEvidence(getAccessToken,project.id,task.id);setEvidence(result.items||[]);setNotice('Evidencia guardada en almacenamiento privado.')}catch(e){setError(e.message)}finally{setUploading(false)}}
 async function getLink(file){setError('');try{const result=await requestEvidenceLink(getAccessToken,project.id,task.id,file.id);setLinks(current=>({...current,[file.id]:result.url}));setNotice('Enlace temporal listo. Caduca en 2 minutos.')}catch(e){setError(e.message)}}
 return <div className="pm-task-modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}} role="presentation"><section role="dialog" aria-modal="true" aria-label={`Detalle de la tarea ${task.title}`} className="pm-task-modal">
 <header><div><span className="eyebrow">PROJECTMIND · FICHA DE TAREA</span><h2>{task.title}</h2><small>{project.name}</small></div><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></header>
 <div className="pm-task-modal-body">
 <div className="pm-task-data-grid">
  <div><small>Estado</small><strong>{STATES[task.status]||task.status}</strong></div><div><small>Prioridad</small><strong>{PRIORITIES[task.priority]||task.priority}</strong></div>
  <div><small>Avance</small><strong>{task.progress??0}%</strong></div><div><small>Duración</small><strong>{taskDurationLabel(task)}</strong></div>
  <div><small>Inicio previsto</small><strong>{readable(asUTC(task.start_date))}</strong></div><div><small>Entrega prevista</small><strong>{readable(asUTC(task.due_date))}</strong></div>
 </div>
 <h3>Descripción</h3><p className="pm-task-modal-description">{task.description||'Esta tarea todavía no tiene descripción.'}</p>
 <div className="pm-task-modal-two"><div><h3>Responsables</h3>{assignees.length? <ul>{assignees.map(id=><li key={id}>{displayPerson(id)}</li>)}</ul>:<p>Sin asignar</p>}</div><div><h3>Relaciones</h3><p>{predecessors.length} predecesora(s) · {successors.length} sucesora(s)</p><small>Las restricciones se administran en Dependencias.</small></div></div>
 <h3>Evidencias adjuntas <span className="pm-task-evidence-count">{evidence.length}</span></h3>
 <p className="pm-task-evidence-help">PDF, imágenes, TXT, CSV, DOCX o XLSX. Máximo 10 MB por archivo. Acceso privado para integrantes autorizados.</p>
 {!isArchived&&<label className="pm-task-evidence-upload"><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx" onChange={upload} disabled={uploading}/>{uploading?'Subiendo evidencia…':'Seleccionar evidencia para subir'}</label>}
 {error&&<p className="pm-task-evidence-error" role="alert">{error}</p>}{notice&&<p className="pm-task-evidence-success" role="status">{notice}</p>}
 {evidence.length?<ul className="pm-task-evidence-list">{evidence.map(file=><li key={file.id}><div><strong>{file.file_name}</strong><small>{fileSize(file.size_bytes)} · {new Date(file.created_at).toLocaleString('es-MX')}</small></div>{links[file.id]?<a href={links[file.id]} target="_blank" rel="noreferrer">Abrir archivo ↗</a>:<button type="button" onClick={()=>getLink(file)}>Generar enlace</button>}</li>)}</ul>:<p className="pm-task-evidence-help">Todavía no hay evidencias para esta tarea.</p>}
 <details className="pm-task-metadata"><summary>Información técnica y trazabilidad</summary><p>ID de tarea: <code>{task.id}</code></p><p>Creada: {task.created_at ? new Date(task.created_at).toLocaleString('es-MX'):'—'}</p><p>Última actualización: {task.updated_at ? new Date(task.updated_at).toLocaleString('es-MX'):'—'}</p><p>Origen: {task.source||'manual'}</p><p>Creada por: {task.created_by||'—'}</p><p>Finalizada: {task.completed_at ? new Date(task.completed_at).toLocaleString('es-MX'):'—'}</p></details>
 </div></section></div>
}
