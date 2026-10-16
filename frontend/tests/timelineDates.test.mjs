import assert from 'node:assert/strict'
import test from 'node:test'
import { asUTC, firstOfMonth, daysBetween, projectRange, calendarDays, iso, dayIsInProject } from '../src/utils/timelineDates.js'

test('duración inclusiva y proyecto de un solo día', () => {
  assert.equal(projectRange({ start_date: '2026-10-15', due_date: '2026-10-15' }).days, 1)
  assert.equal(projectRange({ start_date: '2026-10-15', due_date: '2026-10-17' }).days, 3)
})

test('año bisiesto y cambio de mes', () => {
  assert.equal(projectRange({ start_date: '2028-02-28', due_date: '2028-03-01' }).days, 3)
  assert.equal(daysBetween(firstOfMonth(2026, 9), firstOfMonth(2026, 10)), 31)
})

test('fechas incompletas o invertidas no generan barras', () => {
  assert.equal(projectRange({ start_date: null, due_date: '2026-10-18' }), null)
  assert.equal(projectRange({ start_date: '2026-10-18', due_date: '2026-10-17' }), null)
})

test('calendario inicia en lunes y no desplaza eventos de zona horaria', () => {
  const days = calendarDays(firstOfMonth(2026, 9))
  assert.equal(days.length, 42)
  assert.equal(days[0].getUTCDay(), 1)
  assert.equal(iso(days[0]), '2026-09-28')
  assert.equal(dayIsInProject({start_date:'2026-10-15',due_date:'2026-10-16'},asUTC('2026-10-16')),true)
  assert.equal(dayIsInProject({start_date:'2026-10-15',due_date:'2026-10-16'},asUTC('2026-10-17')),false)
})
