import { asUTC, daysBetween, projectRange } from './timelineDates.js'

export function taskDurationDays(task){
  const range=projectRange(task)
  return range?.days ?? null
}
export function taskOccursOn(task, isoDay){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(isoDay))return false
  const date=asUTC(isoDay)
  const range=projectRange(task)
  if(range)return date>=range.start&&date<=range.end
  return task.due_date===isoDay
}
export function taskDurationLabel(task){
  const days=taskDurationDays(task)
  return days===null?'Sin duración definida':`${days} día${days===1?'':'s'} calendario`
}
