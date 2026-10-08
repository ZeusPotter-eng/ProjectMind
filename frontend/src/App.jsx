import { useEffect, useMemo, useState } from 'react'
import { getHealth, getSupabaseHealth, getAssistantStatus } from './api/client'
import CrudConsole from './components/CrudConsole'

const TEAM_MEMBERS = [
  { id: 'jimmy', name: 'Jimmy', role: 'Desarrollador de ProjectMind', initials: 'JI' },
  { id: 'andy', name: 'Andy', role: 'Desarrollador de ProjectMind', initials: 'AN' },
  { id: 'zeus', name: 'Zeus', role: 'Desarrollador de ProjectMind', initials: 'ZE' },
]

const MODULES = [
  ['Dashboard', 'Resumen de proyectos, pendientes, bloqueos y alertas.', '◆'],
  ['Proyectos', 'Creación, consulta, administración e integrantes.', '◆'],
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
  { label: 'Principal', items: ['Dashboard', 'Proyectos', 'Tareas', 'Requisitos'] },
  { label: 'Gestión', items: ['Dependencias', 'Bloqueos', 'Documentos', 'Reuniones'] },
  { label: 'Inteligencia', items: ['Asistente IA', 'Propuestas IA'] },
  { label: 'Análisis', items: ['Reportes', 'Auditoría'] },
  { label: 'Administración', items: ['Consola CRUD'] },
]

const MAX_IMAGE_SIZE = 2 * 1024 * 1024

function getStoredPhoto(memberId) {
  try { return localStorage.getItem(`projectmind-team-photo-${memberId}`) || '' } catch { return '' }
}

function App() {
  const [activeModule, setActiveModule] = useState('Dashboard')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [backendStatus, setBackendStatus] = useState({ loading: true, connected: false, message: 'Comprobando conexión con FastAPI...' })
  const [assistantStatus, setAssistantStatus] = useState({ loading: true, provider: '', configured: false, humanInTheLoop: true })
  const [supabaseStatus, setSupabaseStatus] = useState({ loading: true, connected: false, message: 'Comprobando conexión con Supabase...' })
  const [memberPhotos, setMemberPhotos] = useState(() => TEAM_MEMBERS.reduce((photos, member) => ({ ...photos, [member.id]: getStoredPhoto(member.id) }), {}))
  const [photoMessages, setPhotoMessages] = useState({})

  const moduleMap = useMemo(() => Object.fromEntries(MODULES.map((item) => [item[0], item])), [])

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

  function navigate(name) { setActiveModule(name); setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

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
        <article><span>12</span><p>Módulos definidos</p><small>Estructura del MVP</small></article>
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
    return <section className="content-card settings-page"><span className="eyebrow">SISTEMA</span><h1>Configuración</h1><p>Estado de las integraciones principales contempladas para ProjectMind.</p><div className="settings-grid"><article><span>01</span><h3>Supabase / PostgreSQL</h3><p>{supabaseStatus.loading ? 'Verificando conexión...' : supabaseStatus.message}</p></article><article><span>02</span><h3>OpenAI / LM Studio</h3><p>Proveedor actual: <strong>{assistantStatus.provider || 'No disponible'}</strong></p></article><article><span>03</span><h3>Human-in-the-Loop</h3><p>{assistantStatus.humanInTheLoop ? 'Revisión humana habilitada.' : 'Revisión pendiente.'}</p></article><article><span>04</span><h3>RAG</h3><p>Recuperación de información desde documentos y contexto del proyecto.</p></article></div></section>
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
      <div className="brand"><span>PM</span><div><strong>ProjectMind</strong><small>Project Management AI</small></div></div>
      <nav>{NAV_GROUPS.map((group)=><div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((name)=><button key={name} className={activeModule===name?'active':''} onClick={()=>navigate(name)}><span>{moduleMap[name]?.[2]}</span>{name}</button>)}</div>)}</nav>
      <div className="sidebar-footer"><button className={activeModule==='Configuración'?'active':''} onClick={()=>navigate('Configuración')}><span>◆</span>Configuración</button><div className={backendClass}><span className="status-dot"/><small>{backendStatus.connected?'Sistema conectado':'Conexión pendiente'}</small></div></div>
    </aside>
    {mobileMenuOpen && <button className="sidebar-overlay" aria-label="Cerrar menú" onClick={()=>setMobileMenuOpen(false)}/>} 
    <div className="main-shell">
      <header className="topbar"><button className="menu-button" onClick={()=>setMobileMenuOpen(true)}>◆</button><div><small>ProjectMind /</small><strong>{activeModule}</strong></div><div className="topbar-actions"><span className={backendClass}><span className="status-dot"/>{backendStatus.connected?'Online':'Offline'}</span><div className="user-avatar">PM</div></div></header>
      <main className="workspace">{activeModule==='Dashboard' ? <Dashboard/> : activeModule==='Configuración' ? <SettingsPage/> : activeModule==='Consola CRUD' ? <CrudPage/> : <ModulePage/>}</main>
    </div>
  </div>
}

export default App
