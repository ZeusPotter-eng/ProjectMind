// Duración ABSOLUTA de una sesión: 24 horas desde el inicio, sin contador visible.
// Historial local por usuario y navegador: NO contiene credenciales ni tokens.
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000
const PREFIX = 'projectmind-activity-v2:'
const HISTORY_PREFIX = 'projectmind-session-history-v1:'

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export const activityKey = userId => `${PREFIX}${userId}`
export const historyKey = userId => `${HISTORY_PREFIX}${userId}`

export function isSessionExpired(startedAt, now = Date.now()) {
  return !Number.isFinite(startedAt) || startedAt <= 0 || startedAt > now || now - startedAt >= SESSION_DURATION_MS
}

export function getActivity(userId, now = Date.now()) {
  const data = readJSON(activityKey(userId), null)
  if (!Number.isFinite(data?.startedAt) || data.startedAt <= 0 || data.startedAt > now) return null
  return { startedAt: data.startedAt }
}

export function startActivity(userId, now = Date.now()) {
  const activity = { startedAt: now }
  localStorage.setItem(activityKey(userId), JSON.stringify(activity))
  return activity
}

export function readHistory(userId) {
  const values = readJSON(historyKey(userId), [])
  return Array.isArray(values) ? values.filter(v => Number.isFinite(v?.seconds) && v.seconds >= 0).slice(-20) : []
}

export function finishActivity(userId, reason, now = Date.now()) {
  const current = getActivity(userId, now)
  localStorage.removeItem(activityKey(userId))
  if (!current) return
  // Si la pestaña permaneció cerrada, no registrar más de las 24 horas concedidas.
  const endedAt = Math.min(now, current.startedAt + SESSION_DURATION_MS)
  const seconds = Math.max(0, Math.round((endedAt - current.startedAt) / 1000))
  const history = [...readHistory(userId), { endedAt: now, seconds, reason }].slice(-20)
  localStorage.setItem(historyKey(userId), JSON.stringify(history))
}

export function sessionSummary(userId, now = Date.now()) {
  const history = readHistory(userId)
  const activity = getActivity(userId, now)
  const meanSeconds = history.length ? Math.round(history.reduce((sum, value) => sum + value.seconds, 0) / history.length) : null
  return {
    completedSessions: history.length,
    averageSeconds: meanSeconds,
    sessionStartedAt: activity?.startedAt ?? null,
    // Solo se usa internamente para cerrar, nunca se presenta como contador.
    expired: !activity || isSessionExpired(activity.startedAt, now),
  }
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'Sin datos aún'
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m} min ${String(s).padStart(2, '0')} s`
}
