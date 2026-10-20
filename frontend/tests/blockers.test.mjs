import test from 'node:test'
import assert from 'node:assert/strict'
import { ACTIVE_STATES, preventsTaskUpdate, reasonText, taskBlockReasons } from '../src/utils/blockers.js'
const a = { id: 'a', title: 'Requisitos', status: 'todo', progress: 0 }
const b = { id: 'b', title: 'Backend', status: 'todo', progress: 0 }
const links = [{ task_id: 'b', depends_on_task_id: 'a' }]
const impediment = { id: 'i1', title: 'Faltan claves', status: 'open', task_id: 'b' }

test('impide avance si faltan predecesoras, permite retomar al terminarlas', () => {
  const gate = taskBlockReasons(b, [a, b], links, [])
  assert.equal(gate.blocked, true)
  assert.equal(gate.pending[0].id, 'a')
  assert.equal(preventsTaskUpdate(b, 'done', 100, gate), true)
  assert.equal(preventsTaskUpdate(b, 'blocked', 0, gate), false)
  assert.equal(preventsTaskUpdate(b, 'todo', 0, gate), false)
  const ready = taskBlockReasons(b, [{ ...a, status: 'done' }, b], links, [])
  assert.equal(ready.blocked, false)
  assert.equal(preventsTaskUpdate(b, 'in_progress', 25, ready), false)
})

test('impedimento abierto bloquea, resuelto o descartado no', () => {
  let gate = taskBlockReasons(b, [a, b], [], [impediment])
  assert.equal(gate.blocked, true)
  assert.match(reasonText(gate), /impedimento/)
  gate = taskBlockReasons(b, [a, b], [], [{ ...impediment, status: 'resolved' }])
  assert.equal(gate.blocked, false)
  gate = taskBlockReasons(b, [a, b], [], [{ ...impediment, status: 'dismissed' }])
  assert.equal(gate.blocked, false)
})

test('bloqueo no se aplica a otras tareas ni por impedimentos generales', () => {
  assert.equal(taskBlockReasons(a, [a, b], [], [impediment]).blocked, false)
  assert.equal(taskBlockReasons(b, [a, b], [], [{ ...impediment, task_id: null }]).blocked, false)
  const gate = taskBlockReasons(b, [a, b], links, [impediment])
  assert.equal(gate.pending.length, 1)
  assert.equal(gate.open.length, 1)
  assert.equal(ACTIVE_STATES.has('review'), true)
})

test('no bloquea edición de metadatos ni regreso a Por hacer', () => {
  const gate = taskBlockReasons({ ...b, status: 'in_progress', progress: 30 }, [a, b], links, [], { nextStatus: 'review', nextProgress: 30 })
  assert.equal(preventsTaskUpdate({ ...b, status: 'in_progress', progress: 30 }, 'in_progress', 30, gate), false)
  assert.equal(preventsTaskUpdate({ ...b, status: 'in_progress', progress: 30 }, 'todo', 10, gate), false)
  assert.equal(preventsTaskUpdate({ ...b, status: 'in_progress', progress: 30 }, 'review', 30, gate), false) // PM-20: restricción solo de inicio ya cumplido
})
