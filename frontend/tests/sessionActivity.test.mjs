import assert from 'node:assert/strict'
import test from 'node:test'
import { SESSION_DURATION_MS, activityKey, formatDuration, getActivity, isSessionExpired, startActivity, finishActivity, readHistory, sessionSummary } from '../src/utils/sessionActivity.js'

let data = new Map()
globalThis.localStorage = {
  getItem: key => data.has(key) ? data.get(key) : null,
  setItem: (key, value) => data.set(key, value),
  removeItem: key => data.delete(key),
}
const reset = () => { data = new Map() }

test('vigencia de exactamente 24 horas, independientemente de inactividad', () => {
  const start = 100000
  assert.equal(isSessionExpired(start, start + SESSION_DURATION_MS - 1), false)
  assert.equal(isSessionExpired(start, start + SESSION_DURATION_MS), true)
  assert.equal(isSessionExpired(start, start + 30 * 60 * 1000), false)
})

test('no se extiende la sesión por usar la aplicación', () => {
  reset(); const start = 100000
  startActivity('A', start)
  assert.equal(getActivity('A', start + 23 * 60 * 60 * 1000).startedAt, start)
  assert.equal(sessionSummary('A', start + SESSION_DURATION_MS).expired, true)
})

test('cada usuario tiene su propio registro local', () => {
  reset(); startActivity('A', 100000); startActivity('B', 200000)
  assert.equal(getActivity('A', 300000).startedAt, 100000)
  assert.equal(getActivity('B', 300000).startedAt, 200000)
  assert.notEqual(activityKey('A'), activityKey('B'))
})

test('no admite inicio posterior al reloj ni datos incorrectos', () => {
  reset()
  assert.equal(isSessionExpired(undefined, 120000), true)
  assert.equal(isSessionExpired(130000, 120000), true)
  localStorage.setItem(activityKey('A'), '{oops')
  assert.equal(getActivity('A', 120000), null)
})

test('promedio de sesiones finalizadas se conserva y tiene límite', () => {
  reset(); startActivity('A', 100000); finishActivity('A', 'manual', 160000)
  startActivity('A', 200000); finishActivity('A', 'manual', 380000)
  assert.equal(sessionSummary('A', 500000).averageSeconds, 120)
  assert.equal(sessionSummary('A', 500000).completedSessions, 2)
  assert.equal(readHistory('A').length, 2)
})

test('historial de sesión caducada nunca registra más de 24 horas', () => {
  reset(); startActivity('A', 100000)
  finishActivity('A', 'expired', 100000 + SESSION_DURATION_MS + 800000)
  assert.equal(readHistory('A')[0].seconds, SESSION_DURATION_MS / 1000)
})

test('el resumen no expone contador restante', () => {
  reset(); startActivity('A', 100000)
  assert.equal(Object.prototype.hasOwnProperty.call(sessionSummary('A', 200000), 'remainingSeconds'), false)
})

test('formato legible del promedio', () => {
  assert.equal(formatDuration(null), 'Sin datos aún')
  assert.equal(formatDuration(3599), '59 min 59 s')
  assert.equal(formatDuration(3600), '1 h 00 min')
})
