import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AuthGate from './components/AuthGate.jsx'
import './index.css'

const DEMO_MODE =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEMO_MODE === 'true'

function DemoPreview() {
  const demoUser = {
    id: 'projectmind-demo-local',
    email: 'demo@projectmind.local',
    profile_name: 'Vista previa',
    profile_avatar: null,
  }

  const getAccessToken = async () => {
    throw new Error('Modo demostración: las operaciones autenticadas están deshabilitadas.')
  }

  return (
    <App
      currentUser={demoUser}
      getAccessToken={getAccessToken}
      onProfileUpdated={() => {}}
      sessionInfo={{
        completedSessions: 0,
        averageSeconds: null,
        sessionStartedAt: null,
        expired: false,
      }}
    />
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {DEMO_MODE ? (
      <DemoPreview />
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </StrictMode>,
)