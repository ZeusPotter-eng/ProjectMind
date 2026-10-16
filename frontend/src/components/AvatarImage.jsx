import { useEffect, useState } from 'react'
import { getProfileAvatarUrl } from '../api/client'

const THEMES = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'slate']
export const isAvatarPhoto = path => /^[\da-f-]{36}\/[\da-f]{32}\.(png|jpg|webp)$/i.test(path || '')
export const avatarInitials = name => (name || 'PM').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()

export default function AvatarImage({ userId, name, avatarPath, getAccessToken, className = '', preview = '' }) {
  const [imageUrl, setImageUrl] = useState('')
  useEffect(() => {
    let current = true
    setImageUrl('')
    if (!isAvatarPhoto(avatarPath) || !userId || !getAccessToken) return () => { current = false }
    getProfileAvatarUrl(getAccessToken, userId)
      .then(result => { if (current) setImageUrl(result.url || '') })
      .catch(() => { if (current) setImageUrl('') })
    return () => { current = false }
  }, [avatarPath, userId, getAccessToken])

  const theme = THEMES.includes(avatarPath) ? avatarPath : 'violet'
  return <div className={`${className} theme-${theme} ${imageUrl || preview ? 'has-photo' : ''}`}>
    {preview || imageUrl ? <img src={preview || imageUrl} alt={`Fotografía de ${name || 'usuario'}`} loading="lazy" referrerPolicy="no-referrer" /> : avatarInitials(name)}
  </div>
}
