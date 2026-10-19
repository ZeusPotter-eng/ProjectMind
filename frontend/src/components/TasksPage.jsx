import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { assignTask, createTask, deleteTask, listProjectMembers, listProjects, listTasks, unassignTask, updateTask, listDependencies, createDependency, updateDependency, deleteDependency } from '../api/client'
import DependencyManager from './DependencyManager'
import { dependencySummary } from '../utils/dependencies'
import './tasks.css'

const STATUSES = { backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En progreso', blocked: 'Bloqueada', review: 'En revisión', done: 'Finalizada', cancelled: 'Cancelada' }
const PRIORITIES = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
const EMPTY = { title: '', description: '', status: 'todo', priority: 'medium', start_date: '', due_date: '', progress: 0 }
const asForm = (t) => t ? { title: t.title, description: t.description || '', status: t.status, priority: t.priority, start_date: t.start_date || '', due_date: t.due_date || '', progress: t.progress } : { ...EMPTY }
const displayDate = value => value ? value.split('-').reverse().join('/') : 'Sin fecha'

function TaskEditor({ task, busy, onCancel, onSave }) {
  const [form, setForm] = useState(() => asForm(task))
  const [error, setError] = useState('')
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value, ...(key === 'status' && value === 'done' ? { progress: 100 } : {}), ...(key === 'status' && prev.status === 'done' && value !== 'done' ? { progress: 0 } : {}) }))
  async function submit(e) {
    e.preventDefault(); setError('')
    if (form.title.trim().length < 3) return setError('Escribe un título de al menos 3 caracteres.')
    if (form.start_date && form.due_date && form.due_date < form.start_date) return setError('La fecha de término no puede ser anterior al inicio.')
    if (form.status !== 'done' && Number(form.progress) === 100) return setError('Para registrar 100%, selecciona Finalizada.')
    try {
      await onSave({ title: form.title.trim(), description: form.description.trim() || null, status: form.status, priority: form.priority,
        start_date: form.start_date || null, due_date: form.due_date || null, progress: Number(form.progress) })
    } catch (err) { setError(err.message || 'No se pudo guardar la tarea.') }
  }
  return <div className="pm-task-modal" role="dialog" aria-modal="true" aria-label={task ? 'Editar tarea' : 'Nueva tarea'}><div className="pm-task-dialog">
    <div className="pm-task-dialog-header"><div><span className="eyebrow">PROJECTMIND · PM-16</span><h2>{task ? 'Editar tarea' : 'Nueva tarea'}</h2></div><button type="button" onClick={onCancel} aria-label="Cerrar">×</button></div>
    <form onSubmit={submit} className="pm-task-form">
      <label>Título *<input autoFocus required maxLength={180} minLength={3} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ej. Diseñar la pantalla de seguimiento" /></label>
      <label>Descripción<textarea rows={3} maxLength={4000} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Criterios de aceptación y detalles" /></label>
      <div className="pm-task-fields"><label>Estado<select value={form.status} onChange={e => set('status', e.target.value)}>{Object.entries(STATUSES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Prioridad<select value={form.priority} onChange={e => set('priority', e.target.value)}>{Object.entries(PRIORITIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>
      <div className="pm-task-fields"><label>Inicio<input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></label><label>Entrega<input type="date" min={form.start_date || undefined} value={form.due_date} onChange={e => set('due_date', e.target.value)} /></label></div>
      <label>Avance: <strong>{form.progress}%</strong><input type="range" min="0" max="100" step="5" value={form.progress} disabled={form.status === 'done'} onChange={e => set('progress', Number(e.target.value))} /></label>
      {error && <p className="pm-task-error" role="alert">{error}</p>}
      <div className="pm-task-actions"><button type="button" className="pm-task-secondary" onClick={onCancel}>Cancelar</button><button type="submit" className="pm-task-primary" disabled={busy}>{busy ? 'Guardando...' : 'Guardar tarea'}</button></div>
    </form></div></div>
}

async function fetchAll(getPage, pageSize) {
  const results = []
  for (;;) {
    const data = await getPage(pageSize, results.length)
    results.push(...(data.items || []))
    if (!data.items?.length || results.length >= data.count) return results
  }
}

export default function TasksPage({ getAccessToken, focusDependencies = false }) {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [members, setMembers] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [dependencies, setDependencies] = useState([])
  const [dependencyTask, setDependencyTask] = useState(null)
  const [dependencyFilter, setDependencyFilter] = useState('all')
  const loadSequence = useRef(0)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(undefined)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const limit = 50

  useEffect(() => {
    let active = true
    listProjects(getAccessToken, { limit: 100, includeArchived: true }).then(({ items }) => {
      if (!active) return
      setProjects(items || []); setProjectId(previous => previous || items?.[0]?.id || '')
    }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [getAccessToken])

  const load = useCallback(async () => {
    const currentLoad = ++loadSequence.current
    if (!projectId) { setTasks([]); setMembers([]); setAllTasks([]); setDependencies([]); setTotal(0); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const [taskData, memberData, catalog, edges] = await Promise.all([
        listTasks(getAccessToken, projectId, { limit, offset }),
        listProjectMembers(getAccessToken, projectId),
        fetchAll((l, o) => listTasks(getAccessToken, projectId, { limit: l, offset: o }), 100),
        fetchAll((l, o) => listDependencies(getAccessToken, projectId, { limit: l, offset: o }), 500),
      ])
      if (currentLoad !== loadSequence.current) return
      setTasks(taskData.items || []); setTotal(taskData.count || 0)
      setMembers((memberData.items || []).filter(m => m.status === 'active'))
      setAllTasks(catalog); setDependencies(edges)
    } catch (e) { if (currentLoad === loadSequence.current) setError(e.message || 'No se pudieron cargar las tareas y dependencias.') }
    finally { if (currentLoad === loadSequence.current) setLoading(false) }
  }, [getAccessToken, projectId, offset])
  useEffect(() => { load() }, [load])
  const project = projects.find(p => p.id === projectId)
  const readonly = project?.status === 'archived'
  const taskMap = useMemo(() => new Map(allTasks.map(t => [t.id, t])), [allTasks])
  const visible = useMemo(() => tasks.filter(t => {
    const summary = dependencySummary(t.id, dependencies, taskMap)
    const dependencyMatch = dependencyFilter === 'all' ||
      (dependencyFilter === 'waiting' && summary.pending.length > 0) ||
      (dependencyFilter === 'ready' && summary.hasDependencies && summary.ready) ||
      (dependencyFilter === 'none' && !summary.hasDependencies)
    return dependencyMatch && (status === 'all' || t.status === status) && (priority === 'all' || t.priority === priority) &&
      `${t.title} ${t.description || ''}`.toLowerCase().includes(search.toLowerCase().trim())
  }), [tasks, status, priority, search, dependencies, taskMap, dependencyFilter])
  const completion = tasks.length ? Math.round(tasks.reduce((n, t) => n + t.progress, 0) / tasks.length) : 0
  const doneCount = tasks.filter(t => t.status === 'done').length

  async function applyDependency(action, successMessage) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(successMessage); await load() }
    finally { setBusy(false) }
  }
  const addDependency = data => applyDependency(() => createDependency(getAccessToken, projectId, data), 'Dependencia creada.')
  const editDependency = (id, data) => applyDependency(() => updateDependency(getAccessToken, projectId, id, data), 'Dependencia actualizada.')
  const removeDependency = id => applyDependency(() => deleteDependency(getAccessToken, projectId, id), 'Dependencia eliminada.')

  async function save(data) {
    setBusy(true); setError(''); setNotice('')
    try {
      if (editor?.id) await updateTask(getAccessToken, projectId, editor.id, data)
      else await createTask(getAccessToken, projectId, data)
      setNotice(editor?.id ? 'Tarea actualizada.' : 'Tarea creada.'); setEditor(undefined); await load()
    } finally { setBusy(false) }
  }
  async function changeAssignee(task, userId) {
    setBusy(true); setError(''); setNotice('')
    try {
      if (task.assignees.includes(userId)) await unassignTask(getAccessToken, projectId, task.id, userId)
      else await assignTask(getAccessToken, projectId, task.id, userId)
      setNotice('Responsables actualizados.'); await load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function remove(task) {
    if (!window.confirm(`¿Eliminar definitivamente la tarea "${task.title}"? Solo puede hacerlo un administrador.`)) return
    setBusy(true); setError(''); setNotice('')
    try { await deleteTask(getAccessToken, projectId, task.id); setNotice('Tarea eliminada.'); await load() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function quickStatus(task, nextStatus) {
    setBusy(true); setError(''); setNotice('')
    try { await updateTask(getAccessToken, projectId, task.id, { status: nextStatus, progress: nextStatus === 'done' ? 100 : task.status === 'done' ? 0 : task.progress }); await load() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return <div className="pm-tasks-page">
    <header className="pm-task-heading"><div><span className="eyebrow">PROJECTMIND · {focusDependencies ? 'PM-18' : 'PM-16 / PM-18'}</span><h1>{focusDependencies ? 'Dependencias entre tareas' : 'Gestión de tareas'}</h1><p>{focusDependencies ? 'Relaciona tareas predecesoras y sucesoras, e identifica qué trabajos siguen pendientes.' : 'Planifica, asigna responsables y supervisa el avance real de cada proyecto.'}</p></div>
      <button className="pm-task-primary" disabled={!projectId || readonly} onClick={() => setEditor(null)}>+ Nueva tarea</button></header>
    <div className="pm-task-project"><label>Proyecto seleccionado<select value={projectId} onChange={e => { setProjectId(e.target.value); setOffset(0); setDependencyTask(null); setNotice('') }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{readonly && <p>Este proyecto está archivado: las tareas solo pueden consultarse.</p>}</div>
    {error && <p role="alert" className="pm-task-error">{error}</p>}{notice && <p role="status" className="pm-task-notice">{notice}</p>}
    <div className="pm-task-stats"><article><span>Total de tareas</span><strong>{total}</strong></article><article><span>Completadas en esta página</span><strong>{doneCount}</strong></article><article><span>Avance medio en esta página</span><strong>{completion}%</strong></article></div>
    <section className="pm-task-panel"><div className="pm-task-toolbar"><label>Buscar<input type="search" placeholder="Título o descripción" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos</option>{Object.entries(STATUSES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Prioridad<select value={priority} onChange={e => setPriority(e.target.value)}><option value="all">Todas</option>{Object.entries(PRIORITIES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Dependencias<select value={dependencyFilter} onChange={e => setDependencyFilter(e.target.value)}><option value="all">Todas</option><option value="waiting">Con requisitos pendientes</option><option value="ready">Predecesoras completas</option><option value="none">Sin dependencias</option></select></label><button className="pm-task-secondary" onClick={load} disabled={loading}>↻ Actualizar</button></div>
      {loading ? <div className="pm-task-empty">Cargando tareas…</div> : !projectId ? <div className="pm-task-empty">Primero crea un proyecto en la sección Proyectos.</div> : !visible.length ? <div className="pm-task-empty">No hay tareas con esos filtros. Crea la primera tarea del proyecto.</div> : <div className="pm-task-grid">{visible.map(task => <article className="pm-task-card" key={task.id}>
        <div className="pm-task-card-head"><span className="pm-task-status" data-status={task.status}>{STATUSES[task.status]}</span><span className="pm-task-priority" data-priority={task.priority}>{PRIORITIES[task.priority]}</span></div>
        <h3>{task.title}</h3>{task.description && <p>{task.description}</p>}
        <div className="pm-task-dates"><span>Inicio: {displayDate(task.start_date)}</span><span>Entrega: {displayDate(task.due_date)}</span></div>
        <div className="pm-task-progress-head"><span>Avance</span><strong>{task.progress}%</strong></div><div className="pm-task-progress"><span style={{ width: `${task.progress}%` }}/></div>
        <div className="pm-task-dependency"><div>{(() => {
          const info = dependencySummary(task.id, dependencies, taskMap)
          return <small className={info.pending.length ? 'pm-dep-waiting' : 'pm-dep-ready'}>{!info.hasDependencies ? 'Sin predecesoras' : info.pending.length ? `◷ Espera ${info.pending.length} tarea(s)` : '✓ Predecesoras finalizadas'} · {info.successors.length} sucesora(s)</small>
        })()}</div><button type="button" className="pm-task-secondary" disabled={busy} onClick={() => setDependencyTask(task)}>Ver dependencias</button></div>
        <div className="pm-task-assign"><strong>Responsables</strong>{members.length ? <div className="pm-task-people">{members.map(member => <label key={member.user_id}><input type="checkbox" checked={task.assignees.includes(member.user_id)} disabled={readonly || busy} onChange={() => changeAssignee(task, member.user_id)} /><span>{member.full_name || `Integrante ${member.user_id.slice(0,8)}`}</span></label>)}</div> : <small>No hay integrantes activos disponibles.</small>}</div>
        <div className="pm-task-footer"><select aria-label={`Cambiar estado de ${task.title}`} value={task.status} disabled={readonly || busy} onChange={e => quickStatus(task, e.target.value)}>{Object.entries(STATUSES).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><button className="pm-task-secondary" disabled={readonly || busy} onClick={() => setEditor(task)}>Editar</button><button className="pm-task-delete" disabled={readonly || busy} onClick={() => remove(task)}>Eliminar</button></div>
      </article>)}</div>}
      <div className="pm-task-pages"><small>Mostrando {visible.length} de {total} tareas (filtros sobre la página actual)</small><div><button className="pm-task-secondary" disabled={offset === 0 || loading} onClick={() => setOffset(n => Math.max(n - limit, 0))}>Anterior</button><button className="pm-task-secondary" disabled={offset + limit >= total || loading} onClick={() => setOffset(n => n + limit)}>Siguiente</button></div></div>
    </section>
    {dependencyTask && <DependencyManager key={dependencyTask.id} task={dependencyTask} allTasks={allTasks} dependencies={dependencies} busy={busy} readonly={readonly} onClose={() => setDependencyTask(null)} onAdd={addDependency} onUpdate={editDependency} onDelete={removeDependency} />}
    {editor !== undefined && <TaskEditor key={editor?.id || 'new'} task={editor} busy={busy} onSave={save} onCancel={() => setEditor(undefined)} />}
  </div>
}
