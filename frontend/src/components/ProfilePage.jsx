import { useCallback, useEffect, useMemo, useState } from 'react'
import { getMyProfile, listProjects, updateMyProfile } from '../api/client'
import { formatDuration, IDLE_TIMEOUT_MS } from '../utils/sessionActivity'
import './profile.css'

const AVATARS = [
  { value: 'violet', label: 'Violeta' }, { value: 'ocean', label: 'Océano' },
  { value: 'emerald', label: 'Esmeralda' }, { value: 'sunset', label: 'Atardecer' },
  { value: 'rose', label: 'Rosa' }, { value: 'slate', label: 'Pizarra' },
]

function initials(name) {
  return (name || 'PM').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

const dateLabel = (date) => date ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date)) : 'Sin fecha'

export default function ProfilePage({ currentUser, getAccessToken, onProfileUpdated, sessionInfo, onShowProjects }) {
  const [profile, setProfile] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('about')
  const [projectsCount, setProjectsCount] = useState(null)
  const [ownedCount, setOwnedCount] = useState(null)
  const [idCopied, setIdCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const own = await getMyProfile(getAccessToken)
      setProfile(own)
      setDraft({ full_name: own.full_name || '', job_title: own.job_title || '', bio: own.bio || '', avatar_path: AVATARS.some(v => v.value === own.avatar_path) ? own.avatar_path : 'violet' })
      const overview = await listProjects(getAccessToken, { includeArchived: true, limit: 100 })
      setProjectsCount(overview.count)
      setOwnedCount(overview.items.filter(project => project.owner_id === currentUser?.id).length)
    } catch (err) { setError(err.message || 'No fue posible cargar tu perfil.') }
    finally { setLoading(false) }
  }, [currentUser?.id, getAccessToken])

  useEffect(() => { load() }, [load])

  const changed = useMemo(() => Boolean(draft && profile && (
    draft.full_name !== profile.full_name || draft.job_title !== (profile.job_title || '') || draft.bio !== (profile.bio || '') || draft.avatar_path !== (profile.avatar_path || 'violet')
  )), [draft, profile])

  async function save(event) {
    event.preventDefault()
    if (!changed || saving) return
    setError(''); setNotice(''); setSaving(true)
    try {
      const data = {
        full_name: draft.full_name.trim(), job_title: draft.job_title.trim() || null,
        bio: draft.bio.trim() || null, avatar_path: draft.avatar_path,
      }
      const result = await updateMyProfile(getAccessToken, data)
      setProfile(result)
      setDraft({ full_name: result.full_name, job_title: result.job_title || '', bio: result.bio || '', avatar_path: result.avatar_path || 'violet' })
      onProfileUpdated?.(result)
      setNotice('Tu perfil se guardó correctamente en Supabase.')
    } catch (err) { setError(err.message || 'No fue posible guardar tus cambios.') }
    finally { setSaving(false) }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(currentUser.id); setIdCopied(true) }
    catch { window.prompt('Copia tu identificador de cuenta:', currentUser.id) }
  }

  return <section className="pm-profile-page">
    <header className="pm-profile-heading"><div><span className="eyebrow">PROJECTMIND · CUENTA PERSONAL</span><h1>Mi perfil</h1><p>Un espacio para tu identidad profesional, actividad y preferencias de sesión.</p></div><button type="button" className="pm-profile-ghost" onClick={load} disabled={loading}>↻ Actualizar</button></header>
    {error && <p className="pm-profile-message error" role="alert">{error}</p>}
    {notice && <p className="pm-profile-message success" role="status">{notice}</p>}
    {loading ? <div className="pm-profile-loading">Cargando datos de tu cuenta…</div> : profile && draft && <>
      <div className="pm-profile-hero">
        <div className={`pm-profile-avatar theme-${draft.avatar_path}`} aria-label={`Avatar de ${draft.full_name}`}>{initials(draft.full_name)}</div>
        <div className="pm-profile-hero-meta"><span className="pm-profile-tag">PERFIL DE PROJECTMIND</span><h2>{profile.full_name}</h2><p>{profile.job_title || 'Agrega tu puesto o especialidad'}</p><small>{currentUser.email}</small></div>
        <button type="button" className="pm-profile-share" onClick={copyId}>{idCopied ? '✓ ID copiado' : 'Copiar mi ID'}</button>
      </div>
      <div className="pm-profile-overview">
        <article><span>Proyectos vinculados</span><strong>{projectsCount ?? '—'}</strong><small>Incluye proyectos compartidos</small></article>
        <article><span>Proyectos propios</span><strong>{ownedCount === null ? '—' : `${ownedCount}${projectsCount > 100 ? '+' : ''}`}</strong><small>En la primera página del portafolio</small></article>
        <article><span>Miembro desde</span><strong className="pm-profile-date">{dateLabel(profile.created_at)}</strong><small>Fecha de registro en ProjectMind</small></article>
      </div>
      <div className="pm-profile-tabs" role="tablist" aria-label="Secciones de perfil"><button type="button" role="tab" aria-selected={tab === 'about'} className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>Información personal</button><button type="button" role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Actividad y sesión</button></div>
      {tab === 'about' ? <div className="pm-profile-content">
        <form onSubmit={save} className="pm-profile-form">
          <div className="pm-profile-form-title"><div><h2>Información profesional</h2><p>Tu nombre y presentación se comparten con los integrantes de tus proyectos.</p></div><span className="pm-profile-pill">Editable</span></div>
          <label>Nombre para mostrar <b>*</b><input required minLength={2} maxLength={100} value={draft.full_name} onChange={e => setDraft(old => ({ ...old, full_name: e.target.value }))} placeholder="Nombre y apellido" /></label>
          <label>Puesto o especialidad<input maxLength={100} value={draft.job_title} onChange={e => setDraft(old => ({ ...old, job_title: e.target.value }))} placeholder="Ej. Líder de proyectos · Diseñador UX" /></label>
          <label>Acerca de mí<textarea rows={5} maxLength={600} value={draft.bio} onChange={e => setDraft(old => ({ ...old, bio: e.target.value }))} placeholder="Describe tu experiencia, objetivos o cómo colaboras en el equipo…" /><small>{draft.bio.length} / 600 caracteres</small></label>
          <fieldset><legend>Identidad visual del avatar</legend><p>Elige una combinación de color; tus iniciales se actualizarán automáticamente.</p><div className="pm-profile-themes">{AVATARS.map(theme => <button type="button" key={theme.value} className={`pm-profile-theme theme-${theme.value} ${draft.avatar_path === theme.value ? 'selected' : ''}`} aria-pressed={draft.avatar_path === theme.value} aria-label={`Tema ${theme.label}`} title={theme.label} onClick={() => setDraft(old => ({ ...old, avatar_path: theme.value }))}>{initials(draft.full_name)}</button>)}</div></fieldset>
          <div className="pm-profile-actions"><button type="button" className="pm-profile-ghost" disabled={!changed || saving} onClick={() => setDraft({ full_name: profile.full_name, job_title: profile.job_title || '', bio: profile.bio || '', avatar_path: profile.avatar_path || 'violet' })}>Descartar cambios</button><button type="submit" className="pm-profile-save" disabled={!changed || saving}>{saving ? 'Guardando…' : 'Guardar perfil'}</button></div>
        </form>
        <aside className="pm-profile-account"><h2>Datos de la cuenta</h2><div><span>Correo electrónico</span><strong>{currentUser.email}</strong><small>Administrado por Supabase Auth</small></div><div><span>Identificador de usuario</span><code>{currentUser.id}</code></div><div><span>Perfil actualizado</span><strong>{dateLabel(profile.updated_at)}</strong></div><p>Tu correo y contraseña se gestionan mediante Supabase Auth. Este formulario no los modifica.</p></aside>
      </div> : <div className="pm-profile-content">
        <section className="pm-profile-session"><h2>Tiempo de sesión</h2><p>ProjectMind cierra la sesión de esta pestaña tras 30 minutos sin actividad. La actividad de otra pestaña del mismo navegador también cuenta.</p><div className="pm-profile-session-grid"><div><small>Tiempo en esta sesión</small><strong>{formatDuration(sessionInfo.elapsedSeconds)}</strong></div><div><small>Inactividad restante</small><strong>{formatDuration(sessionInfo.remainingSeconds)}</strong></div><div><small>Promedio de sesiones</small><strong>{formatDuration(sessionInfo.averageSeconds)}</strong></div><div><small>Sesiones finalizadas</small><strong>{sessionInfo.completedSessions}</strong></div></div><div className="pm-profile-progress"><div style={{ width: `${Math.min(100, Math.max(0, sessionInfo.remainingSeconds / (IDLE_TIMEOUT_MS / 1000) * 100))}%` }}/></div><small className="pm-profile-help">El promedio se calcula con las últimas 20 sesiones finalizadas en este navegador. No es una estadística global de todos tus dispositivos y no incluye sesiones que se abandonan sin cerrarse.</small></section>
        <aside className="pm-profile-account"><h2>Colaboración</h2><p>Organiza tus proyectos desde la nueva línea de tiempo y comparte tu ID para que puedan agregarte como integrante.</p><button className="pm-profile-save" type="button" onClick={onShowProjects}>Ver mis proyectos →</button><button className="pm-profile-ghost" type="button" onClick={copyId}>{idCopied ? 'ID copiado' : 'Copiar ID de usuario'}</button></aside>
      </div>}
    </>}
  </section>
}
