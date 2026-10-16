// Registro LOCAL por navegador. Nunca guarda tokens ni contraseñas.
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const PREFIX = 'projectmind-activity-v1:'
const HISTORY_PREFIX = 'projectmind-session-history-v1:'

const readJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export const activityKey = (userId) => `${PREFIX}${userId}`
export const historyKey = (userId) => `${HISTORY_PREFIX}${userId}`

export function getActivity(userId, now = Date.now()) {
  const activity = readJSON(activityKey(userId), null)
  if (!Number.isFinite(activity?.lastActivityAt) || activity.lastActivityAt <= 0 || activity.lastActivityAt > now + 60_000) return null
  return {
    startedAt: Number.isFinite(activity.startedAt) && activity.startedAt > 0 && activity.startedAt <= now ? activity.startedAt : activity.lastActivityAt,
    lastActivityAt: activity.lastActivityAt,
  }
}

export function startActivity(userId, now = Date.now()) {
  const activity = { startedAt: now, lastActivityAt: now }
  localStorage.setItem(activityKey(userId), JSON.stringify(activity))
  return activity
}

export function touchActivity(userId, now = Date.now()) {
  const current = getActivity(userId, now)
  if (!current) return startActivity(userId, now)
  // No reactivar silenciosamente una sesión que ya caducó.
  if (now - current.lastActivityAt >= IDLE_TIMEOUT_MS) return current
  if (now - current.lastActivityAt < 15_000) return current
  const updated = { ...current, lastActivityAt: now }
  localStorage.setItem(activityKey(userId), JSON.stringify(updated))
  return updated
}

export function readHistory(userId) {
  const values = readJSON(historyKey(userId), [])
  return Array.isArray(values) ? values.filter(v => Number.isFinite(v?.seconds) && v.seconds >= 0).slice(-20) : []
}

export function finishActivity(userId, reason, now = Date.now()) {
  const current = getActivity(userId, now)
  localStorage.removeItem(activityKey(userId))
  if (!current) return
  const endedAt = reason === 'idle' ? Math.min(now, current.lastActivityAt) : now
  const seconds = Math.max(0, Math.round((endedAt - current.startedAt) / 1000))
  const history = [...readHistory(userId), { endedAt: now, seconds, reason }].slice(-20)
  localStorage.setItem(historyKey(userId), JSON.stringify(history))
}

export function sessionSummary(userId, now = Date.now()) {
  const history = readHistory(userId)
  const activity = getActivity(userId, now)
  const meanSeconds = history.length ? Math.round(history.reduce((sum, record) => sum + record.seconds, 0) / history.length) : null
  return {
    completedSessions: history.length,
    averageSeconds: meanSeconds,
    elapsedSeconds: activity ? Math.max(0, Math.floor((now - activity.startedAt) / 1000)) : 0,
    remainingSeconds: activity ? Math.max(0, Math.ceil((IDLE_TIMEOUT_MS - (now - activity.lastActivityAt)) / 1000)) : 0,
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
