import { useCallback, useEffect, useMemo, useState } from 'react'
import { listProjects } from '../api/client'
import './timeline.css'

import { asUTC, calendarDays, dayIsInProject, daysBetween, firstOfMonth, iso, localISO, MONTHS, plusDays, projectRange, readable, STATUS, WEEK } from '../utils/timelineDates'

function Gantt({ projects, first, months, chosen, onChoose }) {
  const end = firstOfMonth(first.getUTCFullYear(), first.getUTCMonth() + months)
  const span = daysBetween(first, end)
  const dayWidth = months === 1 ? 27 : 13
  const pixelWidth = span * dayWidth
  const days = Array.from({ length: span }, (_, index) => plusDays(first, index))
  const today = asUTC(localISO())
  const todayIndex = daysBetween(first, today)
  const segments = Array.from({ length: months }, (_, index) => {
    const current = firstOfMonth(first.getUTCFullYear(), first.getUTCMonth() + index)
    const next = firstOfMonth(first.getUTCFullYear(), first.getUTCMonth() + index + 1)
    return { label: `${MONTHS[current.getUTCMonth()]} ${current.getUTCFullYear()}`, days: daysBetween(current, next) }
  })
  return <div className="pm-gantt-scroll" role="region" aria-label="Cronograma de proyectos desplazable" tabIndex={0}>
    <div className="pm-gantt-table" style={{ '--pm-day': `${dayWidth}px`, '--pm-total': `${pixelWidth}px` }}>
      <div className="pm-gantt-label pm-gantt-heading">Proyecto y duración</div>
      <div className="pm-gantt-months">{segments.map(item => <span key={item.label} style={{ width: `${item.days * dayWidth}px` }}>{item.label}</span>)}</div>
      <div className="pm-gantt-label pm-gantt-day-label">Fechas de inicio y término</div>
      <div className="pm-gantt-days">{days.map((date, index) => <span key={iso(date)} className={index % 7 === 0 ? 'weekline' : ''} title={readable(date)}>{months === 1 || date.getUTCDay() === 1 || date.getUTCDate() === 1 ? date.getUTCDate() : ''}</span>)}</div>
      {projects.map(project => {
        const range = projectRange(project)
        const offset = Math.max(0, daysBetween(first, range.start))
        const last = Math.min(span, daysBetween(first, range.end) + 1)
        const visible = last > offset
        const past = Math.min(range.days, Math.max(0, daysBetween(range.start, today) + 1))
        const elapsedPercent = Math.round(past / range.days * 100)
        return <div className="pm-gantt-row" key={project.id}>
          <div className="pm-gantt-label pm-gantt-project">
            <strong title={project.name}>{project.name}</strong>
            <small>{range.days} días · {STATUS[project.status] || project.status}</small>
          </div>
          <div className="pm-gantt-track" style={{ width: `${pixelWidth}px` }}>
            {todayIndex >= 0 && todayIndex < span && <div className="pm-gantt-today" style={{ left: `${todayIndex * dayWidth + dayWidth / 2}px` }} title="Hoy"/>}
            {visible && <button type="button" className={`pm-gantt-bar ${chosen?.id === project.id ? 'selected' : ''}`} data-status={project.status} style={{ left: `${offset * dayWidth + 2}px`, width: `${Math.max(8, (last - offset) * dayWidth - 4)}px` }} onClick={() => onChoose(project)} title={`${project.name} · ${readable(range.start)} — ${readable(range.end)} · ${range.days} días`} aria-label={`Ver detalles de ${project.name}`}>
              <span className="pm-gantt-elapsed" style={{ width: `${elapsedPercent}%` }}/>
              <span className="pm-gantt-bar-text">{project.name}</span>
            </button>}
          </div>
        </div>
      })}
    </div>
  </div>
}

export default function TimelinePage({ getAccessToken, onOpenProjects }) {
  const [projects, setProjects] = useState([])
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [view, setView] = useState('month')
  const [month, setMonth] = useState(() => firstOfMonth(new Date().getFullYear(), new Date().getMonth()))
  const [chosenProject, setChosenProject] = useState(null)
  const [chosenDate, setChosenDate] = useState(() => localISO())

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const all = []
      const batchSize = 100
      let count = 0
      do {
        const response = await listProjects(getAccessToken, { includeArchived, limit: batchSize, offset: all.length })
        all.push(...(response.items || []))
        count = response.count ?? all.length
        if (!response.items?.length) break
      } while (all.length < count && all.length < 500)
      setTruncated(all.length < count)
      setProjects(all.slice(0, 500))
    } catch (err) { setError(err.message || 'No fue posible consultar el calendario.') }
    finally { setLoading(false) }
  }, [getAccessToken, includeArchived])

  useEffect(() => { load() }, [load])

  const scheduled = useMemo(() => projects.filter(projectRange).sort((a, b) => a.start_date.localeCompare(b.start_date)), [projects])
  const undated = useMemo(() => projects.filter(p => !projectRange(p)), [projects])
  const currentDay = asUTC(chosenDate)
  const dayProjects = useMemo(() => scheduled.filter(p => dayIsInProject(p, currentDay)), [scheduled, chosenDate])
  const calendar = useMemo(() => calendarDays(month), [month])
  const thisMonth = `${MONTHS[month.getUTCMonth()]} ${month.getUTCFullYear()}`

  function changeMonth(offset) {
    setMonth(firstOfMonth(month.getUTCFullYear(), month.getUTCMonth() + offset))
    setChosenProject(null)
    setChosenDate(iso(firstOfMonth(month.getUTCFullYear(), month.getUTCMonth() + offset)))
  }
  function today() {
    const now = new Date()
    setMonth(firstOfMonth(now.getFullYear(), now.getMonth()))
    setChosenDate(iso(now))
  }

  return <section className="pm-timeline-page">
    <header className="pm-timeline-intro"><div><span className="eyebrow">PROJECTMIND · PLANIFICACIÓN</span><h1>Calendario y cronograma</h1><p>Visualiza la duración de tus proyectos sobre una línea de tiempo, sus fechas clave y los proyectos activos en cada día.</p></div><button className="pm-timeline-primary" type="button" onClick={onOpenProjects}>Gestionar fechas en Proyectos →</button></header>

    <div className="pm-timeline-stats">
      <article><span>Proyectos visibles</span><strong>{projects.length}</strong><small>Según permisos de tu cuenta</small></article>
      <article><span>Con fechas definidas</span><strong>{scheduled.length}</strong><small>Incluidos en el cronograma</small></article>
      <article><span>Sin cronograma</span><strong>{undated.length}</strong><small>Completa inicio y término</small></article>
    </div>
    <div className="pm-timeline-controls">
      <div className="pm-timeline-switch"><button type="button" className={view === 'month' ? 'selected' : ''} onClick={() => setView('month')}>Mes</button><button type="button" className={view === 'quarter' ? 'selected' : ''} onClick={() => setView('quarter')}>Trimestre</button></div>
      <div className="pm-timeline-period"><button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button><strong>{thisMonth}</strong><button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button><button type="button" onClick={today}>Hoy</button></div>
      <label className="pm-timeline-check"><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)}/> Incluir archivados</label>
      <button type="button" className="pm-timeline-refresh" onClick={load} disabled={loading}>↻ Actualizar</button>
    </div>
    {error && <p className="pm-timeline-error" role="alert">{error}</p>}
    {truncated && <p className="pm-timeline-warning">Se muestran los primeros 500 proyectos autorizados. Para un portafolio mayor será necesario ampliar la paginación.</p>}
    {loading ? <div className="pm-timeline-loading">Cargando la planificación…</div> : <>
      <section className="pm-timeline-section">
        <div className="pm-timeline-section-heading"><div><span className="eyebrow">VISTA GANTT</span><h2>Barras de duración</h2></div><p><span className="pm-timeline-legend today"/> Hoy <span className="pm-timeline-legend elapsed"/> Tiempo transcurrido</p></div>
        {scheduled.length ? <Gantt projects={scheduled} first={month} months={view === 'month' ? 1 : 3} chosen={chosenProject} onChoose={setChosenProject}/> : <div className="pm-timeline-empty">Todavía no hay proyectos con fecha de inicio y término. Puedes definirlas desde <button type="button" onClick={onOpenProjects}>Proyectos</button>.</div>}
        {chosenProject && <div className="pm-timeline-selected"><div><strong>{chosenProject.name}</strong><span>{readable(asUTC(chosenProject.start_date))} — {readable(asUTC(chosenProject.due_date))} · {projectRange(chosenProject)?.days} días calendario</span></div><span className="pm-timeline-status">{STATUS[chosenProject.status] || chosenProject.status}</span><button type="button" onClick={onOpenProjects}>Abrir Proyectos →</button><button type="button" onClick={() => setChosenProject(null)} aria-label="Cerrar detalle">×</button></div>}
      </section>
      <div className="pm-timeline-bottom">
        <section className="pm-timeline-section"><div className="pm-timeline-section-heading"><div><span className="eyebrow">CALENDARIO</span><h2>{thisMonth}</h2></div></div>
          <div className="pm-month-grid">{WEEK.map((day, index) => <div key={index} className="pm-month-weekday">{day}</div>)}{calendar.map(date => {
            const id = iso(date)
            const daily = scheduled.filter(project => dayIsInProject(project, date))
            const todayId = localISO()
            return <button type="button" key={id} className={`pm-month-cell ${date.getUTCMonth() !== month.getUTCMonth() ? 'outside' : ''} ${chosenDate === id ? 'picked' : ''} ${todayId === id ? 'today' : ''}`} onClick={() => setChosenDate(id)} aria-label={`${readable(date)}, ${daily.length} proyectos`}><strong>{date.getUTCDate()}</strong>{daily.length > 0 && <div className="pm-month-dots"><i/><small>{daily.length}</small></div>}</button>
          })}</div>
        </section>
        <section className="pm-timeline-section pm-day-panel"><span className="eyebrow">DETALLE DIARIO</span><h2>{readable(currentDay)}</h2><p>{dayProjects.length} proyecto{dayProjects.length === 1 ? '' : 's'} con actividad programada</p><div className="pm-timeline-day-list">{dayProjects.length ? dayProjects.map(project => <div key={project.id}><span className="pm-timeline-day-dot" data-status={project.status}/><div><strong>{project.name}</strong><small>{iso(currentDay) === project.start_date ? 'Inicio del proyecto' : iso(currentDay) === project.due_date ? 'Fecha de término' : 'Dentro del periodo previsto'}</small></div></div>) : <p className="pm-timeline-empty-mini">Sin proyectos programados para este día.</p>}</div>
          {undated.length > 0 && <div className="pm-undated"><h3>{undated.length} proyecto{undated.length === 1 ? '' : 's'} sin fechas</h3><p>Agrega inicio y término para mostrar sus barras.</p><button type="button" onClick={onOpenProjects}>Editar proyectos →</button></div>}
        </section>
      </div>
    </>}
    <p className="pm-timeline-footnote">Las barras representan tiempo planificado, no porcentaje de tareas completadas. Las fechas se obtienen de tus proyectos y respetan los permisos de Supabase.</p>
  </section>
}
