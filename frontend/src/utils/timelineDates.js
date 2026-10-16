// Fechas civiles en UTC, sin corrimientos causados por zonas horarias o cambios de horario.
export const DAY = 86_400_000
export const STATUS = { planning: 'Planeación', active: 'Activo', on_hold: 'En pausa', completed: 'Completado', archived: 'Archivado' }
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const iso = (day) => day.toISOString().slice(0, 10)
export const localISO = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const asUTC = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`) : null
export const firstOfMonth = (year, month) => new Date(Date.UTC(year, month, 1))
export const plusDays = (date, days) => new Date(date.getTime() + days * DAY)
export const daysBetween = (first, second) => Math.round((second.getTime() - first.getTime()) / DAY)
export const readable = (date) => date ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date) : 'Sin fecha'

export function projectRange(project) {
  const start = asUTC(project.start_date)
  const end = asUTC(project.due_date)
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null
  return { start, end, days: daysBetween(start, end) + 1 }
}

export function dayIsInProject(project, date) {
  const range = projectRange(project)
  return Boolean(range && date && date >= range.start && date <= range.end)
}

export function calendarDays(month) {
  const first = firstOfMonth(month.getUTCFullYear(), month.getUTCMonth())
  const day = (first.getUTCDay() + 6) % 7
  const start = plusDays(first, -day)
  return Array.from({ length: 42 }, (_, index) => plusDays(start, index))
}
