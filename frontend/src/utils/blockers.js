// PM-19: estados de impedimentos y reglas de presentación, sin mutaciones.
export const ACTIVE_STATES = new Set(['in_progress', 'review', 'done'])

export function taskBlockReasons(task, tasks, dependencies, blockers) {
  const catalog = new Map(tasks.map(row => [row.id, row]))
  const pending = dependencies
    .filter(edge => edge.task_id === task.id)
    .map(edge => catalog.get(edge.depends_on_task_id) || { id: edge.depends_on_task_id, title: 'Tarea sin acceso', status: 'unknown' })
    .filter(row => row.status !== 'done')
  const open = blockers.filter(row => row.task_id === task.id && row.status === 'open')
  return { pending, open, blocked: pending.length > 0 || open.length > 0 }
}

export function preventsTaskUpdate(task, nextStatus, nextProgress, reasons) {
  return reasons.blocked && ((ACTIVE_STATES.has(nextStatus) && task.status !== nextStatus) || Number(nextProgress) > Number(task.progress))
}

export function reasonText(reasons) {
  const items = []
  if (reasons.pending.length) items.push(`${reasons.pending.length} predecesora(s) pendiente(s)`)
  if (reasons.open.length) items.push(`${reasons.open.length} impedimento(s) abierto(s)`)
  return items.join(' · ')
}
