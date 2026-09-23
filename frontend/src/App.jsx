import { useEffect, useState } from 'react'
import { getHealth } from './api/client'

function App() {
  const [backendStatus, setBackendStatus] = useState({
    loading: true,
    connected: false,
    message: 'Comprobando conexión...',
  })

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

  const statusClass = backendStatus.loading
    ? 'status status--loading'
    : backendStatus.connected
      ? 'status status--online'
      : 'status status--offline'

  return (
    <main className="page-shell">
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
    </main>
  )
}

export default App
