import test from 'node:test'
import assert from 'node:assert/strict'
import { dependencySummary, wouldCreateCycle } from '../src/utils/dependencies.js'

const edges = [
  { id: 'e1', task_id: 'A', depends_on_task_id: 'B' },
  { id: 'e2', task_id: 'B', depends_on_task_id: 'C' },
]

test('el estado de precedencias cambia según las tareas completadas', () => {
  const map = new Map([['A', { status: 'todo' }], ['B', { status: 'todo' }], ['C', { status: 'done' }]])
  assert.equal(dependencySummary('A', edges, map).pending.length, 1)
  assert.equal(dependencySummary('B', edges, map).ready, true)
  assert.equal(dependencySummary('C', edges, map).successors.length, 1)
  map.set('B', { status: 'done' })
  assert.equal(dependencySummary('A', edges, map).ready, true)
})

test('rechaza ciclos directos e indirectos al crear', () => {
  assert.equal(wouldCreateCycle(edges, 'C', 'A'), true)
  assert.equal(wouldCreateCycle(edges, 'A', 'A'), true)
  assert.equal(wouldCreateCycle(edges, 'D', 'A'), false)
})

test('excluye la arista reemplazada al editar', () => {
  assert.equal(wouldCreateCycle(edges, 'A', 'C', 'e1'), false)
  assert.equal(wouldCreateCycle(edges, 'B', 'A', 'e2'), true)
})
