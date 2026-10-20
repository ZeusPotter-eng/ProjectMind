// PM-20: reglas de presentación consistentes con el trigger SQL.
import { dependencySatisfied } from './dependencies.js'
export const ACTIVE_STATES = new Set(['in_progress','review','done'])
export function taskBlockReasons(task,tasks,dependencies,blockers,{nextStatus='in_progress',nextProgress=task.progress}={}) {
 const catalog=new Map(tasks.map(t=>[t.id,t]))
 const start=(ACTIVE_STATES.has(nextStatus)&&!ACTIVE_STATES.has(task.status)) || (Number(task.progress)===0 && Number(nextProgress)>0)
 const finish=(nextStatus==='done' && task.status!=='done') || (Number(task.progress)<100&&Number(nextProgress)===100)
 const pending=[],warnings=[]
 for (const edge of dependencies.filter(e=>e.task_id===task.id)) {
  if(dependencySatisfied(edge,catalog.get(edge.depends_on_task_id))) continue
  const item=catalog.get(edge.depends_on_task_id)||{id:edge.depends_on_task_id,title:'Tarea no disponible',status:'unknown'}
  if((edge.enforcement||'strict')==='strict' && ((start&&['start','both'].includes(edge.gate_on||'both'))||(finish&&['finish','both'].includes(edge.gate_on||'both')))) pending.push(item)
  else warnings.push(item)
 }
 const open=blockers.filter(b=>b.task_id===task.id&&b.status==='open'&&b.is_blocking!==false)
 const advisory=blockers.filter(b=>b.task_id===task.id&&b.status==='open'&&b.is_blocking===false)
 return {pending,open,warnings,advisory,blocked:pending.length>0||open.length>0}
}
export function preventsTaskUpdate(task,nextStatus,nextProgress,reasons) {
 const activeTransition=(ACTIVE_STATES.has(nextStatus)&&task.status!==nextStatus)
 const advance=Number(nextProgress)>Number(task.progress)
 return reasons.blocked&&(activeTransition||advance)
}
export function reasonText(reasons) {
 const parts=[]
 if(reasons.pending.length)parts.push(`${reasons.pending.length} dependencia(s) obligatoria(s)`)
 if(reasons.open.length)parts.push(`${reasons.open.length} impedimento(s) bloqueante(s)`)
 return parts.join(' · ')
}
