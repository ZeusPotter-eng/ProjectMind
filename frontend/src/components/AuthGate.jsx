import { cloneElement, useCallback, useEffect, useRef, useState } from 'react'
import { getAuthStatus, getCurrentUser, loginUser, logoutUser, refreshSession, registerUser } from '../api/client'
import './auth.css'

const STORAGE_KEY = 'projectmind-session-v1'

function normalizeSession(value) {
  return { ...value, expires_at: value?.expires_at || Math.floor(Date.now() / 1000) + (value?.expires_in || 3600) }
}

function saveSession(value) {
  if (value?.access_token && value?.refresh_token) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: value.access_token, refresh_token: value.refresh_token, expires_at: normalizeSession(value).expires_at }))
  }
}

function clearSession() { localStorage.removeItem(STORAGE_KEY) }

export default function AuthGate({ children }) {
  const sessionRef = useRef(null)
  const refreshPromise = useRef(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [configured, setConfigured] = useState(true)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [idCopied, setIdCopied] = useState(false)

  useEffect(() => {
    let current = true
    async function bootstrap() {
      try {
        const status = await getAuthStatus()
        if (!current) return
        setConfigured(status.configured)
        if (!status.configured) return
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        if (!stored?.refresh_token) return
        // Renovar primero evita confiar en JWT caducados guardados localmente.
        const next = normalizeSession(await refreshSession(stored.refresh_token))
        const profile = await getCurrentUser(next.access_token)
        if (!current) return
        saveSession(next)
        sessionRef.current = next
        setSession(next)
        setUser(profile)
      } catch {
        if (current) clearSession()
      } finally {
        if (current) setLoading(false)
      }
    }
    bootstrap()
    return () => { current = false }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = normalizeSession(mode === 'login' ? await loginUser(email.trim(), password) : await registerUser(email.trim(), password))
      if (!result.access_token) {
        setNotice('Registro recibido. Revisa tu correo y confirma tu cuenta antes de iniciar sesión.')
        setMode('login'); setPassword('')
        return
      }
      const profile = await getCurrentUser(result.access_token)
      saveSession(result)
      sessionRef.current = result
      setSession(result); setUser(profile); setPassword(''); setIdCopied(false)
    } catch (err) {
      setError(err.message || 'No fue posible completar la solicitud.')
    } finally { setBusy(false) }
  }

  async function logout() {
    const token = session?.access_token
    clearSession(); sessionRef.current = null; setSession(null); setUser(null); setPassword(''); setIdCopied(false)
    if (token) { try { await logoutUser(token) } catch { /* Ya cerramos la sesión local */ } }
  }

  // PM-13: entrega un token vigente a las solicitudes de proyectos.
  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current
    if (!current?.access_token) throw new Error('Inicia sesión nuevamente.')
    const expiration = current.expires_at || Math.floor(Date.now() / 1000) + (current.expires_in || 0)
    if (expiration > Math.floor(Date.now() / 1000) + 45) return current.access_token
    if (!refreshPromise.current) {
      refreshPromise.current = refreshSession(current.refresh_token)
        .then(raw => {
          const next = normalizeSession(raw)
          sessionRef.current = next
          saveSession(next)
          setSession(next)
          return next.access_token
        })
        .catch(() => {
          clearSession()
          sessionRef.current = null
          setSession(null)
          setUser(null)
          throw new Error('Tu sesión expiró. Inicia sesión de nuevo.')
        })
        .finally(() => { refreshPromise.current = null })
    }
    return refreshPromise.current
  }, [])

  if (loading) return <main className="auth-screen"><div className="auth-card"><span className="auth-symbol">PM</span><h1>Verificando sesión…</h1></div></main>
  async function copyMyId() {
    try {
      await navigator.clipboard.writeText(user.id)
      setIdCopied(true)
    } catch { setIdCopied(false); window.prompt('Copia tu identificador de usuario:', user.id) }
  }

  if (user) return <><div className="auth-identity" title={user.email}><span>{user.email}</span><button type="button" title="Comparte este ID para que te agreguen a un proyecto" onClick={copyMyId}>{idCopied ? 'ID copiado' : 'Copiar mi ID'}</button><button onClick={logout}>Cerrar sesión</button></div>{cloneElement(children, { currentUser: user, getAccessToken })}</>

  return <main className="auth-screen"><section className="auth-card">
    <span className="auth-symbol">PM</span>
    <p className="auth-eyebrow">PROJECTMIND · ACCESO SEGURO</p>
    <h1>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h1>
    <p className="auth-intro">{mode === 'login' ? 'Ingresa con tus credenciales para acceder a tus herramientas de gestión.' : 'Regístrate para comenzar a utilizar ProjectMind.'}</p>
    {!configured ? <p className="auth-error" role="alert">Supabase Auth no está configurado en FastAPI. Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY.</p> : <>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="auth-email">Correo electrónico</label>
        <input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        <label htmlFor="auth-password">Contraseña</label>
        <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Registrarme'}</button>
      </form>
      <p className="auth-switch">{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}</button></p>
    </>}
  </section></main>
}
