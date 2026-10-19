import { useMemo, useState } from 'react'
import { dependencySummary, wouldCreateCycle } from '../utils/dependencies'
import './dependencies.css'

function getName(map, id) { return map.get(id)?.title || `Tarea ${id.slice(0, 8)} (no disponible)` }

export default function DependencyManager({ task, allTasks, dependencies, busy, readonly, onClose, onAdd, onUpdate, onDelete }) {
  const [predecessor, setPredecessor] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editingPredecessor, setEditingPredecessor] = useState('')
  const [error, setError] = useState('')
  const map = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks])
  const { prerequisites, successors, pending } = dependencySummary(task.id, dependencies, map)
  const candidates = allTasks.filter(t => t.id !== task.id)
  const unused = candidates.filter(t => !prerequisites.some(edge => edge.depends_on_task_id === t.id))

  async function add(e) {
    e.preventDefault(); setError('')
    if (!predecessor) return setError('Selecciona una tarea predecesora.')
    if (wouldCreateCycle(dependencies, task.id, predecessor)) return setError('La relación generaría una dependencia circular.')
    try { await onAdd({ task_id: task.id, depends_on_task_id: predecessor, dependency_type: 'finish_to_start' }); setPredecessor('') }
    catch (err) { setError(err.message) }
  }

  async function saveEdit(id) {
    setError('')
    if (!editingPredecessor) return setError('Selecciona una tarea predecesora.')
    if (wouldCreateCycle(dependencies, task.id, editingPredecessor, id)) return setError('La relación generaría una dependencia circular.')
    try { await onUpdate(id, { depends_on_task_id: editingPredecessor }); setEditingId(''); setEditingPredecessor('') }
    catch (err) { setError(err.message) }
  }

  async function remove(id) {
    setError('')
    if (!window.confirm('¿Eliminar la relación de precedencia? La tarea seguirá existiendo.')) return
    try { await onDelete(id) } catch (err) { setError(err.message) }
  }

  return <div className="pm-task-modal" role="dialog" aria-modal="true" aria-label={`Dependencias de ${task.title}`}>
    <div className="pm-task-dialog pm-dep-dialog">
      <div className="pm-task-dialog-header"><div><span className="eyebrow">PROJECTMIND · PM-18</span><h2>Dependencias</h2><p className="pm-dep-subtitle">{task.title}</p></div><button type="button" onClick={onClose} aria-label="Cerrar dependencias">×</button></div>
      <div className="pm-dep-state" data-ready={pending.length === 0}>
        <strong>{!prerequisites.length ? 'Sin predecesoras' : pending.length ? `${pending.length} requisito(s) pendiente(s)` : 'Todas las predecesoras terminadas'}</strong>
        <small>Las dependencias informan qué falta para comenzar. El bloqueo automático corresponde a PM-19.</small>
      </div>
      <h3 className="pm-dep-label">Depende de ({prerequisites.length})</h3>
      {!prerequisites.length && <p className="pm-dep-muted">Esta tarea todavía no depende de otras.</p>}
      <div className="pm-dep-list">{prerequisites.map(edge => {
        const predecessorTask = map.get(edge.depends_on_task_id)
        const complete = predecessorTask?.status === 'done'
        return <div key={edge.id} className="pm-dep-item">
          {editingId === edge.id ? <div className="pm-dep-edit"><label>Elegir predecesora<select aria-label="Nueva predecesora" value={editingPredecessor} disabled={busy || readonly} onChange={e => setEditingPredecessor(e.target.value)}>
            {candidates.filter(t => !prerequisites.some(d => d.id !== edge.id && d.depends_on_task_id === t.id)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select></label><div><button className="pm-task-primary" type="button" disabled={busy} onClick={() => saveEdit(edge.id)}>Guardar</button><button className="pm-task-secondary" type="button" onClick={() => setEditingId('')}>Cancelar</button></div></div>
          : <><div><strong>{getName(map, edge.depends_on_task_id)}</strong><small className={complete ? 'pm-dep-done' : 'pm-dep-waiting'}>{complete ? '✓ Finalizada' : '◷ Pendiente de terminar'}</small></div>{!readonly && <div className="pm-dep-actions"><button className="pm-task-secondary" disabled={busy} onClick={() => { setEditingId(edge.id); setEditingPredecessor(edge.depends_on_task_id); setError('') }}>Editar</button><button className="pm-task-delete" disabled={busy} onClick={() => remove(edge.id)}>Quitar</button></div>}</>}
        </div>
      })}</div>
      {!readonly && <form className="pm-dep-add" onSubmit={add}><label>Agregar predecesora<select value={predecessor} onChange={e => setPredecessor(e.target.value)} disabled={busy || !unused.length}><option value="">Selecciona una tarea…</option>{unused.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><button className="pm-task-primary" type="submit" disabled={busy || !unused.length || !predecessor}>{busy ? 'Guardando…' : '+ Agregar'}</button></form>}
      {readonly && <p className="pm-dep-muted">Proyecto archivado: las dependencias son de solo lectura.</p>}
      <h3 className="pm-dep-label">Tareas que esperan a esta ({successors.length})</h3>
      {successors.length ? <div className="pm-dep-list">{successors.map(edge => <div key={edge.id} className="pm-dep-item"><span>{getName(map, edge.task_id)}</span><small>Sucesora</small></div>)}</div> : <p className="pm-dep-muted">Ninguna tarea depende de esta por ahora.</p>}
      {error && <p role="alert" className="pm-task-error">{error}</p>}
      <div className="pm-task-actions"><button className="pm-task-secondary" type="button" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>
}
