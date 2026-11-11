import { useEffect, useMemo, useState } from 'react'
import { getHealth, getSupabaseHealth, getAssistantStatus } from './api/client'
import AssistantChatPanel from './components/AssistantChatPanel'
import useAssistantConversation from './hooks/useAssistantConversation'
import CrudConsole from './components/CrudConsole'
import ProjectsPage from './components/ProjectsPage'
import TimelinePage from './components/TimelinePage'
import TasksPage from './components/TasksPage'
import BlockersPage from './components/BlockersPage'
import IntelligencePage from './components/IntelligencePage'
import ProfilePage from './components/ProfilePage'
import AvatarImage from './components/AvatarImage'

const TEAM_MEMBERS = [
  { id: 'jimmy', name: 'Jimmy', role: 'Desarrollador de ProjectMind', initials: 'JI' },
  { id: 'andy', name: 'Andy', role: 'Desarrollador de ProjectMind', initials: 'AN' },
  { id: 'zeus', name: 'Zeus', role: 'Desarrollador de ProjectMind', initials: 'ZE' },
]

const MODULES = [
  ['Dashboard', 'Resumen de proyectos, pendientes, bloqueos y alertas.', '◆'],
  ['Proyectos', 'Creación, consulta, administración e integrantes.', '◆'],
  ['Cronograma', 'Calendario y barras de duración de proyectos (Gantt).', '▥'],
  ['Tareas', 'Estados, responsables, fechas y seguimiento de avance.', '◆'],
  ['Requisitos', 'Registro, revisión y trazabilidad de requisitos.', '◆'],
  ['Dependencias', 'Relaciones entre tareas y análisis de afectaciones.', '◆'],
  ['Bloqueos', 'Registro y resolución de impedimentos.', '!'],
  ['Documentos', 'Carga, procesamiento y recuperación mediante RAG.', '◆'],
  ['Asistente IA', 'Chat contextual especializado en gestión de proyectos.', '◆'],
  ['Reuniones', 'Audio, transcripción, minutas y elementos de seguimiento.', '◆'],
  ['Propuestas IA', 'Aceptar, modificar o rechazar sugerencias generadas.', '◆'],
  ['Reportes', 'Estado general, progreso, riesgos y resultados.', '◆'],
  ['Auditoría', 'Trazabilidad de acciones relevantes dentro del sistema.', '◆'],
]

const NAV_GROUPS = [
  { label: 'Principal', items: ['Dashboard', 'Proyectos', 'Cronograma', 'Tareas', 'Requisitos'] },
  { label: 'Gestión', items: ['Dependencias', 'Bloqueos', 'Documentos', 'Reuniones'] },
  { label: 'Inteligencia', items: ['Asistente IA', 'Propuestas IA'] },
  { label: 'Análisis', items: ['Reportes', 'Auditoría'] },
  { label: 'Administración', items: ['Consola CRUD'] },
  { label: 'Cuenta', items: ['Mi perfil'] },
]

const MAX_IMAGE_SIZE = 2 * 1024 * 1024

function getStoredPhoto(memberId) {
  try { return localStorage.getItem(`projectmind-team-photo-${memberId}`) || '' } catch { return '' }
}

function App({ getAccessToken, currentUser, onProfileUpdated, sessionInfo }) {
  const [activeModule, setActiveModule] = useState('Dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('projectmind-theme') || 'dark' } catch { return 'dark' } })
  const [search, setSearch] = useState('')
  const [assistantFloatingOpen, setAssistantFloatingOpen] = useState(false)
  const assistantChat = useAssistantConversation(getAccessToken)
  const [backendStatus, setBackendStatus] = useState({ loading: true, connected: false, message: 'Comprobando conexión con FastAPI...' })
  const [assistantStatus, setAssistantStatus] = useState({ loading: true, provider: '', configured: false, humanInTheLoop: true })
  const [supabaseStatus, setSupabaseStatus] = useState({ loading: true, connected: false, message: 'Comprobando conexión con Supabase...' })
  const [memberPhotos, setMemberPhotos] = useState(() => TEAM_MEMBERS.reduce((photos, member) => ({ ...photos, [member.id]: getStoredPhoto(member.id) }), {}))
  const [photoMessages, setPhotoMessages] = useState({})

  useEffect(() => { try { localStorage.setItem('projectmind-theme', theme) } catch {} }, [theme])

  const moduleMap = useMemo(() => Object.fromEntries([...MODULES, ['Mi perfil', 'Tu identidad profesional y estadísticas de sesión.', '◉']].map((item) => [item[0], item])), [])

  useEffect(() => {
    const openProfile = () => navigate('Mi perfil')
    window.addEventListener('projectmind:open-profile', openProfile)
    return () => window.removeEventListener('projectmind:open-profile', openProfile)
  }, [])

  useEffect(() => {
    let active = true
    async function checkSystem() {
      const [healthResult, supabaseResult, assistantResult] = await Promise.allSettled([getHealth(), getSupabaseHealth(), getAssistantStatus()])
      if (!active) return
      if (healthResult.status === 'fulfilled') {
        setBackendStatus({ loading: false, connected: healthResult.value.status === 'ok', message: healthResult.value.status === 'ok' ? 'Frontend y backend están conectados correctamente.' : 'FastAPI respondió con un estado inesperado.' })
      } else {
        setBackendStatus({ loading: false, connected: false, message: 'No fue posible conectar con FastAPI. Verifica la URL del backend.' })
      }
      if (supabaseResult.status === 'fulfilled') {
        const connected = Boolean(supabaseResult.value.connected)
        setSupabaseStatus({ loading: false, connected, message: connected ? 'FastAPI y Supabase están conectados correctamente.' : 'Supabase respondió sin confirmar la conexión.' })
      } else {
        setSupabaseStatus({ loading: false, connected: false, message: 'No fue posible verificar Supabase desde FastAPI.' })
      }
      if (assistantResult.status === 'fulfilled') {
        const data = assistantResult.value
        setAssistantStatus({ loading: false, provider: data.provider || '', configured: Boolean(data.configured), humanInTheLoop: data.human_in_the_loop !== false })
      } else {
        setAssistantStatus({ loading: false, provider: '', configured: false, humanInTheLoop: true })
      }
    }
    checkSystem()
    return () => { active = false }
  }, [])

  function handlePhotoChange(memberId, event) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoMessages((messages) => ({ ...messages, [memberId]: 'Selecciona un archivo de imagen válido.' })); event.target.value = ''; return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setPhotoMessages((messages) => ({ ...messages, [memberId]: 'La imagen debe pesar máximo 2 MB.' })); event.target.value = ''; return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const photo = typeof reader.result === 'string' ? reader.result : ''
      setMemberPhotos((photos) => ({ ...photos, [memberId]: photo }))
      setPhotoMessages((messages) => ({ ...messages, [memberId]: 'Foto actualizada correctamente.' }))
      try { localStorage.setItem(`projectmind-team-photo-${memberId}`, photo) } catch { setPhotoMessages((messages) => ({ ...messages, [memberId]: 'La foto se mostrará durante esta sesión.' })) }
    }
    reader.readAsDataURL(file); event.target.value = ''
  }

  function removePhoto(memberId) {
    setMemberPhotos((photos) => ({ ...photos, [memberId]: '' }))
    setPhotoMessages((messages) => ({ ...messages, [memberId]: 'Foto eliminada.' }))
    try { localStorage.removeItem(`projectmind-team-photo-${memberId}`) } catch { /* localStorage opcional */ }
  }

  function navigate(name) { setActiveModule(name); setMobileMenuOpen(false); setAssistantFloatingOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  function openAssistant() {
    if (activeModule === 'Asistente IA') {
      document.getElementById('pm-ai-message-page')?.focus()
    } else {
      setAssistantFloatingOpen(true)
    }
  }

  function renderAssistantChat(mode) {
    return <AssistantChatPanel
      mode={mode}
      messages={assistantChat.messages}
      draft={assistantChat.draft}
      onDraftChange={assistantChat.setDraft}
      sending={assistantChat.sending}
      onSend={assistantChat.send}
      onClear={assistantChat.clear}
      onClose={mode === 'floating' ? () => setAssistantFloatingOpen(false) : undefined}
      onOpenFullPage={() => navigate('Asistente IA')}
      projects={assistantChat.projects}
      projectId={assistantChat.projectId}
      onProjectChange={assistantChat.setProjectId}
      loadingProjects={assistantChat.loadingProjects}
      projectsError={assistantChat.projectsError}
      provider={assistantStatus.provider}
      providerConfigured={assistantStatus.configured}
    />
  }

  function renderAssistantPage() {
    return <section className="pm-ai-workspace">
      <div className="pm-ai-workspace__heading">
        <div><span className="eyebrow">INTELIGENCIA ARTIFICIAL · ASISTENTE</span><h1>Habla con ProjectMind AI</h1><p>Conversa con el modelo conectado al backend. Para generar propuestas que modifiquen tareas o fechas, utiliza el módulo Propuestas IA y su proceso de aprobación.</p></div>
        <button type="button" onClick={() => navigate('Propuestas IA')}>Ver propuestas IA ↗</button>
      </div>
      {renderAssistantChat('page')}
    </section>
  }

  const backendClass = backendStatus.loading ? 'connection-pill loading' : backendStatus.connected ? 'connection-pill online' : 'connection-pill offline'
  const current = moduleMap[activeModule]

  function Dashboard() {
    return <>
      <section className="welcome-panel">
        <div>
          <span className="eyebrow">PROJECTMIND ┬À MVP</span>
          <h1>Gestión inteligente de <span>proyectos.</span></h1>
          <p>Organiza proyectos, tareas, requisitos, documentos y reuniones con una capa de inteligencia artificial diseñada para apoyar decisiones.</p>
          <div className={backendClass}><span className="status-dot"/><div><strong>{backendStatus.loading ? 'Verificando backend' : backendStatus.connected ? 'Backend conectado' : 'Backend sin conexión'}</strong><small>{backendStatus.message}</small></div></div>
        </div>
        <div className="architecture-card"><span>ARQUITECTURA BASE</span><strong>React + FastAPI</strong><p>Supabase ┬À PostgreSQL ┬À pgvector ┬À RAG ┬À OpenAI ┬À LM Studio</p><div className="architecture-orb">PM</div></div>
      </section>

      <section className="stats-grid">
        <article><span>{MODULES.length}</span><p>Módulos definidos</p><small>Estructura del MVP</small></article>
        <article><span>3</span><p>Integrantes</p><small>Equipo ProjectMind</small></article>
        <article><span>{backendStatus.connected ? 'ON' : 'OFF'}</span><p>Backend</p><small>FastAPI</small></article>
        <article><span>{assistantStatus.configured ? 'ON' : '◆'}</span><p>Asistente IA</p><small>{assistantStatus.provider || 'Por configurar'}</small></article>
      </section>

      <section className="content-card">
        <div className="section-heading"><div><span className="eyebrow">ESTRUCTURA DEL MVP</span><h2>Módulos de ProjectMind</h2></div><p>Accede a cada área sin perder la estructura funcional ya definida.</p></div>
        <div className="module-grid">{MODULES.map(([name, description, icon]) => <button className="module-card" key={name} onClick={() => navigate(name)}><span className="module-icon">{icon}</span><div><h3>{name}</h3><p>{description}</p></div><span className="module-arrow">◆</span></button>)}</div>
      </section>

      <section className="dashboard-bottom">
        <div className="content-card integrations"><div className="section-heading"><div><span className="eyebrow">INTEGRACIONES</span><h2>Configuración del sistema</h2></div></div><div className="integration-list">
          <div><span>01</span><div><strong>Supabase / PostgreSQL</strong><p>{supabaseStatus.loading ? 'Verificando conexión...' : supabaseStatus.message}</p></div><b className={supabaseStatus.connected ? 'state ok' : 'state pending'}>{supabaseStatus.connected ? 'Conectado' : 'Pendiente'}</b></div>
          <div><span>02</span><div><strong>OpenAI / LM Studio</strong><p>{assistantStatus.loading ? 'Consultando configuración...' : `Proveedor: ${assistantStatus.provider || 'No disponible'}`}</p></div><b className={assistantStatus.configured ? 'state ok' : 'state pending'}>{assistantStatus.configured ? 'Configurado' : 'Pendiente'}</b></div>
          <div><span>03</span><div><strong>Human-in-the-Loop</strong><p>Revisión humana antes de decisiones oficiales.</p></div><b className="state ok">{assistantStatus.humanInTheLoop ? 'Activo' : 'Pendiente'}</b></div>
          <div><span>04</span><div><strong>RAG</strong><p>Contexto documental para enriquecer respuestas.</p></div></div>
        </div></div>

        <div className="content-card team-card"><div className="section-heading"><div><span className="eyebrow">EQUIPO</span><h2>Integrantes</h2></div></div><div className="team-list">{TEAM_MEMBERS.map((member) => { const photo=memberPhotos[member.id]; const inputId=`photo-${member.id}`; return <div className="member-row" key={member.id}><div className="member-photo">{photo ? <img src={photo} alt={`Foto de ${member.name}`}/> : <span>{member.initials}</span>}</div><div className="member-info"><strong>{member.name}</strong><small>{member.role}</small>{photoMessages[member.id] && <em>{photoMessages[member.id]}</em>}</div><div className="member-actions"><input id={inputId} className="photo-input" type="file" accept="image/*" onChange={(e)=>handlePhotoChange(member.id,e)}/><label htmlFor={inputId}>{photo ? 'Cambiar' : 'Foto'}</label>{photo && <button onClick={()=>removePhoto(member.id)}>×</button>}</div></div>})}</div></div>
      </section>
    </>
  }

  function CrudPage() {
    return <section className="content-card crud-page">
      <span className="eyebrow">CRUD · VERIFICACIÓN</span>
      <h1>Consola de base de datos</h1>
      <p>Consulta y verifica las operaciones de creación, lectura, actualización y eliminación del MVP. Esta consola requiere la configuración y autorización del backend.</p>
      <CrudConsole />
    </section>
  }

  function ModulePage() {
    return <section className="content-card module-page"><div className="module-page-icon">{current?.[2]}</div><span className="eyebrow">MÓDULO PROJECTMIND</span><h1>{activeModule}</h1><p>{current?.[1]}</p><div className="empty-state"><span>PRÓXIMA ETAPA</span><h2>Interfaz preparada para integración funcional</h2><p>Este módulo conserva su lugar dentro de la arquitectura del MVP. La navegación y el diseño base ya están listos para conectar sus endpoints y funcionalidades conforme avance el desarrollo.</p><button onClick={()=>navigate('Dashboard')}>◆ Volver al Dashboard</button></div></section>
  }

  function SettingsPage() {
    return <section className="content-card settings-page"><span className="eyebrow">SISTEMA</span><h1>Configuración</h1><p>Estado de las integraciones principales contempladas para ProjectMind.</p><div className="settings-grid"><article><span>01</span><h3>Supabase / PostgreSQL</h3><p>{supabaseStatus.loading ? 'Verificando conexión...' : supabaseStatus.message}</p></article><article><span>02</span><h3>OpenAI / LM Studio</h3><p>Proveedor actual: <strong>{assistantStatus.provider || 'No disponible'}</strong></p></article><article><span>03</span><h3>Human-in-the-Loop</h3><p>{assistantStatus.humanInTheLoop ? 'Revisión humana habilitada.' : 'Revisión pendiente.'}</p></article><article><span>04</span><h3>RAG</h3><p>Recuperación de información desde documentos y contexto del proyecto.</p></article><article><span>05</span><h3>Sesión de usuario</h3><p>Sesión activa hasta 24 horas desde el último inicio de sesión, sin contador visible. <button type="button" className="pm-settings-link" onClick={() => navigate('Mi perfil')}>Consultar actividad y promedio →</button></p></article></div></section>
  }

  const allModules = NAV_GROUPS.flatMap(group => group.items)
  const searchResults = search.trim() ? allModules.filter(name => name.toLowerCase().includes(search.trim().toLowerCase())) : []
  const icons = { Dashboard: '⌂', Proyectos: '▣', Cronograma: '▤', Tareas: '☑', Requisitos: '≡', Dependencias: '◇', Bloqueos: '⚑', Documentos: '▤', Reuniones: '◷', 'Asistente IA': '✧', 'Propuestas IA': '✦', Reportes: '▥', Auditoría: '◈', 'Consola CRUD': '⌘', 'Mi perfil': '◉' }
  const renderModule = () => activeModule === 'Dashboard' ? <DashboardModern /> : activeModule === 'Configuración' ? <SettingsPage /> : activeModule === 'Consola CRUD' ? <CrudPage /> : (activeModule === 'Tareas' || activeModule === 'Dependencias') ? <TasksPage key={activeModule} currentUserId={currentUser?.id} getAccessToken={getAccessToken} focusDependencies={activeModule === 'Dependencias'} /> : activeModule === 'Bloqueos' ? <BlockersPage getAccessToken={getAccessToken} /> : activeModule === 'Asistente IA' ? renderAssistantPage() : activeModule === 'Propuestas IA' ? <IntelligencePage getAccessToken={getAccessToken} currentUserId={currentUser?.id} /> : activeModule === 'Proyectos' ? <ProjectsPage getAccessToken={getAccessToken} currentUserId={currentUser?.id} onShowTimeline={() => navigate('Cronograma')} /> : activeModule === 'Cronograma' ? <TimelinePage getAccessToken={getAccessToken} onOpenProjects={() => navigate('Proyectos')} /> : activeModule === 'Mi perfil' ? <ProfilePage getAccessToken={getAccessToken} currentUser={currentUser} onProfileUpdated={onProfileUpdated} sessionInfo={sessionInfo} onShowProjects={() => navigate('Proyectos')} /> : <ModulePage />

  function DashboardModern() {
    return <>
      <div className="page-title"><div><span className="eyebrow">TU ESPACIO DE TRABAJO</span><h1>Tu trabajo, más claro.<span> Tu equipo, más conectado.</span></h1><p>Planifica, colabora y toma decisiones con el apoyo de ProjectMind.</p></div><button className="primary-button" onClick={() => navigate('Proyectos')}>Ver proyectos →</button></div>
      <section className="hero-agent"><div className="hero-glow"/><div className="hero-copy"><span className="hero-eyebrow">✦ PROJECTMIND AI</span><h2>Menos tiempo organizando.<br/>Más tiempo avanzando.</h2><p>Conserva el control de tus proyectos, tareas, dependencias y decisiones.</p><button onClick={() => navigate('Asistente IA')}>✧ Abrir asistente IA →</button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-core">✦</div><div className="orbit-label label-one">Planifica</div><div className="orbit-label label-two">Analiza</div><div className="orbit-label label-three">Decide</div></div></section>
      <div className="section-top"><div><h2>Accesos rápidos</h2><p>Continúa donde lo dejaste.</p></div></div>
      <div className="quick-grid">{[['Proyectos','▣','purple','Mis proyectos'],['Tareas','☑','blue','Mis tareas'],['Bloqueos','⚑','amber','Bloqueos'],['Cronograma','▤','teal','Cronograma']].map(([name,icon,color,label])=><button key={name} onClick={() => navigate(name)}><span className={`quick-icon ${color}`}>{icon}</span><strong>{label}</strong><small>Acceder al módulo</small><span className="quick-arrow">↗</span></button>)}</div>
      <section className="surface-card health-card"><div className="card-heading"><div><h2>Estado de las integraciones</h2><p>Información consultada al backend.</p></div></div><div className="health-row"><span className="health-icon">⌘</span><div><strong>API FastAPI</strong><small>{backendStatus.message}</small></div><span className={`pm-health-label ${backendStatus.connected ? 'ok' : ''}`}>{backendStatus.loading ? 'Verificando' : backendStatus.connected ? 'Conectado' : 'No disponible'}</span></div><div className="health-row"><span className="health-icon">▤</span><div><strong>Supabase</strong><small>{supabaseStatus.message}</small></div><span className={`pm-health-label ${supabaseStatus.connected ? 'ok' : ''}`}>{supabaseStatus.loading ? 'Verificando' : supabaseStatus.connected ? 'Conectado' : 'No disponible'}</span></div><div className="health-row"><span className="health-icon">✦</span><div><strong>Inteligencia artificial</strong><small>{assistantStatus.provider || 'Proveedor sin confirmar'}</small></div><span className={`pm-health-label ${assistantStatus.configured ? 'ok' : ''}`}>{assistantStatus.loading ? 'Verificando' : assistantStatus.configured ? 'Configurado' : 'Pendiente'}</span></div><p className="human-note">Las propuestas de IA requieren la revisión y autorización correspondiente.</p></section>
    </>
  }

  return <div className={`pm-app pm-functional ${theme === 'light' ? 'light-theme' : ''}`}>
    <aside className={`pm-sidebar ${mobileMenuOpen ? 'show' : ''}`}>
      <div className="brand"><div className="brand-logo">✦</div><div><strong>ProjectMind</strong><small>AI WORKSPACE</small></div><button className="mobile-close icon-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú">×</button></div>
      <div className="workspace-switch"><span className="workspace-avatar">P</span><div><strong>Mi espacio de trabajo</strong><small>Entorno del proyecto</small></div></div>
      <nav className="navigation" aria-label="Navegación principal">{NAV_GROUPS.map(group => <div className="nav-section" key={group.label}><p>{group.label}</p>{group.items.map(name => <button key={name} className={`nav-item ${activeModule === name ? 'selected' : ''}`} onClick={() => navigate(name)}><span className="nav-symbol">{icons[name] || '◇'}</span>{name}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="mini-system"><span className={`system-dot ${backendStatus.connected ? 'connected' : ''}`}/><div><strong>{backendStatus.loading ? 'Verificando conexión' : backendStatus.connected ? 'Backend conectado' : 'Backend desconectado'}</strong><small>Estado del sistema</small></div></div><button className="pm-sidebar-account" onClick={() => navigate('Mi perfil')}><span className="profile-circle"><AvatarImage userId={currentUser?.id} name={currentUser?.profile_name || currentUser?.email} avatarPath={currentUser?.profile_avatar} getAccessToken={getAccessToken}/></span><span><strong>{currentUser?.profile_name || currentUser?.email || 'Mi perfil'}</strong><small>Ver perfil</small></span></button><button className="pm-sidebar-settings" onClick={() => navigate('Configuración')}>⚙ Configuración</button></div>
    </aside>
    {mobileMenuOpen && <button className="menu-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar navegación"/>}
    <div className="pm-main">
      <header className="pm-topbar"><div className="topbar-left"><button className="icon-btn hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menú">☰</button><span className="breadcrumb">Espacio de trabajo</span><span className="breadcrumb-separator">/</span><strong>{activeModule}</strong></div><div className="topbar-right"><div className="global-search"><span>⌕</span><input aria-label="Buscar módulos" placeholder="Buscar en ProjectMind…" value={search} onChange={e => setSearch(e.target.value)}/>{searchResults.length > 0 && <div className="search-results">{searchResults.map(name => <button key={name} onClick={() => { navigate(name); setSearch('') }}>{name}</button>)}</div>}</div><button className="icon-btn theme-button" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Cambiar tema">{theme === 'dark' ? '☼' : '☾'}</button><button className="top-ai-btn" onClick={openAssistant}>✦ <span>Preguntar a la IA</span></button><button className="pm-avatar-button" onClick={() => navigate('Mi perfil')} title="Mi perfil" aria-label="Abrir mi perfil"><AvatarImage userId={currentUser?.id} name={currentUser?.profile_name || currentUser?.email} avatarPath={currentUser?.profile_avatar} getAccessToken={getAccessToken}/></button></div></header>
      <main className="page-content"><div className="pm-module-content">{renderModule()}</div></main>
    </div>
    {assistantFloatingOpen && activeModule !== 'Asistente IA' && renderAssistantChat('floating')}
  </div>
}

export default App
