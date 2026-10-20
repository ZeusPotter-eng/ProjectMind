import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createBlocker, deleteBlocker, listBlockers, listProjects, listTasks, updateBlocker } from '../api/client'
import './tasks.css'
import './blockers.css'

const SEVERITIES = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' }
const STATUSES = { open: 'Abierto', resolved: 'Resuelto', dismissed: 'Descartado' }
const BLANK = { title: '', description: '', task_id: '', severity: 'medium' }

async function fetchAll(getPage, size) {
  const rows = []
  for (;;) {
    const { items = [], count = 0 } = await getPage(size, rows.length)
    rows.push(...items)
    if (!items.length || rows.length >= count) return rows
  }
}

function BlockerEditor({ initial, tasks, busy, onClose, onSave }) {
  const [form, setForm] = useState(initial ? { title: initial.title, description: initial.description || '', task_id: initial.task_id || '', severity: initial.severity } : { ...BLANK })
  const [error, setError] = useState('')
  const set = (name, value) => setForm(prev => ({ ...prev, [name]: value }))
  async function submit(event) {
    event.preventDefault(); setError('')
    if (form.title.trim().length < 3) return setError('Escribe un título de al menos tres caracteres.')
    try { await onSave({ ...form, title: form.title.trim(), description: form.description.trim() || null, task_id: form.task_id || null }) }
    catch (err) { setError(err.message || 'No fue posible guardar el impedimento.') }
  }
  return <div className="pm-task-modal" role="dialog" aria-modal="true" aria-label={initial ? 'Editar impedimento' : 'Nuevo impedimento'}><div className="pm-task-dialog">
    <div className="pm-task-dialog-header"><div><span className="eyebrow">PROJECTMIND · PM-19</span><h2>{initial ? 'Editar impedimento' : 'Registrar impedimento'}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
    <form className="pm-task-form" onSubmit={submit}>
      <label>Título *<input autoFocus minLength={3} maxLength={180} required value={form.title} onChange={event => set('title', event.target.value)} placeholder="Ej. Falta autorización de acceso" /></label>
      <label>Descripción<textarea rows={3} maxLength={4000} value={form.description} onChange={event => set('description', event.target.value)} placeholder="Qué sucede y qué necesitamos para resolverlo" /></label>
      <div className="pm-task-fields">
        <label>Tarea afectada<select value={form.task_id} onChange={event => set('task_id', event.target.value)}><option value="">General del proyecto (no bloquea tareas)</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <label>Gravedad<select value={form.severity} onChange={event => set('severity', event.target.value)}>{Object.entries(SEVERITIES).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select></label>
      </div>
      <small className="pm-block-hint">Solo los impedimentos abiertos vinculados a una tarea impiden aumentar su avance o iniciar/finalizar el trabajo.</small>
      {error && <p role="alert" className="pm-task-error">{error}</p>}
      <div className="pm-task-actions"><button type="button" className="pm-task-secondary" onClick={onClose}>Cancelar</button><button type="submit" disabled={busy} className="pm-task-primary">{busy ? 'Guardando...' : 'Guardar impedimento'}</button></div>
    </form>
  </div></div>
}

export default function BlockersPage({ getAccessToken }) {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [blockers, setBlockers] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState(undefined)
  const [filter, setFilter] = useState('all')
  const loadSequence = useRef(0)

  useEffect(() => {
    let current = true
    listProjects(getAccessToken, { limit: 100, includeArchived: true }).then(data => {
      if (current) { setProjects(data.items || []); setProjectId(previous => previous || data.items?.[0]?.id || '') }
    }).catch(err => { if (current) setError(err.message) })
    return () => { current = false }
  }, [getAccessToken])

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    if (!projectId) { setBlockers([]); setTasks([]); return }
    setLoading(true); setError('')
    try {
      const [allBlockers, allTasks] = await Promise.all([
        fetchAll((limit, offset) => listBlockers(getAccessToken, projectId, { limit, offset }), 500),
        fetchAll((limit, offset) => listTasks(getAccessToken, projectId, { limit, offset }), 100),
      ])
      if (sequence !== loadSequence.current) return
      setBlockers(allBlockers); setTasks(allTasks)
    } catch (err) { if (sequence === loadSequence.current) setError(err.message || 'No se pudo cargar la información.') }
    finally { if (sequence === loadSequence.current) setLoading(false) }
  }, [getAccessToken, projectId])
  useEffect(() => { load() }, [load])
  const archived = projects.find(project => project.id === projectId)?.status === 'archived'
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks])
  const visible = blockers.filter(blocker => filter === 'all' || blocker.status === filter)
  const openCount = blockers.filter(blocker => blocker.status === 'open').length
  const resolvedCount = blockers.filter(blocker => blocker.status === 'resolved').length
  const linkedCount = blockers.filter(blocker => blocker.status === 'open' && blocker.task_id).length

  async function act(operation, message) {
    setBusy(true); setNotice(''); setError('')
    try { await operation(); await load(); setNotice(message); return true }
    catch (err) { setError(err.message || 'No se pudo realizar la operación.'); return false }
    finally { setBusy(false) }
  }
  async function save(data) {
    const success = await act(() => editor?.id ? updateBlocker(getAccessToken, projectId, editor.id, data) : createBlocker(getAccessToken, projectId, data), editor?.id ? 'Impedimento actualizado.' : 'Impedimento registrado.')
    if (success) setEditor(undefined)
    else throw new Error('Revisa el mensaje de error en la página e inténtalo de nuevo.')
  }
  async function changeStatus(blocker, status) {
    await act(() => updateBlocker(getAccessToken, projectId, blocker.id, { status }), status === 'resolved' ? 'Impedimento resuelto. La tarea podrá continuar si no tiene otras restricciones.' : 'Estado del impedimento actualizado.')
  }
  async function remove(blocker) {
    if (!window.confirm(`¿Eliminar definitivamente el impedimento "${blocker.title}"?`)) return
    await act(() => deleteBlocker(getAccessToken, projectId, blocker.id), 'Impedimento eliminado.')
  }

  return <div className="pm-tasks-page pm-blockers-page">
    <header className="pm-task-heading"><div><span className="eyebrow">PROJECTMIND · PM-19</span><h1>Bloqueos e impedimentos</h1><p>Documenta obstáculos, vincúlalos a una tarea y registra su resolución para reactivar el avance.</p></div><button className="pm-task-primary" disabled={!projectId || archived || busy} onClick={() => setEditor(null)}>+ Nuevo impedimento</button></header>
    <div className="pm-task-project"><label>Proyecto seleccionado<select value={projectId} onChange={event => { setProjectId(event.target.value); setNotice(''); setEditor(undefined) }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>{archived && <p>Proyecto archivado: solo se permite consultar.</p>}</div>
    {error && <p role="alert" className="pm-task-error">{error}</p>}{notice && <p role="status" className="pm-task-notice">{notice}</p>}
    <div className="pm-task-stats"><article><span>Impedimentos abiertos</span><strong>{openCount}</strong></article><article><span>Tareas afectadas (registros)</span><strong>{linkedCount}</strong></article><article><span>Resueltos</span><strong>{resolvedCount}</strong></article></div>
    <section className="pm-task-panel"><div className="pm-block-toolbar"><label>Mostrar<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todos</option>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="pm-task-secondary" disabled={loading} onClick={load}>↻ Actualizar</button></div>
      {loading ? <div className="pm-task-empty">Cargando impedimentos…</div> : !projectId ? <div className="pm-task-empty">Crea primero un proyecto.</div> : !visible.length ? <div className="pm-task-empty">Sin impedimentos para este filtro.</div> : <div className="pm-task-grid">{visible.map(blocker => <article key={blocker.id} className="pm-task-card pm-block-card">
        <div className="pm-task-card-head"><span className="pm-block-state" data-status={blocker.status}>{STATUSES[blocker.status]}</span><span className="pm-task-priority" data-priority={blocker.severity}>{SEVERITIES[blocker.severity]}</span></div>
        <h3>{blocker.title}</h3>{blocker.description && <p>{blocker.description}</p>}
        <p className="pm-block-linked">{blocker.task_id ? `Tarea: ${taskById.get(blocker.task_id)?.title || 'Tarea no disponible'}` : 'Impedimento general del proyecto'}</p>
        {blocker.resolved_at && <small className="pm-block-hint">Resuelto: {new Date(blocker.resolved_at).toLocaleString('es-MX')}</small>}
        <div className="pm-block-actions"><button type="button" className="pm-task-secondary" disabled={busy || archived} onClick={() => setEditor(blocker)}>Editar</button>{blocker.status === 'open' ? <><button type="button" className="pm-task-secondary" disabled={busy || archived} onClick={() => changeStatus(blocker, 'resolved')}>✓ Resolver</button><button type="button" className="pm-task-secondary" disabled={busy || archived} onClick={() => changeStatus(blocker, 'dismissed')}>Descartar</button></> : <button type="button" className="pm-task-secondary" disabled={busy || archived} onClick={() => changeStatus(blocker, 'open')}>Reabrir</button>}<button className="pm-task-delete" disabled={busy || archived} onClick={() => remove(blocker)}>Eliminar</button></div>
      </article>)}</div>}
      <p className="pm-block-hint">Los bloqueos por dependencias se actualizan automáticamente desde PM-18. Aquí puedes gestionar los impedimentos manuales.</p>
    </section>
    {editor !== undefined && <BlockerEditor key={editor?.id || 'new'} initial={editor} tasks={tasks} busy={busy} onClose={() => setEditor(undefined)} onSave={save} />}
  </div>
}
