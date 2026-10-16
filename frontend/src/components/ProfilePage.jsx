import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMyProfile, listProjects, updateMyProfile, uploadMyAvatar } from '../api/client'
import AvatarImage, { isAvatarPhoto } from './AvatarImage'
import { formatDuration } from '../utils/sessionActivity'
import './profile.css'

const AVATARS = [
  { value: 'violet', label: 'Violeta' }, { value: 'ocean', label: 'Océano' },
  { value: 'emerald', label: 'Esmeralda' }, { value: 'sunset', label: 'Atardecer' },
  { value: 'rose', label: 'Rosa' }, { value: 'slate', label: 'Pizarra' },
]
const FIELDS = ['full_name', 'job_title', 'bio', 'company', 'department', 'location', 'website', 'skills', 'avatar_path']
const text = value => value ?? ''
const dateLabel = date => date ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(date)) : 'Sin fecha'
const toDraft = profile => Object.fromEntries(FIELDS.map(key => [key, key === 'avatar_path' ? profile.avatar_path || 'violet' : text(profile[key])]))

export default function ProfilePage({ currentUser, getAccessToken, onProfileUpdated, sessionInfo, onShowProjects }) {
  const [profile, setProfile] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [photoPreview, setPhotoPreview] = useState('')
  const previewRef = useRef('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState('about')
  const [projectsCount, setProjectsCount] = useState(null)
  const [ownedCount, setOwnedCount] = useState(null)
  const [idCopied, setIdCopied] = useState(false)
  const setField = (name, value) => setDraft(old => ({ ...old, [name]: value }))

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const own = await getMyProfile(getAccessToken)
      setProfile(own)
      setDraft(toDraft(own))
      const overview = await listProjects(getAccessToken, { includeArchived: true, limit: 100 })
      setProjectsCount(overview.count)
      setOwnedCount(overview.items.filter(project => project.owner_id === currentUser?.id).length)
    } catch (err) { setError(err.message || 'No fue posible cargar tu perfil.') }
    finally { setLoading(false) }
  }, [currentUser?.id, getAccessToken])

  useEffect(() => { load() }, [load])
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  const changed = useMemo(() => Boolean(draft && profile && FIELDS.some(key =>
    draft[key] !== (key === 'avatar_path' ? profile.avatar_path || 'violet' : text(profile[key]))
  )), [draft, profile])

  async function save(event) {
    event.preventDefault()
    if (!changed || saving || uploading) return
    setError(''); setNotice(''); setSaving(true)
    try {
      const values = Object.fromEntries(FIELDS.map(key => [key, key === 'avatar_path' ? draft[key] : draft[key].trim() || null]))
      // Las rutas privadas solo se crean desde el endpoint de subida, nunca por PATCH.
      if (isAvatarPhoto(values.avatar_path)) delete values.avatar_path
      if (!values.full_name) throw new Error('Escribe tu nombre completo o nombre para mostrar.')
      const result = await updateMyProfile(getAccessToken, values)
      setProfile(result)
      setDraft(toDraft(result))
      onProfileUpdated?.(result)
      setNotice('Tu perfil profesional se guardó correctamente.')
    } catch (err) { setError(err.message || 'No fue posible guardar tus cambios.') }
    finally { setSaving(false) }
  }

  async function choosePhoto(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten fotografías JPG, PNG y WebP.')
      return
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError('La imagen debe pesar menos de 5 MB.')
      return
    }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    const preview = URL.createObjectURL(file)
    previewRef.current = preview
    setPhotoPreview(preview)
    setUploading(true); setError(''); setNotice('')
    try {
      const result = await uploadMyAvatar(getAccessToken, file)
      setProfile(result)
      setDraft(old => ({ ...old, avatar_path: result.avatar_path }))
      onProfileUpdated?.(result)
      setNotice('Fotografía guardada en tu perfil. Los compañeros autorizados podrán verla.')
    } catch (err) { setError(err.message || 'No fue posible guardar tu fotografía.') }
    finally {
      setUploading(false)
      setPhotoPreview('')
      URL.revokeObjectURL(preview)
      if (previewRef.current === preview) previewRef.current = ''
    }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(currentUser.id); setIdCopied(true) }
    catch { window.prompt('Copia tu identificador de cuenta:', currentUser.id) }
  }

  const skillTags = profile?.skills?.split(',').map(x => x.trim()).filter(Boolean).slice(0, 12) || []
  return <section className="pm-profile-page">
    <header className="pm-profile-heading"><div><span className="eyebrow">PROJECTMIND · PERFIL PROFESIONAL</span><h1>Mi perfil</h1><p>Tu identidad, experiencia y participación en los proyectos, todo en un solo lugar.</p></div><button type="button" className="pm-profile-ghost" onClick={load} disabled={loading || saving || uploading}>↻ Actualizar</button></header>
    {error && <p className="pm-profile-message error" role="alert">{error}</p>}
    {notice && <p className="pm-profile-message success" role="status">{notice}</p>}
    {loading ? <div className="pm-profile-loading">Cargando datos de tu cuenta…</div> : profile && draft && <>
      <div className="pm-profile-hero">
        <div className="pm-profile-photo-area">
          <AvatarImage userId={currentUser.id} name={draft.full_name} avatarPath={draft.avatar_path} getAccessToken={getAccessToken} className="pm-profile-avatar" preview={photoPreview} />
          <label htmlFor="pm-avatar-file" className={`pm-profile-photo-button ${uploading ? 'is-busy' : ''}`}>{uploading ? 'Subiendo…' : '📷 Cambiar foto'}</label>
          <input id="pm-avatar-file" className="pm-profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} disabled={uploading || saving} aria-label="Subir fotografía de perfil" />
          <small>JPG, PNG o WebP · Hasta 5 MB</small>
        </div>
        <div className="pm-profile-hero-meta"><span className="pm-profile-tag">MI IDENTIDAD EN PROJECTMIND</span><h2>{profile.full_name}</h2><p>{profile.job_title || 'Agrega tu puesto o especialidad'}</p><small>{[profile.department, profile.company, profile.location].filter(Boolean).join(' · ') || currentUser.email}</small>
          {skillTags.length > 0 && <div className="pm-profile-skill-tags">{skillTags.map((skill, i) => <span key={`${skill}-${i}`}>{skill}</span>)}</div>}
        </div>
        <button type="button" className="pm-profile-share" onClick={copyId}>{idCopied ? '✓ ID copiado' : 'Copiar mi ID'}</button>
      </div>
      <div className="pm-profile-overview">
        <article><span>Proyectos vinculados</span><strong>{projectsCount ?? '—'}</strong><small>Incluye proyectos compartidos</small></article>
        <article><span>Proyectos propios</span><strong>{ownedCount === null ? '—' : `${ownedCount}${projectsCount > 100 ? '+' : ''}`}</strong><small>En la primera página del portafolio</small></article>
        <article><span>Miembro desde</span><strong className="pm-profile-date">{dateLabel(profile.created_at)}</strong><small>Alta en ProjectMind</small></article>
      </div>
      <div className="pm-profile-tabs" role="tablist" aria-label="Secciones de perfil">
        <button type="button" role="tab" aria-selected={tab === 'about'} className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>Información profesional</button>
        <button type="button" role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Actividad y cuenta</button>
      </div>
      {tab === 'about' ? <div className="pm-profile-content">
        <form onSubmit={save} className="pm-profile-form">
          <div className="pm-profile-form-title"><div><h2>Editar mi perfil</h2><p>Personaliza los datos que compartirás con tus compañeros autorizados.</p></div><span className="pm-profile-pill">Editable</span></div>
          <div className="pm-profile-form-grid">
            <label>Nombre para mostrar <b>*</b><input required minLength={2} maxLength={100} value={draft.full_name} onChange={e => setField('full_name', e.target.value)} placeholder="Nombre y apellido" /></label>
            <label>Puesto o especialidad<input maxLength={100} value={draft.job_title} onChange={e => setField('job_title', e.target.value)} placeholder="Ej. Desarrollador Full Stack" /></label>
            <label>Empresa o institución<input maxLength={120} value={draft.company} onChange={e => setField('company', e.target.value)} placeholder="Ej. Universidad / Organización" /></label>
            <label>Área o departamento<input maxLength={100} value={draft.department} onChange={e => setField('department', e.target.value)} placeholder="Ej. Ingeniería, Diseño, Producto" /></label>
            <label>Ciudad o ubicación general<input maxLength={120} value={draft.location} onChange={e => setField('location', e.target.value)} placeholder="Ej. Querétaro, México" /></label>
            <label>Portafolio o sitio web<input type="url" maxLength={240} value={draft.website} onChange={e => setField('website', e.target.value)} placeholder="https://mi-portafolio.com" /></label>
          </div>
          <label>Habilidades y tecnologías<input maxLength={300} value={draft.skills} onChange={e => setField('skills', e.target.value)} placeholder="React, Python, gestión de proyectos, UI/UX" /><small>Separa cada habilidad con comas · {draft.skills.length}/300</small></label>
          <label>Acerca de mí<textarea rows={5} maxLength={600} value={draft.bio} onChange={e => setField('bio', e.target.value)} placeholder="Describe tu experiencia, tus objetivos y cómo colaboras con tu equipo…" /><small>{draft.bio.length}/600 caracteres</small></label>
          <fieldset><legend>Avatar alternativo</legend><p>Si no deseas una foto, elige un avatar con tus iniciales. Al guardar, sustituirá tu fotografía actual.</p><div className="pm-profile-themes">{AVATARS.map(theme => <button type="button" key={theme.value} className={`pm-profile-theme theme-${theme.value} ${draft.avatar_path === theme.value ? 'selected' : ''}`} aria-pressed={draft.avatar_path === theme.value} aria-label={`Tema ${theme.label}`} title={theme.label} onClick={() => setField('avatar_path', theme.value)}>{(draft.full_name || 'PM').slice(0, 2).toUpperCase()}</button>)}</div>{isAvatarPhoto(draft.avatar_path) && <small className="pm-profile-photo-status">✓ Estás usando una fotografía personal.</small>}</fieldset>
          <div className="pm-profile-actions"><button type="button" className="pm-profile-ghost" disabled={!changed || saving || uploading} onClick={() => setDraft(toDraft(profile))}>Descartar cambios</button><button type="submit" className="pm-profile-save" disabled={!changed || saving || uploading}>{saving ? 'Guardando…' : 'Guardar perfil'}</button></div>
        </form>
        <aside className="pm-profile-account"><h2>Información de la cuenta</h2><div><span>Correo de acceso</span><strong>{currentUser.email}</strong><small>Protegido por Supabase Auth</small></div><div><span>Identificador de usuario</span><code>{currentUser.id}</code></div><div><span>Última actualización</span><strong>{dateLabel(profile.updated_at)}</strong></div>{profile.website && <div><span>Sitio profesional</span><a href={profile.website} target="_blank" rel="noopener noreferrer">Visitar mi sitio ↗</a></div>}<p>La fotografía se almacena de forma privada. Solo tú puedes cambiarla; las personas autorizadas pueden verla en el equipo. El correo y la contraseña no se modifican aquí.</p></aside>
      </div> : <div className="pm-profile-content">
        <section className="pm-profile-session"><h2>Sesión y actividad</h2><p>Tu sesión dura <strong>24 horas desde el inicio de sesión</strong>. No tienes que mirar ningún reloj ni se cerrará por dejar de usar la aplicación unos minutos. Cuando termine el plazo, ProjectMind te pedirá volver a ingresar.</p>
          <div className="pm-profile-session-grid"><div><small>Vigencia de cada ingreso</small><strong>24 horas</strong></div><div><small>Promedio de sesiones finalizadas</small><strong>{formatDuration(sessionInfo?.averageSeconds)}</strong></div><div><small>Sesiones finalizadas en este navegador</small><strong>{sessionInfo?.completedSessions ?? 0}</strong></div><div><small>Protección</small><strong className="pm-profile-session-label">Inicio de sesión obligatorio al vencer</strong></div></div>
          <small className="pm-profile-help">El promedio se calcula con las últimas 20 sesiones finalizadas en este navegador, no entre todos tus dispositivos. La renovación técnica del token no prolonga el límite de 24 horas.</small>
        </section>
        <aside className="pm-profile-account"><h2>Colaboración</h2><p>Organiza tus proyectos en el cronograma y comparte tu identificador para que puedan agregarte como integrante.</p><button className="pm-profile-save" type="button" onClick={onShowProjects}>Ver mis proyectos →</button><button className="pm-profile-ghost" type="button" onClick={copyId}>{idCopied ? 'ID copiado' : 'Copiar ID de usuario'}</button></aside>
      </div>}
    </>}
  </section>
}
