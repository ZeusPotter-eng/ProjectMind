import { cloneElement, useCallback, useEffect, useRef, useState } from 'react'
import { getAuthStatus, getCurrentUser, getMyProfile, loginUser, logoutUser, refreshSession, registerUser } from '../api/client'
import { activityKey, finishActivity, formatDuration, getActivity, IDLE_TIMEOUT_MS, sessionSummary, startActivity, touchActivity } from '../utils/sessionActivity'
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
  const userRef = useRef(null)
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
  const [sessionInfo, setSessionInfo] = useState({ completedSessions: 0, averageSeconds: null, elapsedSeconds: 0, remainingSeconds: IDLE_TIMEOUT_MS / 1000 })

  const adoptUser = useCallback((profile, credentials, fresh = false) => {
    sessionRef.current = credentials
    userRef.current = profile
    saveSession(credentials)
    if (fresh) startActivity(profile.id)
    else if (!getActivity(profile.id)) startActivity(profile.id)
    setUser(profile)
    setSession(credentials)
    setSessionInfo(sessionSummary(profile.id))
  }, [])

  const hydrateIdentity = useCallback(async (token, userId) => {
    // El perfil guardado debe mostrarse también después de iniciar otra sesión.
    try {
      const saved = await getMyProfile(async () => token)
      if (userRef.current?.id !== userId) return
      setUser(previous => {
        const next = { ...previous, profile_name: saved.full_name, profile_avatar: saved.avatar_path }
        userRef.current = next
        return next
      })
    } catch { /* El perfil opcional no debe bloquear el inicio de sesión */ }
  }, [])

  const finish = useCallback(async (reason = 'manual') => {
    const token = sessionRef.current?.access_token
    const profile = userRef.current
    if (profile?.id) {
      try { finishActivity(profile.id, reason) } catch { /* localStorage puede estar bloqueado */ }
    }
    clearSession()
    sessionRef.current = null
    userRef.current = null
    refreshPromise.current = null
    setSession(null)
    setUser(null)
    setPassword('')
    setIdCopied(false)
    setNotice(reason === 'idle' ? 'Cerramos tu sesión después de 30 minutos de inactividad.' : '')
    if (token) { try { await logoutUser(token) } catch { /* La sesión local ya está cerrada */ } }
  }, [])

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
        // No confiamos en un JWT anterior: renovamos y verificamos identidad con Supabase.
        const next = normalizeSession(await refreshSession(stored.refresh_token))
        const profile = await getCurrentUser(next.access_token)
        if (!current) return
        const activity = getActivity(profile.id)
        if (activity && Date.now() - activity.lastActivityAt >= IDLE_TIMEOUT_MS) {
          clearSession()
          try { finishActivity(profile.id, 'idle') } catch { /* opcional */ }
          setNotice('Tu sesión anterior terminó por inactividad. Inicia sesión nuevamente.')
          return
        }
        adoptUser(profile, next)
        void hydrateIdentity(next.access_token, profile.id)
      } catch {
        if (current) clearSession()
      } finally {
        if (current) setLoading(false)
      }
    }
    bootstrap()
    return () => { current = false }
  }, [adoptUser, hydrateIdentity])

  useEffect(() => {
    if (!user?.id) return
    const userId = user.id
    const tick = () => {
      const activity = getActivity(userId)
      if (!activity || Date.now() - activity.lastActivityAt >= IDLE_TIMEOUT_MS) {
        void finish('idle')
        return
      }
      setSessionInfo(sessionSummary(userId))
    }
    const onActivity = () => {
      const activity = getActivity(userId)
      if (activity && Date.now() - activity.lastActivityAt < IDLE_TIMEOUT_MS) {
        touchActivity(userId)
      } else void finish('idle')
    }
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY && !event.newValue) {
        sessionRef.current = null
        userRef.current = null
        setSession(null)
        setUser(null)
        setNotice('La sesión se cerró en otra pestaña.')
      } else if (event.key === activityKey(userId)) tick()
    }
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    for (const name of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(name, onActivity, { passive: true })
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(tick, 1000)
    tick()
    return () => {
      window.clearInterval(timer)
      for (const name of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.removeEventListener(name, onActivity)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [finish, user?.id])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = normalizeSession(mode === 'login' ? await loginUser(email.trim(), password) : await registerUser(email.trim(), password))
      if (!result.access_token) {
        setNotice('Registro recibido. Confirma tu correo antes de iniciar sesión.')
        setMode('login'); setPassword('')
        return
      }
      const profile = await getCurrentUser(result.access_token)
      adoptUser(profile, result, true)
      void hydrateIdentity(result.access_token, profile.id)
      setPassword(''); setIdCopied(false)
    } catch (err) {
      setError(err.message || 'No fue posible completar la solicitud.')
    } finally { setBusy(false) }
  }

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current
    const owner = userRef.current
    if (!current?.access_token || !owner?.id) throw new Error('Inicia sesión nuevamente.')
    const last = getActivity(owner.id)
    if (!last || Date.now() - last.lastActivityAt >= IDLE_TIMEOUT_MS) {
      void finish('idle')
      throw new Error('Tu sesión terminó por inactividad. Inicia sesión nuevamente.')
    }
    const expiration = current.expires_at || 0
    if (expiration > Math.floor(Date.now() / 1000) + 45) return current.access_token
    if (!refreshPromise.current) {
      refreshPromise.current = refreshSession(current.refresh_token)
        .then(raw => {
          if (!sessionRef.current || !userRef.current) throw new Error('Tu sesión terminó.')
          const next = normalizeSession(raw)
          sessionRef.current = next
          saveSession(next)
          setSession(next)
          return next.access_token
        })
        .catch(() => {
          void finish('invalid')
          throw new Error('Tu sesión expiró. Inicia sesión de nuevo.')
        })
        .finally(() => { refreshPromise.current = null })
    }
    return refreshPromise.current
  }, [finish])

  const onProfileUpdated = useCallback((profile) => {
    setUser(previous => {
      const next = { ...previous, profile_name: profile.full_name, profile_avatar: profile.avatar_path }
      userRef.current = next
      return next
    })
  }, [])

  async function copyMyId() {
    try { await navigator.clipboard.writeText(user.id); setIdCopied(true) }
    catch { setIdCopied(false); window.prompt('Copia tu identificador:', user.id) }
  }

  if (loading) return <main className="auth-screen"><div className="auth-card"><span className="auth-symbol">PM</span><h1>Verificando sesión…</h1></div></main>

  if (user) return <>
    <div className="auth-identity" title={user.email}>
      <span className="auth-identity-email">{user.profile_name || user.email}</span>
      <span className={`auth-session-clock ${sessionInfo.remainingSeconds <= 120 ? 'expiring' : ''}`} title="Tiempo restante antes del cierre automático por inactividad" aria-label={`Inactividad restante: ${formatDuration(sessionInfo.remainingSeconds)}`}>
        ◷ {formatDuration(sessionInfo.remainingSeconds)}
      </span>
      <button type="button" onClick={() => window.dispatchEvent(new Event('projectmind:open-profile'))}>Mi perfil</button>
      <button type="button" title="Comparte este ID para que te agreguen a un proyecto" onClick={copyMyId}>{idCopied ? 'ID copiado' : 'Copiar mi ID'}</button>
      <button type="button" onClick={() => void finish('manual')}>Cerrar sesión</button>
    </div>
    {sessionInfo.remainingSeconds <= 120 && <div className="auth-idle-warning" role="status">Tu sesión se cerrará en {formatDuration(sessionInfo.remainingSeconds)} si no hay actividad.</div>}
    {cloneElement(children, { currentUser: user, getAccessToken, onProfileUpdated, sessionInfo })}
  </>

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
