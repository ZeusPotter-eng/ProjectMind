// PM-18: lógica pura para estados de precedencia y validación rápida del editor.
export function wouldCreateCycle(edges, taskId, predecessorId, replacingId = null) {
  if (taskId === predecessorId) return true
  const adjacency = new Map()
  for (const edge of edges) {
    if (edge.id === replacingId) continue
    if (!adjacency.has(edge.task_id)) adjacency.set(edge.task_id, [])
    adjacency.get(edge.task_id).push(edge.depends_on_task_id)
  }
  const pending = [predecessorId]
  const visited = new Set()
  while (pending.length) {
    const id = pending.pop()
    if (id === taskId) return true
    if (visited.has(id)) continue
    visited.add(id)
    pending.push(...(adjacency.get(id) || []))
  }
  return false
}

export function dependencySatisfied(edge, predecessor) {
  if (!predecessor) return false
  return ['start_to_start','start_to_finish'].includes(edge.dependency_type)
    ? ['in_progress','review','done'].includes(predecessor.status)
    : predecessor.status === 'done'
}

export function dependencySummary(taskId, edges, taskMap) {
  const prerequisites = edges.filter(edge => edge.task_id === taskId)
  const successors = edges.filter(edge => edge.depends_on_task_id === taskId)
  const pending = prerequisites.filter(edge => !dependencySatisfied(edge,taskMap.get(edge.depends_on_task_id)))
  return { prerequisites, successors, pending, ready: pending.length === 0,
    hasDependencies: prerequisites.length > 0 }
}
