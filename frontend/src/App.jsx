import { useEffect, useState } from 'react'
import { getHealth, getAssistantStatus } from './api/client'
import CrudConsole from './components/CrudConsole'

const TEAM_MEMBERS = [
  {
    id: 'jimmy',
    name: 'Jimmy',
    role: 'Desarrollador de ProjectMind',
    initials: 'JI',
  },
  {
    id: 'andy',
    name: 'Andy',
    role: 'Desarrollador de ProjectMind',
    initials: 'AN',
  },
  {
    id: 'zeus',
    name: 'Zeus',
    role: 'Desarrollador de ProjectMind',
    initials: 'ZE',
  },
]

const MODULES = [
  ['Dashboard', 'Resumen de proyectos, pendientes, bloqueos y alertas.'],
  ['Proyectos', 'Creación, consulta, administración e integrantes.'],
  ['Tareas', 'Estados, responsables, fechas y seguimiento de avance.'],
  ['Requisitos', 'Registro, revisión y trazabilidad de requisitos.'],
  ['Dependencias', 'Relaciones entre tareas y análisis de afectaciones.'],
  ['Bloqueos', 'Registro y resolución de impedimentos.'],
  ['Documentos', 'Carga, procesamiento y recuperación mediante RAG.'],
  ['Asistente IA', 'Chat contextual especializado en gestión de proyectos.'],
  ['Reuniones', 'Audio, transcripción, minutas y elementos de seguimiento.'],
  ['Propuestas IA', 'Aceptar, modificar o rechazar sugerencias generadas.'],
  ['Reportes', 'Estado general, progreso, riesgos y resultados.'],
  ['Auditoría', 'Trazabilidad de acciones relevantes dentro del sistema.'],
]

const MAX_IMAGE_SIZE = 2 * 1024 * 1024

function getStoredPhoto(memberId) {
  try {
    return localStorage.getItem(`projectmind-team-photo-${memberId}`) || ''
  } catch {
    return ''
  }
}

function App() {
  const [backendStatus, setBackendStatus] = useState({
    loading: true,
    connected: false,
    message: 'Comprobando conexión con FastAPI...',
  })

  const [assistantStatus, setAssistantStatus] = useState({
    loading: true,
    provider: '',
    configured: false,
    humanInTheLoop: true,
  })

  const [memberPhotos, setMemberPhotos] = useState(() =>
    TEAM_MEMBERS.reduce(
      (photos, member) => ({
        ...photos,
        [member.id]: getStoredPhoto(member.id),
      }),
      {},
    ),
  )

  const [photoMessages, setPhotoMessages] = useState({})

  useEffect(() => {
    let active = true

    async function checkSystem() {
      const [healthResult, assistantResult] = await Promise.allSettled([
        getHealth(),
        getAssistantStatus(),
      ])

      if (!active) return

      if (healthResult.status === 'fulfilled') {
        setBackendStatus({
          loading: false,
          connected: healthResult.value.status === 'ok',
          message:
            healthResult.value.status === 'ok'
              ? 'Frontend y backend están conectados correctamente.'
              : 'FastAPI respondió con un estado inesperado.',
        })
      } else {
        setBackendStatus({
          loading: false,
          connected: false,
          message:
            'No fue posible conectar con FastAPI. Verifica la URL del backend.',
        })
      }

      if (assistantResult.status === 'fulfilled') {
        const data = assistantResult.value

        setAssistantStatus({
          loading: false,
          provider: data.provider || '',
          configured: Boolean(data.configured),
          humanInTheLoop: data.human_in_the_loop !== false,
        })
      } else {
        setAssistantStatus({
          loading: false,
          provider: '',
          configured: false,
          humanInTheLoop: true,
        })
      }
    }

    checkSystem()

    return () => {
      active = false
    }
  }, [])

  function handlePhotoChange(memberId, event) {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      setPhotoMessages((messages) => ({
        ...messages,
        [memberId]: 'Selecciona un archivo de imagen válido.',
      }))
      event.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setPhotoMessages((messages) => ({
        ...messages,
        [memberId]: 'La imagen debe pesar máximo 2 MB.',
      }))
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const photo = typeof reader.result === 'string' ? reader.result : ''

      setMemberPhotos((photos) => ({
        ...photos,
        [memberId]: photo,
      }))

      setPhotoMessages((messages) => ({
        ...messages,
        [memberId]: 'Foto actualizada correctamente.',
      }))

      try {
        localStorage.setItem(`projectmind-team-photo-${memberId}`, photo)
      } catch {
        setPhotoMessages((messages) => ({
          ...messages,
          [memberId]: 'La foto se mostrará durante esta sesión.',
        }))
      }
    }

    reader.readAsDataURL(file)
    event.target.value = ''
  }

  function removePhoto(memberId) {
    setMemberPhotos((photos) => ({
      ...photos,
      [memberId]: '',
    }))

    setPhotoMessages((messages) => ({
      ...messages,
      [memberId]: 'Foto eliminada.',
    }))

    try {
      localStorage.removeItem(`projectmind-team-photo-${memberId}`)
    } catch {
      // La interfaz continúa funcionando aunque localStorage esté bloqueado.
    }
  }

  const backendClass = backendStatus.loading
    ? 'status status--loading'
    : backendStatus.connected
      ? 'status status--online'
      : 'status status--offline'

  return (
    <main className="page-shell">
      <div className="content-wrapper">
        <section className="hero-card">
          <div className="hero-content">
            <span className="eyebrow">PROJECTMIND · MVP</span>

            <h1>Gestión inteligente de proyectos</h1>

            <p className="subtitle">
              Plataforma para organizar proyectos, tareas, requisitos,
              documentos, reuniones y análisis asistido por inteligencia
              artificial.
            </p>

            <div className={backendClass}>
              <span className="status__dot" />

              <div>
                <strong>
                  {backendStatus.loading
                    ? 'Verificando backend'
                    : backendStatus.connected
                      ? 'Backend conectado'
                      : 'Backend sin conexión'}
                </strong>

                <p>{backendStatus.message}</p>
              </div>
            </div>
          </div>

          <div className="architecture-card">
            <span>ARQUITECTURA BASE</span>

            <strong>React + FastAPI</strong>

            <p>
              Supabase · PostgreSQL · pgvector · RAG · OpenAI · LM Studio
            </p>
          </div>
        </section>

        <section className="system-section">
          <div className="section-heading">
            <span className="eyebrow">ESTRUCTURA DEL MVP</span>
            <h2>Módulos de ProjectMind</h2>
            <p>
              Estas áreas representan la estructura funcional definida para el
              MVP y serán habilitadas conforme avance el desarrollo.
            </p>
          </div>

          <div className="module-grid">
            {MODULES.map(([name, description]) => (
              <article className="module-card" key={name}>
                <span className="module-tag">MÓDULO</span>
                <h3>{name}</h3>
                <p>{description}</p>
                <span className="module-status">
                  Pendiente de integración funcional
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="integration-section">
          <div className="section-heading">
            <span className="eyebrow">INTEGRACIONES</span>
            <h2>Configuración del sistema</h2>
            <p>
              Servicios principales contemplados dentro de la arquitectura de
              ProjectMind.
            </p>
          </div>

          <div className="integration-grid">
            <article className="integration-card">
              <span className="integration-number">01</span>
              <h3>Supabase / PostgreSQL</h3>
              <p>
                Persistencia, autenticación, RLS, almacenamiento y pgvector.
              </p>
            </article>

            <article className="integration-card">
              <span className="integration-number">02</span>
              <h3>OpenAI / LM Studio</h3>

              {assistantStatus.loading ? (
                <p>Consultando configuración del asistente...</p>
              ) : (
                <>
                  <p>
                    Proveedor:{' '}
                    <strong>
                      {assistantStatus.provider || 'No disponible'}
                    </strong>
                  </p>

                  <span
                    className={
                      assistantStatus.configured
                        ? 'integration-state integration-state--ok'
                        : 'integration-state integration-state--pending'
                    }
                  >
                    {assistantStatus.configured
                      ? 'Proveedor configurado'
                      : 'Falta configurar proveedor'}
                  </span>
                </>
              )}
            </article>

            <article className="integration-card">
              <span className="integration-number">03</span>
              <h3>Human-in-the-Loop</h3>
              <p>
                La IA genera propuestas, pero las decisiones oficiales requieren
                revisión y aprobación del usuario.
              </p>

              <span className="integration-state integration-state--ok">
                {assistantStatus.humanInTheLoop
                  ? 'Revisión humana habilitada'
                  : 'Revisión pendiente'}
              </span>
            </article>

            <article className="integration-card">
              <span className="integration-number">04</span>
              <h3>RAG</h3>
              <p>
                Recuperación de información desde documentos y contexto del
                proyecto para mejorar las respuestas del asistente.
              </p>
            </article>
          </div>
        </section>

        <section className="crud-section">
          <div className="section-heading">
            <span className="eyebrow">CRUD · VERIFICACIÓN</span>
            <h2>Consola de base de datos</h2>
            <p>
              Verifica desde el frontend las operaciones Create, Read, Update y
              Delete sobre las tablas del dominio ProjectMind.
            </p>
          </div>

          <CrudConsole />
        </section>

        <section className="team-section">
          <div className="section-heading">
            <span className="eyebrow">EQUIPO</span>
            <h2>Integrantes del proyecto</h2>
            <p>
              Equipo responsable del diseño y desarrollo de ProjectMind.
            </p>
          </div>

          <div className="team-grid">
            {TEAM_MEMBERS.map((member) => {
              const photo = memberPhotos[member.id]
              const inputId = `photo-${member.id}`

              return (
                <article className="member-card" key={member.id}>
                  <div className="member-photo">
                    {photo ? (
                      <img src={photo} alt={`Foto de ${member.name}`} />
                    ) : (
                      <span>{member.initials}</span>
                    )}
                  </div>

                  <div className="member-info">
                    <h3>{member.name}</h3>
                    <p>{member.role}</p>
                  </div>

                  <div className="member-actions">
                    <input
                      id={inputId}
                      className="photo-input"
                      type="file"
                      accept="image/*"
                      onChange={(event) =>
                        handlePhotoChange(member.id, event)
                      }
                    />

                    <label className="photo-button" htmlFor={inputId}>
                      {photo ? 'Cambiar foto' : 'Agregar foto'}
                    </label>

                    {photo && (
                      <button
                        className="remove-photo-button"
                        type="button"
                        onClick={() => removePhoto(member.id)}
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>

                  {photoMessages[member.id] && (
                    <p className="photo-message">
                      {photoMessages[member.id]}
                    </p>
                  )}
                </article>
              )
            })}
          </div>

          <p className="team-note">
            Las fotografías se almacenan únicamente en el navegador de este
            dispositivo.
          </p>
        </section>
      </div>
    </main>
  )
}

export default App