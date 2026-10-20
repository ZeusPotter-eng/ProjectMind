import { useCallback, useEffect, useMemo, useState } from 'react'
import { listProjects, listTasks } from '../api/client'
import TaskDetailModal from './TaskDetailModal'
import { taskOccursOn } from '../utils/taskTimeline'
import './timeline.css'

import { asUTC, calendarDays, dayIsInProject, daysBetween, firstOfMonth, iso, localISO, MONTHS, plusDays, projectRange, readable, STATUS, WEEK } from '../utils/timelineDates'

function Gantt({projects, first, months, chosen, onChoose, expanded, onToggle, tasksByProject, onTask}) {
  const end = firstOfMonth(first.getUTCFullYear(), first.getUTCMonth() + months)
  const span = daysBetween(first, end)
  const dayWidth = months === 1 ? 27 : 13
  const pixelWidth = span * dayWidth
  const days = Array.from({length:span},(_,i)=>plusDays(first,i))
  const today=asUTC(localISO()),todayIndex=daysBetween(first,today)
  const segments=Array.from({length:months},(_,i)=>{
    const date=firstOfMonth(first.getUTCFullYear(),first.getUTCMonth()+i)
    const next=firstOfMonth(first.getUTCFullYear(),first.getUTCMonth()+i+1)
    return {label:`${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`,days:daysBetween(date,next)}
  })
  function bar(range,label,status,click,selected=false,percent=0,task=false){
    if(!range)return null
    const offset=Math.max(0,daysBetween(first,range.start))
    const last=Math.min(span,daysBetween(first,range.end)+1)
    if(last<=offset)return null
    return <button type="button" className={`pm-gantt-bar ${task?'pm-gantt-task-bar':''} ${selected?'selected':''}`} data-status={status}
       style={{left:`${offset*dayWidth+2}px`,width:`${Math.max(8,(last-offset)*dayWidth-4)}px`}}
       onClick={click} title={`${label} · ${readable(range.start)} — ${readable(range.end)} · ${range.days} días`}>
      <span className="pm-gantt-elapsed" style={{width:`${Math.max(0,Math.min(100,percent))}%`}}/><span className="pm-gantt-bar-text">{label}</span>
    </button>
  }
  function track(range,label,status,click,selected,percent,task){return <div className="pm-gantt-track" style={{width:`${pixelWidth}px`}}>
    {todayIndex>=0&&todayIndex<span&&<div className="pm-gantt-today" style={{left:`${todayIndex*dayWidth+dayWidth/2}px`}}/>}
    {bar(range,label,status,click,selected,percent,task)}</div>}
  return <div className="pm-gantt-scroll" role="region" aria-label="Cronograma con proyectos y tareas" tabIndex={0}>
    <div className="pm-gantt-table" style={{'--pm-day':`${dayWidth}px`,'--pm-total':`${pixelWidth}px`}}>
      <div className="pm-gantt-label pm-gantt-heading">Proyecto / tareas</div>
      <div className="pm-gantt-months">{segments.map(item=><span key={item.label} style={{width:`${item.days*dayWidth}px`}}>{item.label}</span>)}</div>
      <div className="pm-gantt-label pm-gantt-day-label">Inicio y término</div>
      <div className="pm-gantt-days">{days.map((d,i)=><span key={iso(d)} className={i%7===0?'weekline':''} title={readable(d)}>{months===1||d.getUTCDay()===1||d.getUTCDate()===1?d.getUTCDate():''}</span>)}</div>
      {projects.map(project=>{
        const range=projectRange(project)
        const active=Boolean(expanded[project.id])
        const tasks=tasksByProject[project.id]
        return <div key={project.id} className="pm-gantt-fragment">
          <div className="pm-gantt-label pm-gantt-project"><button type="button" className="pm-gantt-expand" onClick={()=>onToggle(project)} aria-expanded={active} title="Mostrar u ocultar tareas">{active?'▾':'▸'} {project.name}</button><small>{range.days} días · {STATUS[project.status]||project.status}</small></div>
          {track(range,project.name,project.status,()=>onChoose(project),chosen?.id===project.id,Math.round(Math.min(range.days,Math.max(0,daysBetween(range.start,today)+1))/range.days*100),false)}
          {active&&(!tasks?<><div className="pm-gantt-label pm-gantt-task-label">Consultando tareas…</div>{track(null)}</>:tasks.length===0?<><div className="pm-gantt-label pm-gantt-task-label">Sin tareas registradas</div>{track(null)}</>:tasks.map(task=>{
            const taskRange=projectRange(task)
            return <div key={task.id} className="pm-gantt-fragment">
              <div className="pm-gantt-label pm-gantt-task-label"><button type="button" onClick={()=>onTask(project,task)} title="Abrir ficha y evidencias">↳ {task.title}</button><small>{taskRange?`${taskRange.days} días`:'Sin fechas'} · {task.progress||0}%</small></div>
              {track(taskRange,task.title,task.status,()=>onTask(project,task),false,task.progress||0,true)}
            </div>
          }))}
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
  const [expanded,setExpanded]=useState({})
  const [tasksByProject,setTasksByProject]=useState({})
  const [selectedTask,setSelectedTask]=useState(null)

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
  async function toggleProject(project){
    const shouldOpen=!expanded[project.id]
    setExpanded(x=>({...x,[project.id]:shouldOpen}))
    if(!shouldOpen||tasksByProject[project.id])return
    try {
      let items=[],count=0
      do {const page=await listTasks(getAccessToken,project.id,{limit:100,offset:items.length});items.push(...(page.items||[]));count=page.count??items.length;if(!page.items?.length)break} while(items.length<count&&items.length<2000)
      setTasksByProject(x=>({...x,[project.id]:items}))
    } catch(e){setExpanded(x=>({...x,[project.id]:false}));setError(e.message||'No se pudieron cargar tareas.')}
  }
  function refresh(){setTasksByProject({});setExpanded({});load()}


  const scheduled = useMemo(() => projects.filter(projectRange).sort((a, b) => a.start_date.localeCompare(b.start_date)), [projects])
  const undated = useMemo(() => projects.filter(p => !projectRange(p)), [projects])
  const currentDay = asUTC(chosenDate)
  const dayProjects = useMemo(() => scheduled.filter(p => dayIsInProject(p, currentDay)), [scheduled, chosenDate])
  const dayTasks = useMemo(() => scheduled.flatMap(project => (tasksByProject[project.id]||[])
    .filter(task=>taskOccursOn(task,chosenDate)).map(task=>({project,task}))), [scheduled,tasksByProject,chosenDate])
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
    <header className="pm-timeline-intro"><div><span className="eyebrow">PROJECTMIND · PLANIFICACIÓN</span><h1>Calendario y cronograma</h1><p>Visualiza proyectos y tareas en el Gantt. Despliega un proyecto y abre una tarea para consultar su duración, detalles y evidencias.</p></div><button className="pm-timeline-primary" type="button" onClick={onOpenProjects}>Gestionar fechas en Proyectos →</button></header>

    <div className="pm-timeline-stats">
      <article><span>Proyectos visibles</span><strong>{projects.length}</strong><small>Según permisos de tu cuenta</small></article>
      <article><span>Con fechas definidas</span><strong>{scheduled.length}</strong><small>Incluidos en el cronograma</small></article>
      <article><span>Sin cronograma</span><strong>{undated.length}</strong><small>Completa inicio y término</small></article>
    </div>
    <div className="pm-timeline-controls">
      <div className="pm-timeline-switch"><button type="button" className={view === 'month' ? 'selected' : ''} onClick={() => setView('month')}>Mes</button><button type="button" className={view === 'quarter' ? 'selected' : ''} onClick={() => setView('quarter')}>Trimestre</button></div>
      <div className="pm-timeline-period"><button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior">‹</button><strong>{thisMonth}</strong><button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente">›</button><button type="button" onClick={today}>Hoy</button></div>
      <label className="pm-timeline-check"><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)}/> Incluir archivados</label>
      <button type="button" className="pm-timeline-refresh" onClick={refresh} disabled={loading}>↻ Actualizar</button>
    </div>
    {error && <p className="pm-timeline-error" role="alert">{error}</p>}
    {truncated && <p className="pm-timeline-warning">Se muestran los primeros 500 proyectos autorizados. Para un portafolio mayor será necesario ampliar la paginación.</p>}
    {loading ? <div className="pm-timeline-loading">Cargando la planificación…</div> : <>
      <section className="pm-timeline-section">
        <div className="pm-timeline-section-heading"><div><span className="eyebrow">VISTA GANTT</span><h2>Proyectos y tareas · Gantt</h2></div><p><span className="pm-timeline-legend today"/> Hoy <span className="pm-timeline-legend elapsed"/> Tiempo transcurrido</p></div>
        {scheduled.length ? <Gantt projects={scheduled} first={month} months={view === 'month' ? 1 : 3} chosen={chosenProject} onChoose={setChosenProject} expanded={expanded} onToggle={toggleProject} tasksByProject={tasksByProject} onTask={(project,task)=>setSelectedTask({project,task})}/> : <div className="pm-timeline-empty">Todavía no hay proyectos con fecha de inicio y término. Puedes definirlas desde <button type="button" onClick={onOpenProjects}>Proyectos</button>.</div>}
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
          <h3 className="pm-day-task-title">Tareas del día ({dayTasks.length})</h3>
          {dayTasks.length ? <div className="pm-day-task-list">{dayTasks.map(({project,task})=><button type="button" key={task.id} onClick={()=>setSelectedTask({project,task})}><strong>{task.title}</strong><small>{project.name} · {task.progress||0}% completado</small></button>)}</div> : <p className="pm-timeline-empty-mini">Despliega los proyectos del Gantt para cargar sus tareas en el calendario.</p>}
          {undated.length > 0 && <div className="pm-undated"><h3>{undated.length} proyecto{undated.length === 1 ? '' : 's'} sin fechas</h3><p>Agrega inicio y término para mostrar sus barras.</p><button type="button" onClick={onOpenProjects}>Editar proyectos →</button></div>}
        </section>
      </div>
    </>}
    {selectedTask&&<TaskDetailModal key={selectedTask.task.id} project={selectedTask.project} task={selectedTask.task} getAccessToken={getAccessToken} onClose={()=>setSelectedTask(null)}/>}
    <p className="pm-timeline-footnote">Las barras representan duración prevista. Las tareas sin fechas permanecen visibles como filas sin barra. Las evidencias se guardan en almacenamiento privado y requieren autorización.</p>
  </section>
}
