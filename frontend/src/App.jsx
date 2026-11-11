import { useEffect, useMemo, useState } from 'react'
import { getHealth, getSupabaseHealth, getAssistantStatus, sendAssistantMessage } from './api/client'
import CrudConsole from './components/CrudConsole'
import ProjectsWorkspace from './components/ProjectsWorkspace'
import './index.css'

const TEAM = [
  { id: 'jimmy', name: 'Jimmy', initials: 'JI' },
  { id: 'andy', name: 'Andy', initials: 'AN' },
  { id: 'zeus', name: 'Zeus', initials: 'ZE' },
]
const GROUPS = [
  { label: 'ESPACIO DE TRABAJO', items: [['Inicio','⌂'],['Proyectos','▦'],['Tareas','☑'],['Calendario','▤']] },
  { label: 'GESTIÓN DEL PROYECTO', items: [['Requisitos','≡'],['Dependencias','◇'],['Bloqueos y riesgos','⚑'],['Documentos','▧'],['Reuniones','◷']] },
  { label: 'INTELIGENCIA Y CONTROL', items: [['Asistente IA','✧'],['Propuestas IA','✦'],['Reportes','▥'],['Auditoría','◎']] },
  { label: 'ADMINISTRACIÓN', items: [['Consola CRUD','⌘'],['Configuración','⚙']] },
]
const DESCRIPTIONS = {
  Proyectos: 'Organiza iniciativas, equipos, objetivos y entregables desde un mismo lugar.',
  Tareas: 'Consulta prioridades, responsables, fechas y avances. Vistas Kanban y backlog previstas.',
  Calendario: 'Visualiza próximas entregas y la planificación del proyecto. Vista Gantt prevista.',
  Requisitos: 'Documenta necesidades y conserva su trazabilidad.',
  Dependencias: 'Identifica tareas relacionadas y posibles efectos sobre el cronograma.',
  'Bloqueos y riesgos': 'Anticipa impedimentos, evalúa riesgos y da seguimiento a su resolución.',
  Documentos: 'Centraliza evidencias y documentos para enriquecer el contexto del asistente.',
  Reuniones: 'Da seguimiento a acuerdos, minutas y compromisos.',
  'Propuestas IA': 'Revisa y aprueba las recomendaciones antes de aplicar cualquier cambio.',
  Reportes: 'Consulta indicadores, evolución del trabajo y resultados.',
  Auditoría: 'Revisa las acciones y decisiones importantes del proyecto.',
}
const ACTIONS = [
  { title: 'Analizar riesgos', prompt: 'Ayúdame a identificar riesgos comunes de un proyecto de software y cómo evaluarlos.' },
  { title: 'Planificar tareas', prompt: 'Ayúdame a descomponer un objetivo de proyecto en tareas priorizadas.' },
  { title: 'Revisar avances', prompt: '¿Qué información necesitas para evaluar el avance de un proyecto?' },
]
function readPhoto(id) { try { return localStorage.getItem(`projectmind-team-photo-${id}`) || '' } catch { return '' } }
function Status({ value, label }) { return <span className={`status-tag ${value === true ? 'good' : value === false ? 'bad' : ''}`}><span className="status-led"/>{label}</span> }

export default function App() {
  const [page, setPage] = useState('Inicio')
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [conversation, setConversation] = useState([])
  const [sending, setSending] = useState(false)
  const [system, setSystem] = useState({ backend: null, supabase: null, assistant: null, provider: '', human: true })
  const [photos, setPhotos] = useState(() => Object.fromEntries(TEAM.map(m => [m.id, readPhoto(m.id)])))
  const [photoNotice, setPhotoNotice] = useState('')
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('projectmind-theme') || 'dark' } catch { return 'dark' } })
  const [view, setView] = useState('Tablero')
  const [projectSearch, setProjectSearch] = useState('')
  const [toast, setToast] = useState('')
  const allPages = useMemo(() => GROUPS.flatMap(g => g.items.map(item => item[0])), [])
  const results = search.trim() ? allPages.filter(x => x.toLowerCase().includes(search.toLowerCase())) : []
  const navigate = name => { setPage(name); setMenuOpen(false); setSearch(''); setToast(''); window.scrollTo(0,0) }
  useEffect(() => {
    let alive = true
    Promise.allSettled([getHealth(), getSupabaseHealth(), getAssistantStatus()]).then(([backend, supabase, assistant]) => {
      if (!alive) return
      setSystem({
        backend: backend.status === 'fulfilled' ? backend.value.status === 'ok' : false,
        supabase: supabase.status === 'fulfilled' ? Boolean(supabase.value.connected) : false,
        assistant: assistant.status === 'fulfilled' ? Boolean(assistant.value.configured) : false,
        provider: assistant.status === 'fulfilled' ? assistant.value.provider || '' : '',
        human: assistant.status === 'fulfilled' ? assistant.value.human_in_the_loop !== false : true,
      })
    })
    return () => { alive = false }
  }, [])
  useEffect(() => { try { localStorage.setItem('projectmind-theme', theme) } catch { /* optional */ } }, [theme])
  async function send(text = message) {
    const content = text.trim()
    if (!content || sending) return
    setAssistantOpen(true)
    setConversation(c => [...c, { role:'user', content }]); setMessage(''); setSending(true)
    try {
      const result = await sendAssistantMessage(content)
      const answer = result.answer ?? result.response ?? result.message ?? result.content
      setConversation(c => [...c, { role:'assistant', content: typeof answer === 'string' ? answer : 'El servidor respondió, pero no devolvió un texto reconocible. Revisa el contrato del endpoint.' }])
    } catch (error) {
      setConversation(c => [...c, { role:'error', content: `No se pudo consultar el asistente: ${error.message}` }])
    } finally { setSending(false) }
  }
  function uploadPhoto(id, event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) { setPhotoNotice('Selecciona una imagen de máximo 2 MB.'); event.target.value = ''; return }
    const reader = new FileReader()
    reader.onload = () => {
      const data = typeof reader.result === 'string' ? reader.result : ''
      setPhotos(p => ({ ...p, [id]:data }))
      try { localStorage.setItem(`projectmind-team-photo-${id}`, data); setPhotoNotice('Foto guardada en este navegador.') } catch { setPhotoNotice('Foto visible durante esta sesión.') }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const assistantPanel = <section className="assistant-panel" aria-label="Asistente IA">
    <div className="assistant-heading"><div className="agent-icon">✧</div><div><strong>ProjectMind AI</strong><small>Tu copiloto de gestión</small></div><button className="icon-btn" onClick={() => setAssistantOpen(false)} aria-label="Cerrar asistente">✕</button></div>
    <div className="assistant-feed">
      {conversation.length === 0 ? <div className="agent-intro"><div className="agent-mark">✧</div><h3>¿En qué trabajamos hoy?</h3><p>Analiza ideas, estructura tareas y recibe orientación para tus proyectos.</p><div className="suggestions">{ACTIONS.map(a => <button key={a.title} onClick={() => send(a.prompt)}>{a.title} <span>↗</span></button>)}</div></div> : conversation.map((m,i) => <div key={i} className={`chat-bubble ${m.role}`}><small>{m.role === 'user' ? 'Tú' : m.role === 'error' ? 'Error de conexión' : 'ProjectMind AI'}</small><p>{m.content}</p></div>)}
      {sending && <p className="thinking">ProjectMind está preparando una respuesta…</p>}
    </div>
    <form className="assistant-compose" onSubmit={e => { e.preventDefault(); send() }}><label htmlFor="agent-message" className="sr-only">Mensaje para el asistente</label><textarea id="agent-message" rows="2" placeholder="Pregunta algo sobre tu proyecto…" value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}/><div className="compose-footer"><span>Las acciones requieren revisión humana</span><button className="send-btn" type="submit" disabled={!message.trim()||sending} aria-label="Enviar mensaje">↑</button></div></form>
  </section>
  return <div className={`pm-app ${theme === 'light' ? 'light-theme' : ''}`}>
    <aside className={`pm-sidebar ${menuOpen ? 'show' : ''}`}>
      <div className="brand"><div className="brand-logo">✧</div><div><strong>ProjectMind</strong><small>AI WORKSPACE</small></div><button className="mobile-close icon-btn" onClick={()=>setMenuOpen(false)} aria-label="Cerrar menú">✕</button></div>
      <div className="workspace-switch"><span className="workspace-avatar">P</span><div><strong>Mi espacio de trabajo</strong><small>Entorno del proyecto</small></div><span className="workspace-chevron">⌄</span></div>
      <nav className="navigation" aria-label="Navegación principal">{GROUPS.map(group => <div className="nav-section" key={group.label}><p>{group.label}</p>{group.items.map(([name, icon]) => <button key={name} className={`nav-item ${page===name?'selected':''}`} onClick={()=>navigate(name)}><span className="nav-symbol">{icon}</span>{name}{name==='Asistente IA'&&<span className="nav-spark">✦</span>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="mini-system"><span className={`system-dot ${system.backend?'connected':''}`}/><div><strong>{system.backend === null ? 'Comprobando conexión' : system.backend ? 'Backend conectado' : 'Backend desconectado'}</strong><small>Estado del sistema</small></div></div><div className="sidebar-profile"><span className="profile-circle">PM</span><div><strong>Espacio ProjectMind</strong><small>Equipo de desarrollo</small></div><button className="icon-btn" onClick={()=>navigate('Configuración')} aria-label="Configuración">⚙</button></div></div>
    </aside>
    {menuOpen && <button className="menu-backdrop" onClick={()=>setMenuOpen(false)} aria-label="Cerrar navegación"/>}
    <div className="pm-main">
      <header className="pm-topbar"><div className="topbar-left"><button className="icon-btn hamburger" onClick={()=>setMenuOpen(true)} aria-label="Abrir menú">☰</button><span className="breadcrumb">Espacio de trabajo</span><span className="breadcrumb-separator">/</span><strong>{page}</strong></div><div className="topbar-right"><div className="global-search"><span>⌕</span><input aria-label="Buscar módulos" placeholder="Buscar en ProjectMind…" value={search} onChange={e=>setSearch(e.target.value)}/>{results.length>0&&<div className="search-results">{results.map(name=><button key={name} onClick={()=>navigate(name)}>{name}<span>↗</span></button>)}</div>}</div><button className="icon-btn theme-button" title="Cambiar tema" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?'☼':'☾'}</button><button className="top-ai-btn" onClick={()=>setAssistantOpen(true)}>✧ <span>Preguntar a la IA</span></button><span className="top-avatar">PM</span></div></header>
      <main className="page-content">
        {page==='Inicio'&&<>
          <div className="page-title"><div><span className="eyebrow">TU ESPACIO DE TRABAJO</span><h1>Tu trabajo, más claro.<br/><span>Tu equipo, más conectado.</span></h1><p>Un lugar para planificar, colaborar y tomar mejores decisiones con ayuda de IA.</p></div><button className="primary-button" onClick={()=>navigate('Proyectos')}>＋ Ver proyectos</button></div>
          <section className="hero-agent"><div className="hero-glow"/><div className="hero-copy"><span className="hero-eyebrow">✦ TU COPILOTO DE PROYECTOS</span><h2>Menos tiempo organizando.<br/>Más tiempo avanzando.</h2><p>ProjectMind te ayuda a estructurar el trabajo, detectar riesgos y preparar decisiones. Tú mantienes el control.</p><button onClick={()=>setAssistantOpen(true)}>✧ Hablar con ProjectMind <span>↗</span></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-core">✧</div><div className="orbit-label label-one">Planifica</div><div className="orbit-label label-two">Analiza</div><div className="orbit-label label-three">Decide</div></div></section>
          <div className="section-top"><div><h2>Accesos rápidos</h2><p>Continúa tu trabajo sin perder tiempo navegando.</p></div></div>
          <div className="quick-grid"><button onClick={()=>navigate('Proyectos')}><span className="quick-icon purple">▦</span><strong>Mis proyectos</strong><small>Consulta y organiza tu trabajo</small><span className="quick-arrow">↗</span></button><button onClick={()=>navigate('Tareas')}><span className="quick-icon blue">☑</span><strong>Mis tareas</strong><small>Prioridades y seguimiento</small><span className="quick-arrow">↗</span></button><button onClick={()=>navigate('Bloqueos y riesgos')}><span className="quick-icon amber">⚑</span><strong>Riesgos y bloqueos</strong><small>Anticípate a los problemas</small><span className="quick-arrow">↗</span></button><button onClick={()=>navigate('Reportes')}><span className="quick-icon teal">▥</span><strong>Reportes</strong><small>Información para decidir</small><span className="quick-arrow">↗</span></button></div>
          <div className="home-columns"><section className="surface-card overview-card"><div className="card-heading"><div><h2>Tu espacio está listo</h2><p>Comienza con un proyecto o explora las herramientas disponibles.</p></div><span className="neutral-pill">Vista general</span></div><div className="empty-illustration"><span>▤</span></div><h3>Todo comienza con una buena planificación</h3><p>Cuando conectemos las consultas de proyectos y tareas, aquí verás tus actividades y avances reales.</p><button className="text-button" onClick={()=>navigate('Proyectos')}>Explorar proyectos →</button></section><section className="surface-card health-card"><div className="card-heading"><div><h2>Estado de las integraciones</h2><p>Información consultada al backend.</p></div><button className="subtle-button" onClick={()=>navigate('Configuración')}>Detalles ↗</button></div><div className="health-row"><span className="health-icon">⌘</span><div><strong>API FastAPI</strong><small>Servicios de ProjectMind</small></div><Status value={system.backend} label={system.backend===null?'Comprobando':system.backend?'Conectado':'Sin conexión'}/></div><div className="health-row"><span className="health-icon">▤</span><div><strong>Supabase</strong><small>Base de datos del proyecto</small></div><Status value={system.supabase} label={system.supabase===null?'Comprobando':system.supabase?'Conectado':'Pendiente'}/></div><div className="health-row"><span className="health-icon">✧</span><div><strong>Asistente IA</strong><small>{system.provider||'Proveedor por configurar'}</small></div><Status value={system.assistant} label={system.assistant===null?'Comprobando':system.assistant?'Configurado':'Pendiente'}/></div><div className="human-note">♧ Las sugerencias de IA requieren aprobación humana.</div></section></div>
        </>}
        {page==='Proyectos'&&<ProjectsWorkspace onAskAI={prompt => send(prompt)}/>}
        {page==='Asistente IA'&&<div className="full-agent-page"><div className="page-title compact"><div><span className="eyebrow">INTELIGENCIA ARTIFICIAL</span><h1>Asistente ProjectMind</h1><p>Tu espacio para analizar, planificar y resolver dudas de gestión.</p></div></div>{assistantPanel}</div>}
        {page==='Consola CRUD'&&<><div className="page-title compact"><div><span className="eyebrow">ADMINISTRACIÓN · VERIFICACIÓN</span><h1>Consola CRUD</h1><p>Herramienta técnica de verificación. Las operaciones requieren permisos y configuración del backend.</p></div></div><section className="surface-card crud-container"><CrudConsole/></section></>}
        {page==='Configuración'&&<><div className="page-title compact"><div><span className="eyebrow">PREFERENCIAS</span><h1>Configuración</h1><p>Personaliza tu experiencia y consulta el estado de los servicios.</p></div></div><div className="settings-layout"><section className="surface-card settings-section"><h2>Apariencia</h2><p>Elige cómo quieres visualizar ProjectMind.</p><div className="theme-options"><button className={theme==='dark'?'chosen':''} onClick={()=>setTheme('dark')}>☾ Oscuro</button><button className={theme==='light'?'chosen':''} onClick={()=>setTheme('light')}>☼ Claro</button></div></section><section className="surface-card settings-section"><h2>Conexiones</h2><div className="health-row"><strong>FastAPI</strong><Status value={system.backend} label={system.backend?'Conectado':'No disponible'}/></div><div className="health-row"><strong>Supabase</strong><Status value={system.supabase} label={system.supabase?'Conectado':'Pendiente'}/></div><div className="health-row"><strong>Asistente IA</strong><Status value={system.assistant} label={system.assistant?'Configurado':'Pendiente'}/></div><div className="human-note">Revisión humana: {system.human?'habilitada':'no confirmada'}</div></section><section className="surface-card settings-section team-section"><h2>Equipo ProjectMind</h2><p>Las fotografías se guardan únicamente en este navegador.</p>{TEAM.map(member=><div className="member-row" key={member.id}><span className="member-photo">{photos[member.id]?<img src={photos[member.id]} alt={`Foto de ${member.name}`}/>:member.initials}</span><div><strong>{member.name}</strong><small>Integrante de ProjectMind</small></div><label className="subtle-button">Cambiar foto<input type="file" accept="image/*" onChange={e=>uploadPhoto(member.id,e)} hidden/></label>{photos[member.id]&&<button className="icon-btn" aria-label={`Eliminar foto de ${member.name}`} onClick={()=>{setPhotos(p=>({...p,[member.id]:''}));try{localStorage.removeItem(`projectmind-team-photo-${member.id}`)}catch{/*optional*/}}}>✕</button>}</div>)}{photoNotice&&<p role="status">{photoNotice}</p>}</section></div></>}
        {!['Inicio','Proyectos','Asistente IA','Consola CRUD','Configuración'].includes(page)&&<><div className="page-title compact"><div><span className="eyebrow">ESPACIO DE TRABAJO / {page.toUpperCase()}</span><h1>{page}</h1><p>{DESCRIPTIONS[page]}</p></div><button className="outline-button" onClick={()=>setAssistantOpen(true)}>✧ Consultar a la IA</button></div>{['Proyectos','Tareas','Calendario'].includes(page)&&<div className="view-toolbar"><div className="view-tabs">{(page==='Proyectos'?['Todos','Recientes']:page==='Tareas'?['Tablero','Lista','Backlog']:['Calendario','Gantt']).map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v}</button>)}</div><div className="toolbar-right"><input placeholder={`Buscar ${page.toLowerCase()}…`} value={projectSearch} onChange={e=>setProjectSearch(e.target.value)} aria-label={`Buscar ${page.toLowerCase()}`}/><button className="primary-button" onClick={()=>setToast('La creación estará disponible al conectar este módulo con su API. No se guardó ningún cambio.')}>＋ Nuevo</button></div></div>}{toast&&<div className="inline-notice" role="status">{toast}</div>}<section className="surface-card module-placeholder"><div className="placeholder-symbol">{page==='Proyectos'?'▦':page==='Tareas'?'☑':page==='Calendario'?'▤':'◇'}</div><span className="eyebrow">INTERFAZ PREPARADA</span><h2>{page==='Proyectos'?'Tus proyectos, en un solo lugar':page==='Tareas'?'Cada tarea, bajo control':page==='Calendario'?'Planifica con claridad':`Gestiona ${page.toLowerCase()} con inteligencia`}</h2><p>Esta sección está preparada visualmente. Para mostrar y modificar datos reales, falta conectar los endpoints correspondientes. No se muestran proyectos ni indicadores inventados.</p><div className="placeholder-actions"><button className="primary-button" onClick={()=>setAssistantOpen(true)}>✧ Pedir ayuda a la IA</button><button className="outline-button" onClick={()=>navigate('Inicio')}>Volver al inicio</button></div></section></>}
      </main>
    </div>
    {assistantOpen&&page!=='Asistente IA'&&<><button className="assistant-backdrop" onClick={()=>setAssistantOpen(false)} aria-label="Cerrar panel de IA"/>{assistantPanel}</>}
  </div>
}
