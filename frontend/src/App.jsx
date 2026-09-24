import { useEffect, useState } from 'react'
import { getHealth } from './api/client'

const TEAM_MEMBERS = [
  {
    id: 'jimmy',
    name: 'Jimmy',
    role: 'Desarrollador del proyecto',
    initials: 'JI',
  },
  {
    id: 'andy',
    name: 'Andy',
    role: 'Desarrollador del proyecto',
    initials: 'AN',
  },
  {
    id: 'zeus',
    name: 'Zeus',
    role: 'Desarrollador del proyecto',
    initials: 'ZE',
  },
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
    message: 'Comprobando conexión...',
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

    async function checkBackend() {
      try {
        const data = await getHealth()

        if (active) {
          setBackendStatus({
            loading: false,
            connected: data.status === 'ok',
            message:
              data.status === 'ok'
                ? 'Frontend y backend están conectados.'
                : 'El backend respondió con un estado inesperado.',
          })
        }
      } catch {
        if (active) {
          setBackendStatus({
            loading: false,
            connected: false,
            message:
              'No fue posible conectar con FastAPI. Verifica que el backend esté ejecutándose en el puerto 8000.',
          })
        }
      }
    }

    checkBackend()

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
      // La interfaz sigue funcionando aunque el navegador bloquee localStorage.
    }
  }

  const statusClass = backendStatus.loading
    ? 'status status--loading'
    : backendStatus.connected
      ? 'status status--online'
      : 'status status--offline'

  return (
    <main className="page-shell">
      <div className="content-wrapper">
        <section className="hero-card">
          <span className="eyebrow">PROJECTMIND</span>

          <h1>Base inicial del sistema</h1>

          <p className="subtitle">
            React + Vite en el frontend y FastAPI en el backend.
          </p>

          <div className={statusClass}>
            <span className="status__dot" aria-hidden="true" />
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

          <div className="next-step">
            <strong>Primer objetivo</strong>
            <p>
              Confirmar que ambas aplicaciones se comunican antes de integrar
              Supabase, el asistente de IA, RAG y Speech-to-Text.
            </p>
          </div>
        </section>

        <section className="team-section" aria-labelledby="team-title">
          <div className="section-heading">
            <span className="eyebrow">EQUIPO</span>
            <h2 id="team-title">Integrantes del proyecto</h2>
            <p>
              Equipo responsable del desarrollo de ProjectMind. Cada integrante
              puede agregar o cambiar su fotografía desde esta sección.
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
                      <span aria-hidden="true">{member.initials}</span>
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
                      onChange={(event) => handlePhotoChange(member.id, event)}
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
                    <p className="photo-message" role="status">
                      {photoMessages[member.id]}
                    </p>
                  )}
                </article>
              )
            })}
          </div>

          <p className="team-note">
            Las fotografías se guardan únicamente en el navegador de este
            dispositivo y no se envían al backend.
          </p>
        </section>
      </div>
    </main>
  )
}

export default App
