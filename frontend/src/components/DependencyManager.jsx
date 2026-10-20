import { useMemo, useState } from 'react'
import { dependencySummary, wouldCreateCycle, dependencySatisfied } from '../utils/dependencies'
import './dependencies.css'

const METHODS = { scrum: 'Scrum', traditional: 'Tradicional', hybrid: 'Híbrida' }
const TYPES = { finish_to_start: 'Fin → inicio', start_to_start: 'Inicio → inicio', finish_to_finish: 'Fin → fin', start_to_finish: 'Inicio → fin' }
const GATES = { start: 'Restringir inicio', finish: 'Restringir finalización', both: 'Inicio y finalización' }
function initialRule(methodology) { return methodology === 'traditional' ? 'strict' : 'informational' }
function gateForType(type) { return type.includes('_to_finish') && type !== 'finish_to_start' ? 'finish' : 'start' }

export default function DependencyManager({task, allTasks, dependencies, busy, readonly, isAdmin=false, methodology='hybrid', onClose,onAdd,onUpdate,onDelete}) {
 const [predecessor,setPredecessor]=useState('')
 const [type,setType]=useState('finish_to_start')
 const [enforcement,setEnforcement]=useState(isAdmin ? initialRule(methodology) : 'informational')
 const [gate,setGate]=useState('start')
 const [edit,setEdit]=useState(null)
 const [error,setError]=useState('')
 const map=useMemo(()=>new Map(allTasks.map(x=>[x.id,x])),[allTasks])
 const {prerequisites,successors}=dependencySummary(task.id,dependencies,map)
 const unused=allTasks.filter(t=>t.id!==task.id && !prerequisites.some(e=>e.depends_on_task_id===t.id))
 async function add(e) {e.preventDefault();setError('');if(!predecessor) return setError('Selecciona la predecesora.');
   if(wouldCreateCycle(dependencies,task.id,predecessor)) return setError('La relación generaría un ciclo.');
   try {await onAdd({task_id:task.id,depends_on_task_id:predecessor,dependency_type:type,enforcement,gate_on:gate});setPredecessor('')}
   catch(err){setError(err.message)} }
 async function save(){setError('');try{await onUpdate(edit.id,{depends_on_task_id:edit.depends_on_task_id,dependency_type:edit.dependency_type,enforcement:edit.enforcement,gate_on:edit.gate_on});setEdit(null)}catch(err){setError(err.message)}}
 async function remove(id){if(!window.confirm('¿Eliminar esta dependencia?'))return;try{await onDelete(id)}catch(err){setError(err.message)}}
 const controls=(item,setItem,canEdit)=><div className="pm20-rule-grid">
  <label>Tipo de precedencia<select disabled={!canEdit||busy} value={item.dependency_type} onChange={e=>{setItem({...item,dependency_type:e.target.value,gate_on:gateForType(e.target.value)})}}>{Object.entries(TYPES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
  <label>Restricción<select disabled={!canEdit||busy} value={item.enforcement} onChange={e=>setItem({...item,enforcement:e.target.value})}><option value="informational">Informativa (advertencia)</option><option value="strict" disabled={!isAdmin}>Obligatoria (bloqueante)</option></select></label>
  <label>Momento de control<select disabled={!canEdit||busy} value={item.gate_on} onChange={e=>setItem({...item,gate_on:e.target.value})}>{Object.entries(GATES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
 </div>
 return <div className="pm-task-modal" role="dialog" aria-modal="true" aria-label={`Dependencias de ${task.title}`}><div className="pm-task-dialog pm-dep-dialog">
 <div className="pm-task-dialog-header"><div><span className="eyebrow">PROJECTMIND · GESTIÓN INTELIGENTE</span><h2>Dependencias</h2><p>{task.title} · {METHODS[methodology]}</p></div><button onClick={onClose} aria-label="Cerrar">×</button></div>
 <p className="pm-dep-muted">Las dependencias informativas advierten. Las obligatorias restringen la operación indicada. Solo administradores pueden crear o modificar relaciones estrictas.</p>
 <h3 className="pm-dep-label">Predecesoras ({prerequisites.length})</h3>
 {!prerequisites.length && <p className="pm-dep-muted">Sin predecesoras.</p>}
 <div className="pm-dep-list">{prerequisites.map(edge=>{const parent=map.get(edge.depends_on_task_id);const satisfied=dependencySatisfied(edge,parent);
 return <div key={edge.id} className="pm-dep-item pm20-dep-item"><div><strong>{parent?.title||'Tarea no disponible'}</strong><small>{TYPES[edge.dependency_type]} · {edge.enforcement==='strict'?'Obligatoria':'Informativa'} · {GATES[edge.gate_on]}</small><small className={satisfied?'pm-dep-done':'pm-dep-waiting'}>{satisfied?'✓ Condición cumplida':'◷ Condición pendiente'}</small></div>
 {edit?.id===edge.id ? <div>{controls(edit,setEdit,true)}<button className="pm-task-primary" type="button" disabled={busy||wouldCreateCycle(dependencies,task.id,edit.depends_on_task_id,edit.id)} onClick={save}>Guardar</button><button className="pm-task-secondary" type="button" onClick={()=>setEdit(null)}>Cancelar</button></div> : !readonly && isAdmin && <div className="pm-dep-actions"><button className="pm-task-secondary" onClick={()=>setEdit({...edge})}>Editar</button><button className="pm-task-delete" onClick={()=>remove(edge.id)}>Quitar</button></div>}</div>})}</div>
 {!readonly && <form className="pm-dep-add pm20-dep-add" onSubmit={add}><label>Agregar predecesora<select value={predecessor} onChange={e=>setPredecessor(e.target.value)}><option value="">Selecciona una tarea…</option>{unused.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
 <div className="pm20-rule-grid"><label>Relación<select value={type} onChange={e=>{setType(e.target.value);setGate(gateForType(e.target.value))}}>{Object.entries(TYPES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
 <label>Política<select value={enforcement} onChange={e=>setEnforcement(e.target.value)}><option value="informational">Informativa</option><option value="strict" disabled={!isAdmin}>Obligatoria</option></select></label>
 <label>Restricción<select value={gate} onChange={e=>setGate(e.target.value)}>{Object.entries(GATES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></div><button className="pm-task-primary" type="submit" disabled={busy||!predecessor}>+ Agregar relación</button></form>}
 <h3 className="pm-dep-label">Sucesoras ({successors.length})</h3><div className="pm-dep-list">{successors.map(e=><div key={e.id} className="pm-dep-item">{map.get(e.task_id)?.title||'Tarea no disponible'} · {e.enforcement==='strict'?'Obligatoria':'Informativa'}</div>)}</div>
 {error && <p role="alert" className="pm-task-error">{error}</p>}<div className="pm-task-actions"><button className="pm-task-secondary" onClick={onClose}>Cerrar</button></div>
 </div></div>
}
