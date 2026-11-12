import { useEffect, useRef, useState } from 'react'
import AvatarImage from './AvatarImage'
import './accountMenu.css'

/** Acciones de la cuenta en la barra superior; no cubre el acceso al chat. */
export default function AccountMenu({ user, getAccessToken, onOpenProfile, onCopyMyId, idCopied, onSignOut }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const displayName = user?.profile_name?.trim() || user?.email?.split('@')[0] || 'Mi cuenta'

  function openProfile() {
    setOpen(false)
    onOpenProfile()
  }

  function signOut() {
    setOpen(false)
    onSignOut()
  }

  return <div className="pm-account" ref={containerRef}>
    <button
      ref={triggerRef}
      type="button"
      className={`pm-account-trigger${open ? ' is-open' : ''}`}
      aria-label="Abrir opciones de mi cuenta"
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls="pm-account-menu"
      onClick={() => setOpen(value => !value)}
    >
      <AvatarImage
        className="pm-account-avatar"
        userId={user?.id}
        name={user?.profile_name || user?.email}
        avatarPath={user?.profile_avatar}
        getAccessToken={getAccessToken}
      />
      <span className="pm-account-trigger-name">{displayName}</span>
      <span aria-hidden="true" className={`pm-account-chevron${open ? ' is-open' : ''}`}>⌄</span>
    </button>
    {open && <div id="pm-account-menu" className="pm-account-dropdown" aria-label="Opciones de cuenta">
      <div className="pm-account-user">
        <strong title={displayName}>{displayName}</strong>
        <span title={user?.email || ''}>{user?.email || 'Sesión activa'}</span>
      </div>
      <div className="pm-account-options">
        <button type="button" onClick={openProfile}><span aria-hidden="true">◉</span> Mi perfil</button>
        <button type="button" onClick={onCopyMyId}><span aria-hidden="true">⧉</span> {idCopied ? 'ID copiado ✓' : 'Copiar mi ID'}</button>
      </div>
      <div className="pm-account-options pm-account-last">
        <button type="button" className="pm-account-logout" onClick={signOut}><span aria-hidden="true">↪</span> Cerrar sesión</button>
      </div>
    </div>}
  </div>
}
