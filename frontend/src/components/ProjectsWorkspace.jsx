import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'projectmind-local-project-drafts-v1'
const EMPTY = { name: '', description: '', objective: '', status: 'Planeación', priority: 'Media', startDate: '', endDate: '' }
const STATUSES = ['Planeación', 'En progreso', 'En pausa', 'Finalizado']
const PRIORITIES = ['Baja', 'Media', 'Alta']
function readDrafts() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string') : []
  } catch { return [] }
}
function formatDate(date) {
  if (!date) return 'Sin fecha'
  const [year, month, day] = date.split('-').map(Number)
  return year && month && day ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day)) : date
}
export default function ProjectsWorkspace({ onAskAI }) {
  const [projects, setProjects] = useState(readDrafts)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [sort, setSort] = useState('updated')
  const [selectedId, setSelectedId] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)) }
    catch { setNotice('No se pudieron guardar los borradores en este navegador.') }
  }, [projects])
  const filtered = useMemo(() => projects.filter(p => {
    const matches = `${p.name} ${p.description} ${p.objective}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))
    return matches && (filter === 'Todos' || p.status === filter)
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'es') : (b.updatedAt || '').localeCompare(a.updatedAt || '')), [projects, search, filter, sort])
  const selected = projects.find(p => p.id === selectedId) || null
  const count = status => projects.filter(p => p.status === status).length
  function openNew() { setForm({ ...EMPTY }); setEditingId(null); setError(''); setEditorOpen(true) }
  function openEdit(p) { setForm({ name:p.name, description:p.description || '', objective:p.objective || '', status:p.status, priority:p.priority || 'Media', startDate:p.startDate || '', endDate:p.endDate || '' }); setEditingId(p.id); setError(''); setEditorOpen(true) }
  function save(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Escribe el nombre del proyecto.'); return }
    if (form.startDate && form.endDate && form.endDate < form.startDate) { setError('La fecha final no puede ser anterior a la inicial.'); return }
    const now = new Date().toISOString()
    if (editingId) {
      setProjects(list => list.map(p => p.id === editingId ? { ...p, ...form, name: form.name.trim(), updatedAt: now } : p))
      setNotice('Borrador actualizado en este navegador. No se envió al servidor.')
    } else {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`
      setProjects(list => [{ ...form, name: form.name.trim(), id, createdAt: now, updatedAt: now }, ...list])
      setSelectedId(id)
      setNotice('Borrador creado en este navegador. No se envió al servidor.')
    }
    setEditorOpen(false)
  }
  function remove(p) {
    if (!window.confirm(`¿Eliminar el borrador local «${p.name}»? Esta acción no se puede deshacer.`)) return
    setProjects(list => list.filter(item => item.id !== p.id))
    if (selectedId === p.id) setSelectedId(null)
    setNotice('Borrador eliminado únicamente de este navegador.')
  }
  function ask(p) {
    onAskAI(`Ayúdame a planificar el proyecto «${p.name}». Descripción: ${p.description || 'Sin descripción'}. Objetivo: ${p.objective || 'Por definir'}. Estado: ${p.status}. Prioridad: ${p.priority}. Propón próximos pasos y riesgos, sin afirmar que tienes acceso a la base de datos.`)
  }
  return <div className="projects-workspace">
    <div className="projects-head"><div><span className="eyebrow">ESPACIO DE TRABAJO / PROYECTOS</span><h1>Mis proyectos</h1><p>Organiza tus iniciativas y prepara el trabajo con ayuda de la IA.</p></div><button className="primary-button" onClick={openNew}>＋ Nuevo proyecto</button></div>
    <div className="projects-local-note" role="note"><span aria-hidden="true">ⓘ</span><div><strong>Modo borrador local</strong><p>Los proyectos creados aquí se guardan solo en este navegador. No se sincronizan con Supabase, GitHub ni con otros integrantes. No incluyas información confidencial.</p></div></div>
    <div className="projects-metrics" aria-label="Resumen de borradores"><div><small>Total de borradores</small><strong>{projects.length}</strong></div><div><small>En progreso</small><strong>{count('En progreso')}</strong></div><div><small>En planeación</small><strong>{count('Planeación')}</strong></div><div><small>Finalizados</small><strong>{count('Finalizado')}</strong></div></div>
    <div className="projects-toolbar"><div className="projects-search"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre, descripción u objetivo" aria-label="Buscar proyectos"/></div><label className="projects-select">Estado <select value={filter} onChange={e => setFilter(e.target.value)}><option>Todos</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label><label className="projects-select">Ordenar <select value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Más recientes</option><option value="name">Nombre A–Z</option></select></label></div>
    {notice && <div className="projects-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso">✕</button></div>}
    {filtered.length ? <div className="projects-grid">{filtered.map(p => <article key={p.id} className="project-tile"><div className="project-tile-top"><span className="project-tile-icon" aria-hidden="true">▦</span><span className={`project-status status-${p.status.toLowerCase().replaceAll(' ', '-')}`}>{p.status}</span></div><h2>{p.name}</h2><p>{p.description || 'Sin descripción. Agrega información para contextualizar el proyecto.'}</p><div className="project-tile-meta"><span>Prioridad: {p.priority}</span><span>Fin: {formatDate(p.endDate)}</span></div><div className="project-tile-actions"><button className="outline-button" onClick={() => setSelectedId(p.id)}>Ver detalles</button><button className="project-link" onClick={() => ask(p)}>✧ Consultar IA</button></div></article>)}</div> : <div className="projects-empty"><div className="projects-empty-icon">▦</div><h2>{projects.length ? 'No hay proyectos que coincidan' : 'Tu próximo proyecto comienza aquí'}</h2><p>{projects.length ? 'Prueba con otra búsqueda o cambia el filtro de estado.' : 'Crea tu primer borrador, define su objetivo y organiza sus próximos pasos. No se enviará al backend.'}</p>{projects.length ? <button className="outline-button" onClick={() => {setSearch('');setFilter('Todos')}}>Limpiar filtros</button> : <button className="primary-button" onClick={openNew}>＋ Crear primer proyecto</button>}</div>}
    {selected && <div className="projects-modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setSelectedId(null)}}><section className="projects-dialog project-details" role="dialog" aria-modal="true" aria-labelledby="project-detail-title"><div className="projects-dialog-top"><span className="eyebrow">DETALLE DEL BORRADOR</span><button onClick={() => setSelectedId(null)} aria-label="Cerrar detalles">✕</button></div><h2 id="project-detail-title">{selected.name}</h2><span className="project-status">{selected.status}</span><h3>Descripción</h3><p>{selected.description || 'Todavía no hay una descripción.'}</p><h3>Objetivo</h3><p>{selected.objective || 'Objetivo pendiente de definir.'}</p><div className="project-detail-grid"><div><small>Prioridad</small><strong>{selected.priority}</strong></div><div><small>Inicio</small><strong>{formatDate(selected.startDate)}</strong></div><div><small>Entrega</small><strong>{formatDate(selected.endDate)}</strong></div><div><small>Última edición</small><strong>{new Date(selected.updatedAt).toLocaleDateString('es-MX')}</strong></div></div><div className="project-detail-actions"><button className="primary-button" onClick={() => ask(selected)}>✧ Planificar con IA</button><button className="outline-button" onClick={() => openEdit(selected)}>Editar</button><button className="project-delete" onClick={() => remove(selected)}>Eliminar borrador</button></div><p className="project-local-foot">Este registro solo existe en el almacenamiento local del navegador.</p></section></div>}
    {editorOpen && <div className="projects-modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setEditorOpen(false)}}><section className="projects-dialog" role="dialog" aria-modal="true" aria-labelledby="project-form-title"><div className="projects-dialog-top"><span className="eyebrow">{editingId ? 'EDITAR BORRADOR' : 'NUEVO BORRADOR'}</span><button onClick={() => setEditorOpen(false)} aria-label="Cerrar formulario">✕</button></div><h2 id="project-form-title">{editingId ? 'Editar proyecto' : 'Crear proyecto'}</h2><p className="projects-form-intro">Guarda la información en este navegador. La sincronización con el backend se implementará posteriormente.</p><form onSubmit={save} className="projects-form"><label>Nombre del proyecto <span>*</span><input autoFocus maxLength={100} value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="Ej. Plataforma de gestión" required/></label><label>Descripción<textarea rows="3" maxLength={800} value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} placeholder="¿De qué trata el proyecto?"/></label><label>Objetivo principal<textarea rows="2" maxLength={500} value={form.objective} onChange={e => setForm(f => ({...f,objective:e.target.value}))} placeholder="¿Qué quieres lograr?"/></label><div className="projects-form-row"><label>Estado<select value={form.status} onChange={e => setForm(f => ({...f,status:e.target.value}))}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label><label>Prioridad<select value={form.priority} onChange={e => setForm(f => ({...f,priority:e.target.value}))}>{PRIORITIES.map(s => <option key={s}>{s}</option>)}</select></label></div><div className="projects-form-row"><label>Fecha de inicio<input type="date" value={form.startDate} onChange={e => setForm(f => ({...f,startDate:e.target.value}))}/></label><label>Fecha de entrega<input type="date" value={form.endDate} onChange={e => setForm(f => ({...f,endDate:e.target.value}))}/></label></div>{error && <p className="projects-error" role="alert">{error}</p>}<div className="projects-form-actions"><button type="button" className="outline-button" onClick={() => setEditorOpen(false)}>Cancelar</button><button type="submit" className="primary-button">{editingId ? 'Guardar cambios locales' : 'Crear borrador local'}</button></div></form></section></div>}
  </div>
}
