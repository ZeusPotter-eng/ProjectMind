import assert from 'node:assert/strict'
import test from 'node:test'
import { IDLE_TIMEOUT_MS, formatDuration, getActivity, startActivity, touchActivity, finishActivity, readHistory, sessionSummary } from '../src/utils/sessionActivity.js'

let db = new Map()
globalThis.localStorage = {
  getItem: key => db.has(key) ? db.get(key) : null,
  setItem: (key, value) => db.set(key, value),
  removeItem: key => db.delete(key),
}

function clean() { db = new Map() }

test('sesión por usuario, sin actividad cruzada', () => {
  clean(); startActivity('A', 100000); startActivity('B', 200000)
  touchActivity('A', 120000)
  assert.equal(getActivity('A', 125000).lastActivityAt, 120000)
  assert.equal(getActivity('B', 225000).lastActivityAt, 200000)
})

test('no revive automáticamente una sesión inactiva', () => {
  clean(); startActivity('user', 100000)
  touchActivity('user', 100000 + IDLE_TIMEOUT_MS + 1)
  assert.equal(getActivity('user', 100000 + IDLE_TIMEOUT_MS + 1).lastActivityAt, 100000)
})

test('promedio por sesiones cerradas con límite de historial', () => {
  clean()
  startActivity('user', 100000)
  finishActivity('user', 'manual', 160000)
  startActivity('user', 200000)
  finishActivity('user', 'manual', 380000)
  assert.equal(sessionSummary('user', 500000).averageSeconds, 120)
  assert.equal(sessionSummary('user', 500000).completedSessions, 2)
  assert.equal(readHistory('user').length, 2)
})

test('inactividad no cuenta los 30 minutos del cierre en promedio', () => {
  clean()
  startActivity('user', 100000)
  touchActivity('user', 120000)
  finishActivity('user', 'idle', 120000 + IDLE_TIMEOUT_MS)
  assert.equal(readHistory('user')[0].seconds, 20)
})

test('formato de duración legible', () => {
  assert.equal(formatDuration(null), 'Sin datos aún')
  assert.equal(formatDuration(3599), '59 min 59 s')
  assert.equal(formatDuration(3600), '1 h 00 min')
})
