import { cloneElement, useCallback, useEffect, useRef, useState } from 'react'
import { getAuthStatus, getCurrentUser, getMyProfile, loginUser, logoutUser, refreshSession, registerUser } from '../api/client'
import { finishActivity, isSessionExpired, SESSION_DURATION_MS, sessionSummary, startActivity } from '../utils/sessionActivity'
import AvatarImage from './AvatarImage'
import './auth.css'

// La versión anterior tenía cierre por inactividad. No conservar su sesión sin una fecha
// original verificable: el usuario iniciará sesión una vez tras esta actualización.
const STORAGE_KEY = 'projectmind-session-v2'
const OLD_STORAGE_KEY = 'projectmind-session-v1'
const EXPIRED_MESSAGE = 'Tu sesión de 24 horas finalizó. Vuelve a iniciar sesión para continuar.'

function normalizeSession(value, loginStartedAt = Date.now()) {
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: value.expires_at || Math.floor(Date.now() / 1000) + (value.expires_in || 3600),
    login_started_at: loginStartedAt,
  }
}

function saveSession(value) {
  if (value?.access_token && value?.refresh_token) localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}
function clearSession() { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(OLD_STORAGE_KEY) }

export default function AuthGate({ children }) {
  const sessionRef = useRef(null)
  const userRef = useRef(null)
  const refreshPromise = useRef(null)
  const closingRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [configured, setConfigured] = useState(true)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [idCopied, setIdCopied] = useState(false)
  const [sessionInfo, setSessionInfo] = useState({ completedSessions: 0, averageSeconds: null, sessionStartedAt: null, expired: false })

  const adoptUser = useCallback((profile, credentials) => {
    sessionRef.current = credentials
    userRef.current = profile
    saveSession(credentials)
    startActivity(profile.id, credentials.login_started_at)
    setUser(profile)
    setSessionInfo(sessionSummary(profile.id))
  }, [])

  const hydrateIdentity = useCallback(async (token, userId) => {
    try {
      const saved = await getMyProfile(async () => token)
      if (userRef.current?.id !== userId) return
      setUser(previous => {
        const next = { ...previous, profile_name: saved.full_name, profile_avatar: saved.avatar_path }
        userRef.current = next
        return next
      })
    } catch { /* No bloquear autenticación si el perfil no está disponible */ }
  }, [])

  const finish = useCallback(async (reason = 'manual') => {
    if (closingRef.current) return
    closingRef.current = true
    const token = sessionRef.current?.access_token
    const profile = userRef.current
    if (profile?.id) {
      try { finishActivity(profile.id, reason) } catch { /* localStorage opcional */ }
    }
    clearSession()
    sessionRef.current = null
    userRef.current = null
    refreshPromise.current = null
    setUser(null)
    setPassword('')
    setIdCopied(false)
    setNotice(reason === 'expired' ? EXPIRED_MESSAGE : reason === 'remote' ? 'La sesión se cerró en otra pestaña.' : '')
    setMode('login')
    if (token) { try { await logoutUser(token) } catch { /* Ya cerrada localmente */ } }
    closingRef.current = false
  }, [])

  useEffect(() => {
    let active = true
    async function bootstrap() {
      try {
        const status = await getAuthStatus()
        if (!active) return
        setConfigured(status.configured)
        if (!status.configured) return
        const previous = localStorage.getItem(OLD_STORAGE_KEY)
        if (previous) {
          localStorage.removeItem(OLD_STORAGE_KEY)
          setNotice('Actualizamos la seguridad de tu sesión. Inicia sesión para continuar.')
        }
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        if (!stored?.refresh_token) return
        if (isSessionExpired(stored.login_started_at)) {
          clearSession()
          setNotice(EXPIRED_MESSAGE)
          return
        }
        const next = normalizeSession(await refreshSession(stored.refresh_token), stored.login_started_at)
        if (isSessionExpired(next.login_started_at)) {
          clearSession()
          setNotice(EXPIRED_MESSAGE)
          return
        }
        const profile = await getCurrentUser(next.access_token)
        if (!active) return
        adoptUser(profile, next)
        void hydrateIdentity(next.access_token, profile.id)
      } catch {
        if (active) clearSession()
      } finally { if (active) setLoading(false) }
    }
    bootstrap()
    return () => { active = false }
  }, [adoptUser, hydrateIdentity])

  useEffect(() => {
    if (!user?.id) return
    const checkDeadline = () => {
      const current = sessionRef.current
      if (!current || isSessionExpired(current.login_started_at)) {
        void finish('expired')
      } else {
        setSessionInfo(sessionSummary(user.id))
      }
    }
    const onStorage = event => {
      if (event.key === STORAGE_KEY && !event.newValue) void finish('remote')
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') checkDeadline() }
    window.addEventListener('focus', checkDeadline)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = window.setInterval(checkDeadline, 15_000)
    checkDeadline()
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', checkDeadline)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [finish, user?.id])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const raw = mode === 'login' ? await loginUser(email.trim(), password) : await registerUser(email.trim(), password)
      if (!raw.access_token) {
        setNotice('Registro recibido. Confirma tu correo antes de iniciar sesión.')
        setMode('login'); setPassword('')
        return
      }
      const credentials = normalizeSession(raw, Date.now())
      const profile = await getCurrentUser(credentials.access_token)
      closingRef.current = false
      adoptUser(profile, credentials)
      void hydrateIdentity(credentials.access_token, profile.id)
      setPassword(''); setIdCopied(false)
    } catch (err) {
      setError(err.message || 'No fue posible completar la solicitud.')
    } finally { setBusy(false) }
  }

  const getAccessToken = useCallback(async () => {
    const current = sessionRef.current
    if (!current?.access_token || !userRef.current?.id) throw new Error('Inicia sesión nuevamente.')
    if (isSessionExpired(current.login_started_at)) {
      void finish('expired')
      throw new Error(EXPIRED_MESSAGE)
    }
    if (current.expires_at > Math.floor(Date.now() / 1000) + 45) return current.access_token
    if (!refreshPromise.current) {
      refreshPromise.current = refreshSession(current.refresh_token)
        .then(raw => {
          // Renovación técnica del JWT de Supabase: NO reinicia las 24 horas.
          if (!sessionRef.current || isSessionExpired(current.login_started_at)) {
            void finish('expired')
            throw new Error(EXPIRED_MESSAGE)
          }
          const next = normalizeSession(raw, current.login_started_at)
          sessionRef.current = next
          saveSession(next)
          return next.access_token
        })
        .catch(() => {
          void finish('invalid')
          throw new Error('Tu sesión dejó de ser válida. Inicia sesión de nuevo.')
        })
        .finally(() => { refreshPromise.current = null })
    }
    return refreshPromise.current
  }, [finish])

  const onProfileUpdated = useCallback(profile => {
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
      <AvatarImage className="auth-identity-avatar" userId={user.id} name={user.profile_name || user.email} avatarPath={user.profile_avatar} getAccessToken={getAccessToken} />
      <span className="auth-identity-email">{user.profile_name || user.email}</span>
      <button type="button" onClick={() => window.dispatchEvent(new Event('projectmind:open-profile'))}>Mi perfil</button>
      <button type="button" title="Comparte este ID para que te agreguen a un proyecto" onClick={copyMyId}>{idCopied ? 'ID copiado' : 'Copiar mi ID'}</button>
      <button type="button" onClick={() => void finish('manual')}>Cerrar sesión</button>
    </div>
    {cloneElement(children, { currentUser: user, getAccessToken, onProfileUpdated, sessionInfo })}
  </>

  return <main className="auth-screen"><section className="auth-card">
    <span className="auth-symbol">PM</span>
    <p className="auth-eyebrow">PROJECTMIND · ACCESO SEGURO</p>
    <h1>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h1>
    <p className="auth-intro">{mode === 'login' ? 'Ingresa con tus credenciales para acceder a tus herramientas de gestión.' : 'Regístrate para comenzar a utilizar ProjectMind.'}</p>
    {!configured ? <p className="auth-error" role="alert">Supabase Auth no está configurado en FastAPI. Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY.</p> : <>
      {notice && <p className={notice === EXPIRED_MESSAGE ? 'auth-expired-message' : 'auth-notice'} role="alert">{notice}</p>}
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="auth-email">Correo electrónico</label>
        <input id="auth-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        <label htmlFor="auth-password">Contraseña</label>
        <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={6} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Volver a iniciar sesión' : 'Registrarme'}</button>
      </form>
      <p className="auth-switch">{mode === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}</button></p>
    </>}
  </section></main>
}
