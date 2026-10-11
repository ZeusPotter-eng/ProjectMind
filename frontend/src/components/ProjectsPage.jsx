import { useCallback, useEffect, useMemo, useState } from 'react'
import { archiveProject, createProject, listProjects, updateProject } from '../api/client'
import './projects.css'
import ProjectMembersPanel from './ProjectMembersPanel'

const STATUSES = {
  planning: 'Planeación',
  active: 'Activo',
  on_hold: 'En pausa',
  completed: 'Finalizado',
  archived: 'Archivado',
}

const EMPTY_FORM = { name: '', objective: '', description: '', status: 'planning', start_date: '', due_date: '' }

function formatDate(date) {
  if (!date) return 'Sin fecha'
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function ProjectForm({ project, saving, onSave, onCancel }) {
  const [form, setForm] = useState(() => project ? {
    name: project.name,
    objective: project.objective,
    description: project.description || '',
    status: project.status,
    start_date: project.start_date || '',
    due_date: project.due_date || '',
  } : EMPTY_FORM)
  const [error, setError] = useState('')

  function update(field, value) { setForm(current => ({ ...current, [field]: value })); setError('') }

  async function submit(event) {
    event.preventDefault()
    if (form.name.trim().length < 3) return setError('El nombre requiere al menos 3 caracteres.')
    if (form.objective.trim().length < 5) return setError('El objetivo requiere al menos 5 caracteres.')
    if (form.start_date && form.due_date && form.due_date < form.start_date) {
      return setError('La fecha de término no puede ser anterior al inicio.')
    }
    try {
      await onSave({
        name: form.name.trim(), objective: form.objective.trim(),
        description: form.description.trim() || null,
        status: form.status,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
      })
    } catch (err) { setError(err.message || 'No se pudo guardar el proyecto.') }
  }

  return <section className="pm-project-form-card" aria-labelledby="pm-project-form-title">
    <div className="pm-project-form-heading">
      <div><span className="eyebrow">PM-13 · {project ? 'EDICIÓN' : 'NUEVO PROYECTO'}</span><h2 id="pm-project-form-title">{project ? 'Editar proyecto' : 'Crear proyecto'}</h2></div>
      <button type="button" onClick={onCancel} className="pm-project-icon-btn" aria-label="Cerrar formulario">×</button>
    </div>
    <form className="pm-project-form" onSubmit={submit}>
      <label><span>Nombre del proyecto <b>*</b></span><input required minLength={3} maxLength={150} autoFocus value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ej. Plataforma de gestión escolar" /></label>
      <label><span>Objetivo principal <b>*</b></span><textarea required minLength={5} maxLength={2000} rows={3} value={form.objective} onChange={e => update('objective', e.target.value)} placeholder="¿Qué se desea conseguir con este proyecto?" /></label>
      <label><span>Descripción (opcional)</span><textarea maxLength={5000} rows={3} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Contexto, alcance y detalles principales" /></label>
      <div className="pm-project-fields">
        <label>Estado<select value={form.status} onChange={e => update('status', e.target.value)}>{Object.entries(STATUSES).filter(([value]) => value !== 'archived' || project?.status === 'archived').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Fecha de inicio<input type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} /></label>
        <label>Fecha de término<input type="date" min={form.start_date || undefined} value={form.due_date} onChange={e => update('due_date', e.target.value)} /></label>
      </div>
      {error && <p className="pm-project-alert error" role="alert">{error}</p>}
      <div className="pm-project-form-actions"><button type="button" className="pm-project-secondary" onClick={onCancel} disabled={saving}>Cancelar</button><button type="submit" className="pm-project-primary" disabled={saving}>{saving ? 'Guardando…' : project ? 'Guardar cambios' : 'Crear proyecto'}</button></div>
    </form>
  </section>
}

export default function ProjectsPage({ getAccessToken, currentUserId }) {
  const [projects, setProjects] = useState([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [includeArchived, setIncludeArchived] = useState(false)
  const [offset, setOffset] = useState(0)
  const [formMode, setFormMode] = useState(null)
  const [confirmArchive, setConfirmArchive] = useState(null)
  const [membersProject, setMembersProject] = useState(null)
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await listProjects(getAccessToken, { includeArchived, limit, offset })
      setProjects(result.items || []); setCount(result.count ?? 0)
    } catch (err) { setError(err.message || 'No fue posible cargar los proyectos.') }
    finally { setLoading(false) }
  }, [getAccessToken, includeArchived, offset])

  useEffect(() => { load() }, [load])
  useEffect(() => { setOffset(0) }, [includeArchived])

  const visible = useMemo(() => projects.filter(project => {
    const query = search.trim().toLocaleLowerCase('es')
    return (!query || [project.name, project.objective, project.description].some(value => (value || '').toLocaleLowerCase('es').includes(query))) && (statusFilter === 'all' || project.status === statusFilter)
  }), [projects, search, statusFilter])

  async function save(data) {
    setSaving(true); setNotice('')
    try {
      if (formMode === 'new') await createProject(getAccessToken, data)
      else await updateProject(getAccessToken, formMode.id, data)
      setFormMode(null)
      setNotice(formMode === 'new' ? 'Proyecto creado correctamente.' : 'Proyecto actualizado correctamente.')
      if (offset !== 0) setOffset(0)
      else await load()
    } finally { setSaving(false) }
  }

  async function archive() {
    if (!confirmArchive) return
    setSaving(true); setError(''); setNotice('')
    try {
      await archiveProject(getAccessToken, confirmArchive.id)
      setNotice('Proyecto archivado. Puedes consultarlo con “Incluir archivados”.')
      setConfirmArchive(null)
      await load()
    } catch (err) { setError(err.message || 'No fue posible archivar el proyecto.'); setConfirmArchive(null) }
    finally { setSaving(false) }
  }

  return <div className="pm-project-page">
    <header className="pm-project-header">
      <div><span className="eyebrow">PROJECTMIND · PM-13</span><h1>Mis proyectos</h1><p>Crea, organiza y da seguimiento a tus proyectos desde un solo lugar.</p></div>
      <button type="button" className="pm-project-primary" onClick={() => { setFormMode('new'); setError(''); setNotice('') }}>+ Nuevo proyecto</button>
    </header>

    <div className="pm-project-overview">
      <div><span>Proyectos disponibles</span><strong>{count}</strong><small>{includeArchived ? 'Incluye archivados' : 'Sin archivados'}</small></div>
      <div><span>En esta página</span><strong>{projects.length}</strong><small>Resultados cargados</small></div>
      <div><span>En actividad</span><strong>{projects.filter(p => p.status === 'active').length}</strong><small>En esta página</small></div>
    </div>

    <section className="pm-project-list-panel">
      <div className="pm-project-toolbar">
        <div className="pm-project-toolbar-top"><div><span className="eyebrow">PORTAFOLIO</span><h2>Listado de proyectos</h2></div><button type="button" className="pm-project-secondary" onClick={load} disabled={loading}>↻ Actualizar</button></div>
        <div className="pm-project-filters">
          <label className="pm-project-search"><span>Buscar en esta página</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre, objetivo o descripción" /></label>
          <label><span>Estado</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos</option>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="pm-project-archive-toggle"><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)} /> Incluir archivados</label>
        </div>
      </div>
      {error && <p className="pm-project-alert error" role="alert">{error}</p>}
      {notice && <p className="pm-project-alert success" role="status">{notice}</p>}
      {loading ? <div className="pm-project-empty">Cargando proyectos…</div> : visible.length === 0 ? <div className="pm-project-empty"><span>◇</span><h3>{projects.length ? 'Sin coincidencias' : 'Aún no hay proyectos para mostrar'}</h3><p>{projects.length ? 'Prueba otros filtros de búsqueda.' : 'Haz clic en “Nuevo proyecto” para comenzar.'}</p></div> : <div className="pm-project-cards">{visible.map(project => <article className="pm-project-card" key={project.id}>
        <div className="pm-project-card-title"><div><span className="pm-project-status" data-status={project.status}>{STATUSES[project.status] || project.status}</span><h3>{project.name}</h3></div><span className="pm-project-id" title={project.id}>#{project.id.slice(0, 8)}</span></div>
        <p className="pm-project-objective">{project.objective}</p>
        {project.description && <p className="pm-project-description">{project.description}</p>}
        <div className="pm-project-meta"><span>Inicio: <b>{formatDate(project.start_date)}</b></span><span>Término: <b>{formatDate(project.due_date)}</b></span></div>
        <div className="pm-project-card-actions"><button type="button" className="pm-project-secondary" onClick={() => setMembersProject(project)}>Integrantes</button>{project.owner_id === currentUserId ? <><button type="button" className="pm-project-secondary" onClick={() => setFormMode(project)}>Editar</button>{project.status !== 'archived' && <button type="button" className="pm-project-danger-link" onClick={() => setConfirmArchive(project)}>Archivar</button>}</> : <span className="pm-project-readonly">Proyecto compartido · revisa tus permisos en Integrantes</span>}</div>
      </article>)}</div>}
      <div className="pm-project-pagination"><small>{count ? `${offset + 1}–${Math.min(offset + projects.length, count)} de ${count}` : '0 proyectos'} · Buscar y filtrar actúa sobre la página actual</small><div><button type="button" className="pm-project-secondary" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</button><button type="button" className="pm-project-secondary" disabled={loading || offset + limit >= count} onClick={() => setOffset(offset + limit)}>Siguiente</button></div></div>
    </section>

    {membersProject && <div className="pm-project-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMembersProject(null) }}>
      <div className="pm-project-modal-dialog" role="dialog" aria-modal="true" aria-label={`Integrantes de ${membersProject.name}`}>
        <ProjectMembersPanel project={membersProject} currentUserId={currentUserId} getAccessToken={getAccessToken}
          onClose={() => setMembersProject(null)} onMembershipChanged={load}
          onEditProject={() => { setFormMode(membersProject); setMembersProject(null) }}
          onArchiveProject={() => { setConfirmArchive(membersProject); setMembersProject(null) }}/>

      </div>
    </div>}
    {formMode && <div className="pm-project-modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setFormMode(null) }}><div className="pm-project-modal-dialog" role="dialog" aria-modal="true" aria-label={formMode === 'new' ? 'Crear proyecto' : 'Editar proyecto'}><ProjectForm key={formMode === 'new' ? 'new' : formMode.id} project={formMode === 'new' ? null : formMode} saving={saving} onSave={save} onCancel={() => !saving && setFormMode(null)}/></div></div>}
    {confirmArchive && <div className="pm-project-modal"><div className="pm-project-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar archivo"><span className="eyebrow">CONFIRMAR ACCIÓN</span><h2>¿Archivar proyecto?</h2><p>“{confirmArchive.name}” dejará de aparecer en la lista normal, pero conservará su información.</p><div className="pm-project-form-actions"><button type="button" className="pm-project-secondary" onClick={() => setConfirmArchive(null)} disabled={saving}>Cancelar</button><button type="button" className="pm-project-primary" onClick={archive} disabled={saving}>{saving ? 'Archivando…' : 'Sí, archivar'}</button></div></div></div>}
  </div>
}
