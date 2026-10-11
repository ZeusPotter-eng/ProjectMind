import { useCallback, useEffect, useMemo, useState } from 'react'
import { addProjectMember, listProjectMembers, updateProjectMember } from '../api/client'
import './members.css'

const ROLES = { owner: 'Propietario', admin: 'Administrador', member: 'Integrante' }
const STATES = { active: 'Activo', inactive: 'Inactivo', removed: 'Retirado' }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ProjectMembersPanel({ project, currentUserId, getAccessToken, onClose, onMembershipChanged, onEditProject, onArchiveProject }) {
  const [members, setMembers] = useState([])
  const [maxActive, setMaxActive] = useState(15)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [newMemberId, setNewMemberId] = useState('')
  const [newRole, setNewRole] = useState('member')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await listProjectMembers(getAccessToken, project.id)
      setMembers(result.items || [])
      setMaxActive(result.max_active || 15)
    } catch (err) { setError(err.message || 'No se pudieron consultar los integrantes.') }
    finally { setLoading(false) }
  }, [getAccessToken, project.id])

  useEffect(() => { load() }, [load])

  const currentMembership = members.find(member => member.user_id === currentUserId && member.status === 'active')
  const canManage = Boolean(currentMembership && ['owner', 'admin'].includes(currentMembership.role) && project.status !== 'archived')
  const activeCount = members.filter(member => member.status === 'active').length
  const visibleMembers = useMemo(() => members.filter(member => showRemoved || member.status !== 'removed'), [members, showRemoved])

  async function addMember(event) {
    event.preventDefault()
    setError(''); setNotice('')
    const userId = newMemberId.trim()
    if (!UUID_PATTERN.test(userId)) { setError('El identificador debe tener el formato UUID completo.'); return }
    if (userId.toLowerCase() === currentUserId?.toLowerCase()) { setError('Tu cuenta ya forma parte del proyecto.'); return }
    setBusyId('new')
    try {
      await addProjectMember(getAccessToken, project.id, { user_id: userId, role: newRole })
      setNewMemberId('')
      setNewRole('member')
      setNotice('El integrante se agregó correctamente y ya tiene acceso según su rol.')
      await load()
      onMembershipChanged?.()
    } catch (err) { setError(err.message || 'No se pudo agregar al integrante.') }
    finally { setBusyId('') }
  }

  async function changeMember(member, change) {
    setBusyId(member.user_id); setError(''); setNotice('')
    try {
      await updateProjectMember(getAccessToken, project.id, member.user_id, change)
      setNotice(change.status === 'removed' ? 'Integrante retirado del proyecto.' : 'Permisos actualizados correctamente.')
      await load()
      onMembershipChanged?.()
    } catch (err) { setError(err.message || 'No fue posible actualizar al integrante.') }
    finally { setBusyId('') }
  }

  return <section className="pm-members-panel" aria-labelledby="pm-members-heading">
    <div className="pm-project-form-heading">
      <div><span className="eyebrow">PM-15 · INTEGRANTES</span><h2 id="pm-members-heading">Equipo del proyecto</h2><p className="pm-members-subtitle">{project.name}</p></div>
      <button type="button" className="pm-project-icon-btn" aria-label="Cerrar integrantes" onClick={onClose}>×</button>
    </div>

    <div className="pm-members-summary">
      <div><strong>{activeCount} de {maxActive}</strong><span>Integrantes activos</span></div>
      <div><strong>{canManage ? 'Administración' : 'Consulta'}</strong><span>Tu acceso al equipo</span></div>
    </div>

    <div className="pm-members-heading-row"><h3>Personas vinculadas</h3><button className="pm-project-secondary" onClick={load} disabled={loading || Boolean(busyId)} type="button">Actualizar</button></div>
    {error && <p className="pm-project-alert error" role="alert">{error}</p>}
    {notice && <p className="pm-project-alert success" role="status">{notice}</p>}
    {loading ? <p className="pm-members-hint">Consultando integrantes…</p> : <>
      {members.some(member => member.status === 'removed') && <label className="pm-members-removed-toggle"><input type="checkbox" checked={showRemoved} onChange={event => setShowRemoved(event.target.checked)}/> Mostrar integrantes retirados</label>}
      <div className="pm-members-roster">
        {visibleMembers.map(member => <article key={member.user_id} className="pm-members-person">
          <div className="pm-members-avatar" aria-hidden="true">{(member.full_name || member.user_id).slice(0, 2).toUpperCase()}</div>
          <div className="pm-members-person-info">
            <strong>{member.full_name || 'Cuenta de ProjectMind'}{member.user_id === currentUserId ? ' · Tú' : ''}</strong>
            <span className="pm-members-role-line">{ROLES[member.role]} · {STATES[member.status]}</span>
            <small title={member.user_id}>ID: {member.user_id}</small>
          </div>
          {canManage && member.role !== 'owner' && member.user_id !== project.owner_id ? <div className="pm-members-person-actions">
            {member.status !== 'removed' && <select aria-label={`Rol de ${member.full_name || member.user_id}`} value={member.role} disabled={Boolean(busyId)} onChange={event => changeMember(member, { role: event.target.value })}><option value="member">Integrante</option><option value="admin">Administrador</option></select>}
            {member.status === 'removed'
              ? <button type="button" className="pm-project-secondary" disabled={Boolean(busyId) || activeCount >= maxActive} onClick={() => changeMember(member, {status:'active'})}>Reactivar</button>
              : <button type="button" className="pm-members-remove" disabled={Boolean(busyId)} onClick={() => { if (window.confirm(`¿Retirar a ${member.full_name || 'este integrante'} del proyecto?`)) changeMember(member,{status:'removed'}) }}>Retirar</button>}
          </div> : <span className="pm-members-fixed-role">{member.role === 'owner' ? 'Rol protegido' : 'Solo lectura'}</span>}
        </article>)}
        {visibleMembers.length === 0 && <p className="pm-members-hint">No hay integrantes para mostrar.</p>}
      </div>
    </>}

    {canManage && <form onSubmit={addMember} className="pm-members-add">
      <h3>Agregar integrante</h3>
      <p className="pm-members-hint">Pide a la persona que pulse <b>«Copiar mi ID»</b> en su sesión de ProjectMind. Debe tener una cuenta registrada. Al agregarla, obtendrá acceso inmediato según su rol.</p>
      <label htmlFor="pm-member-id">Identificador de usuario (UUID)</label>
      <input id="pm-member-id" value={newMemberId} onChange={event => setNewMemberId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required maxLength={36} autoComplete="off" />
      <label htmlFor="pm-member-role">Rol asignado</label>
      <select id="pm-member-role" value={newRole} onChange={event => setNewRole(event.target.value)}><option value="member">Integrante · consulta</option><option value="admin">Administrador · gestiona el proyecto</option></select>
      <button type="submit" className="pm-project-primary" disabled={loading || Boolean(busyId) || activeCount >= maxActive}>{busyId === 'new' ? 'Agregando…' : activeCount >= maxActive ? 'Máximo alcanzado' : '+ Agregar al equipo'}</button>
    </form>}
    {project.status === 'archived' && <p className="pm-members-hint">Este proyecto está archivado. Su equipo se muestra en modo de consulta.</p>}
    <footer className="pm-members-footer">
      {canManage && <><button type="button" className="pm-project-secondary" onClick={onEditProject}>Editar proyecto</button><button type="button" className="pm-members-remove" onClick={onArchiveProject}>Archivar proyecto</button></>}
      <button type="button" className="pm-project-secondary" onClick={onClose}>Cerrar</button>
    </footer>
  </section>
}
