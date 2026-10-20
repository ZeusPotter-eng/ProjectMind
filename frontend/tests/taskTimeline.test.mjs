import test from 'node:test'
import assert from 'node:assert/strict'
import { taskDurationDays, taskDurationLabel, taskOccursOn } from '../src/utils/taskTimeline.js'

test('duración inclusiva de tareas y día único',()=>{
 assert.equal(taskDurationDays({start_date:'2026-10-01',due_date:'2026-10-02'}),2)
 assert.equal(taskDurationLabel({start_date:'2026-10-01',due_date:'2026-10-01'}),'1 día calendario')
 assert.equal(taskDurationLabel({start_date:null,due_date:null}),'Sin duración definida')
})
test('tareas por día: rangos y entregas sin inicio',()=>{
 const task={start_date:'2026-10-01',due_date:'2026-10-05'}
 assert.equal(taskOccursOn(task,'2026-10-03'),true)
 assert.equal(taskOccursOn(task,'2026-10-06'),false)
 assert.equal(taskOccursOn({start_date:null,due_date:'2026-10-19'},'2026-10-19'),true)
 assert.equal(taskOccursOn({start_date:null,due_date:null},'2026-10-19'),false)
})
